import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.mjs";
import { createStore, backoffMs, makeRedactor, validateSubmission } from "../core.mjs";
import { profileDir } from "../adapters.mjs";

// Adaptadores de TESTE (não existem em produção)
const ok = { local: true, available: () => true, async run({ task }) { return { ok: true, output: `feito: ${task.prompt}` }; } };
const falha = { local: true, available: () => true, async run() { return { ok: false, error: "quebrou" }; } };
const espera = { local: true, available: () => true, run: ({ signal }) => new Promise(r => signal.addEventListener("abort", () => r({ ok: false, error: "abortado" }))) };
const remoto = { local: false, available: () => true, async run() { return { ok: false }; } };

const ADMIN = "a".repeat(32), WORKER = "w".repeat(32);
const profiles = {
  bom: { adapter: "ok", maxAttempts: 3, backoffMs: 1, timeoutMs: 5000 },
  ruim: { adapter: "falha", maxAttempts: 3, backoffMs: 1, timeoutMs: 5000 },
  lento: { adapter: "espera", maxAttempts: 1, backoffMs: 1, timeoutMs: 200 },
  longo: { adapter: "espera", maxAttempts: 1, backoffMs: 1, timeoutMs: 60000 },
  pc: { adapter: "remoto", maxAttempts: 2, backoffMs: 1, timeoutMs: 100 },
};
const adapters = { ok, falha, espera, remoto };
const waitFor = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 10)); } return false; };

async function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "agentops-"));
  const app = createApp({ dir, profiles, adapters, adminToken: ADMIN, workers: { pc1: { token: WORKER, profiles: ["pc"] } }, rand: () => 0 });
  const server = createServer(app.handler);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  t.after(() => { app.runner.abortAll(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = "GET", token = ADMIN, json } = {}) => fetch(base + path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  return { app, call, dir };
}

test("sem token 401; token de worker não acessa rotas de admin", async t => {
  const { call } = await setup(t);
  assert.equal((await call("/health", { token: null })).status, 200);
  assert.equal((await call("/api/state", { token: null })).status, 401);
  assert.equal((await call("/api/state", { token: "errado".repeat(6) })).status, 401);
  assert.equal((await call("/api/state", { token: WORKER })).status, 403);
  assert.equal((await call("/api/tasks", { method: "POST", token: WORKER, json: { profile: "bom", prompt: "x" } })).status, 403);
  assert.equal((await call("/api/state")).status, 200);
});

test("não aceita comando, perfil desconhecido nem campos extras", async t => {
  const { call } = await setup(t);
  for (const json of [{ profile: "nao-existe", prompt: "x" }, { profile: "bom", prompt: "" }, { profile: "bom", prompt: "x", command: "rm -rf /" }, { profile: "bom", prompt: "x", priority: 99 }]) {
    assert.equal((await call("/api/tasks", { method: "POST", json })).status, 400, JSON.stringify(json));
  }
  assert.equal(validateSubmission({ profile: "__proto__", prompt: "x" }, profiles), "perfil desconhecido");
});

test("tarefa roda e termina com sucesso", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "bom", prompt: "olá" } })).json();
  assert.ok(await waitFor(() => app.store.get(task.id).status === "succeeded"));
  const full = await (await call(`/api/tasks/${task.id}`)).json();
  assert.equal(full.task.output, "feito: olá");
  assert.equal(full.task.attempts, 1);
});

test("tentativas têm limite: falha para depois de maxAttempts", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "ruim", prompt: "x" } })).json();
  for (let i = 0; i < 20 && app.store.get(task.id).status !== "failed"; i++) { await new Promise(r => setTimeout(r, 20)); app.tick(); }
  const t1 = app.store.get(task.id);
  assert.equal(t1.status, "failed");
  assert.equal(t1.attempts, 3);
  app.tick(); await new Promise(r => setTimeout(r, 30));
  assert.equal(app.store.get(task.id).attempts, 3);
});

test("timeout aborta a tarefa", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "lento", prompt: "x" } })).json();
  assert.ok(await waitFor(() => app.store.get(task.id).status === "failed"));
  assert.match(app.store.get(task.id).error, /tempo esgotado/);
});

test("cancelar uma tarefa em execução para o agente e não volta a rodar", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "longo", prompt: "x" } })).json();
  assert.ok(await waitFor(() => app.store.get(task.id).status === "running"));
  assert.equal((await call(`/api/tasks/${task.id}/cancel`, { method: "POST" })).status, 200);
  assert.ok(await waitFor(() => app.runner.busy === 0));
  assert.equal(app.store.get(task.id).status, "cancelled");
  app.tick(); await new Promise(r => setTimeout(r, 30));
  assert.equal(app.store.get(task.id).status, "cancelled");
});

test("kill switch impede novas execuções até liberar", async t => {
  const { app, call } = await setup(t);
  await call("/api/pause", { method: "POST" });
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "bom", prompt: "x" } })).json();
  await new Promise(r => setTimeout(r, 50)); app.tick();
  assert.equal(app.store.get(task.id).status, "queued");
  assert.equal((await (await call("/api/state")).json()).paused, true);
  await call("/api/resume", { method: "POST" }); app.tick();
  assert.ok(await waitFor(() => app.store.get(task.id).status === "succeeded"));
});

test("fila sobrevive a reinício; tarefa interrompida volta para a fila", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentops-"));
  const s1 = createStore(dir);
  const a = s1.add("bom", profiles.bom, "persistir");
  const b = s1.add("bom", profiles.bom, "interrompida");
  b.status = "running"; b.attempts = 1; s1.save();
  const s2 = createStore(dir);
  assert.equal(s2.get(a.id).prompt, "persistir");
  assert.equal(s2.recoverInterrupted(), 1);
  assert.equal(s2.get(b.id).status, "queued");
});

test("segredos não aparecem na saída", async t => {
  const vaza = { local: true, available: () => true, async run() { return { ok: true, output: `token=${ADMIN} e sk-ant-api03-abcdefghijklmnop` }; } };
  const dir = mkdtempSync(join(tmpdir(), "agentops-"));
  const app = createApp({ dir, profiles: { v: { adapter: "vaza", maxAttempts: 1 } }, adapters: { vaza }, adminToken: ADMIN });
  const task = app.store.add("v", { maxAttempts: 1 }, "x"); app.tick();
  assert.ok(await waitFor(() => app.store.get(task.id).status === "succeeded"));
  assert.doesNotMatch(app.store.get(task.id).output, new RegExp(ADMIN));
  assert.doesNotMatch(app.store.get(task.id).output, /sk-ant-/);
  assert.equal(makeRedactor(["segredo-longo-123"])("x segredo-longo-123 y"), "x [segredo] y");
});

test("worker busca só os seus perfis, devolve resultado, e prazo vencido volta para a fila", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "no PC" } })).json();
  await call("/api/tasks", { method: "POST", json: { profile: "longo", prompt: "local" } });
  const c1 = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  assert.equal(c1.task.id, task.id);
  assert.equal((await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: "00000000-0000-0000-0000-000000000000", leaseId: "x", ok: true } })).status, 409);
  await new Promise(r => setTimeout(r, 150)); app.tick();
  assert.equal(app.store.get(task.id).status, "queued");
  await new Promise(r => setTimeout(r, 5));
  const c2 = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  // resposta atrasada da tentativa 1 não fecha a tentativa 2
  assert.equal((await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: c1.task.id, leaseId: c1.task.leaseId, ok: true, output: "velha" } })).status, 409);
  assert.equal((await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: c2.task.id, leaseId: c2.task.leaseId, ok: true, output: "pronto" } })).status, 200);
  assert.equal(app.store.get(task.id).output, "pronto");
  assert.equal(app.store.get(task.id).status, "succeeded");
  const hb = await (await call("/api/worker/heartbeat", { method: "POST", token: WORKER, json: { adapters: ["remoto"], version: "teste" } })).json();
  assert.equal(hb.ok, true);
  assert.equal((await (await call("/api/state")).json()).agents.remoto.state, "idle");
});

test("reinício não devolve para a fila tarefa remota com prazo válido nem repete perfil não idempotente", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentops-"));
  const s = createStore(dir);
  const remota = s.add("pc", profiles.pc, "x"); Object.assign(remota, { status: "running", attempts: 1, claimedBy: "pc1", leaseUntil: Date.now() + 60_000 });
  const edicao = s.add("bom", { ...profiles.bom, idempotent: false }, "editar"); Object.assign(edicao, { status: "running", attempts: 1 });
  s.save();
  const s2 = createStore(dir); s2.recoverInterrupted();
  assert.equal(s2.get(remota.id).status, "running");
  assert.equal(s2.get(edicao.id).status, "failed");
  assert.match(s2.get(edicao.id).error, /repita manualmente/);
});

test("state.json corrompido é guardado, não sobrescrito em silêncio", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentops-"));
  writeFileSync(join(dir, "state.json"), "{quebrado");
  const s = createStore(dir, { log: () => {} });
  assert.ok(s.corrupted && existsSync(s.corrupted));
  assert.equal(readFileSync(s.corrupted, "utf8"), "{quebrado");
  assert.equal(s.state.tasks.length, 0);
});

test("cancelar tarefa remota avisa o worker pelo heartbeat", async t => {
  const { call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "x" } })).json();
  const c = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  await call(`/api/tasks/${task.id}/cancel`, { method: "POST" });
  const hb = await (await call("/api/worker/heartbeat", { method: "POST", token: WORKER, json: {} })).json();
  assert.deepEqual(hb.cancel, [c.task.leaseId]);
});

test("erro interno responde 500, não 400", async t => {
  const { app, call } = await setup(t);
  app.store.add = () => { throw new Error("ENOSPC: disco cheio"); };
  const res = await call("/api/tasks", { method: "POST", json: { profile: "bom", prompt: "x" } });
  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(await res.json()), /ENOSPC/);
});

test("pastas de perfil ficam confinadas em ~/agentes; backoff cresce e tem teto", () => {
  assert.throws(() => profileDir("../fora"), /inválido/);
  assert.throws(() => profileDir("a/b"), /inválido/);
  assert.match(profileDir("leitura"), /agentes[\\/]leitura$/);
  assert.ok(backoffMs(1, 1000, 60000, () => 0) < backoffMs(4, 1000, 60000, () => 0));
  assert.ok(backoffMs(50, 1000, 60000, () => 0) <= 60000);
});

test("claude-local: sessão só com as ferramentas do perfil, sem MCP e com o settings da pasta (Q7)", async () => {
  const { claudeArgs, BASE_TOOLS } = await import("../adapters.mjs");
  const a = claudeArgs({ tools: ["Read", "Grep", "Glob", "Edit", "Write"], allowedTools: ["Read(./**)"] }, "/w/edicao");
  assert.equal(a[a.indexOf("--tools") + 1], "Read,Grep,Glob,Edit,Write");
  assert.ok(a.includes("--strict-mcp-config") && a.includes("--restricted"));
  assert.equal(a[a.indexOf("--permission-mode") + 1], "dontAsk");
  assert.match(a[a.indexOf("--settings") + 1].split(String.fromCharCode(92)).join("/"), /\/w\/edicao\/\.claude\/settings\.json$/);
  // R8: o texto da tarefa nunca vira argumento (vai pelo stdin); logo depois do -p vem uma opção nossa
  assert.equal(a[a.indexOf("-p") + 1], "--output-format");
  assert.ok(!a.includes("tarefa"));
  const padrao = claudeArgs({}, "/w/l");
  assert.equal(padrao[padrao.indexOf("--tools") + 1], BASE_TOOLS.join(","));
  assert.doesNotMatch(a.join(" "), /dangerously|bypassPermissions|acceptEdits/);
});

test("G4: tarefa reenfileirada (prazo vencido ou falha do worker) sai sem claimedBy, leaseId e leaseUntil", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "no PC" } })).json();
  const c1 = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  assert.ok(app.store.get(task.id).leaseId);
  await new Promise(r => setTimeout(r, 150)); app.tick();
  let cur = app.store.get(task.id);
  assert.equal(cur.status, "queued");
  assert.deepEqual([cur.claimedBy, cur.leaseId, cur.leaseUntil], [null, null, null], "prazo vencido");
  await new Promise(r => setTimeout(r, 5));
  const c2 = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  assert.notEqual(c2.task.leaseId, c1.task.leaseId);
  await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: c2.task.id, leaseId: c2.task.leaseId, ok: false, error: "x" } });
  cur = app.store.get(task.id);
  assert.equal(cur.status, "failed", "2 tentativas esgotadas");
});

test("G5: saída acima de 256 KB com código 0 não vira falha (runProcess avisa o corte)", { skip: process.platform === "win32" }, async () => {
  const { mkdirSync, writeFileSync, chmodSync } = await import("node:fs");
  const { claudeLocal } = await import("../adapters.mjs");
  const ccDir = mkdtempSync(join(tmpdir(), "cc-"));
  writeFileSync(join(ccDir, "claude"), "");
  writeFileSync(join(ccDir, "ld-musl-aarch64.so.1"), "#!/bin/sh\nhead -c 400000 /dev/zero | tr '\0' 'a'\n");
  chmodSync(join(ccDir, "ld-musl-aarch64.so.1"), 0o755);
  const r = await claudeLocal({ ccDir }).run({ task: { prompt: "x", profile: "nada" }, profile: {}, signal: new AbortController().signal });
  assert.equal(r.ok, true);
  assert.match(r.output, /saída cortada em 256 KB/);
});

// ---- T85 (auditoria A4, B6): isolamento do agente provado com listas LITERAIS, não com a constante do código ----
const DENY_LITERAL = [
  "Read(**/.env)", "Read(**/.env.*)", "Read(~/.ssh/**)", "Read(~/.claude/**)", "Read(~/servidor/**)",
  "Read(~/shared/**)", "Read(~/opt/**)", "Read(~/.termux/**)", "Read(**/*.pem)", "Read(**/*.key)", "Read(**/*.token)",
  "Edit(~/servidor/**)", "Write(~/servidor/**)",
  "Bash(curl:*)", "Bash(wget:*)", "Bash(ssh:*)", "Bash(scp:*)", "Bash(rm -rf:*)", "Bash(git push:*)",
];

test("T85: prepareWorkdir grava no settings.json do perfil exatamente as regras de bloqueio (lista literal)", async () => {
  const { prepareWorkdir, DENY_RULES } = await import("../adapters.mjs");
  const { resolve } = await import("node:path");
  assert.deepEqual(DENY_RULES, DENY_LITERAL);
  const raiz = mkdtempSync(join(tmpdir(), "agentes-"));
  const dir = prepareWorkdir("edicao", { allowedTools: ["Read(./**)"] }, raiz);
  assert.equal(dir, resolve(raiz, "edicao"));
  const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(s.permissions.deny, DENY_LITERAL);
  assert.deepEqual(s.permissions.allow, ["Read(./**)"]);
  assert.equal(s.env.DISABLE_AUTOUPDATER, "1");
  // perfil sem allowedTools não ganha permissão nenhuma por padrão
  const dir2 = prepareWorkdir("leitura", {}, raiz);
  assert.deepEqual(JSON.parse(readFileSync(join(dir2, ".claude", "settings.json"), "utf8")).permissions.allow, []);
  assert.throws(() => prepareWorkdir("../fora", {}, raiz), /inválido/);
  assert.throws(() => prepareWorkdir("a/b", {}, raiz), /inválido/);
});

test("T85: com o kill switch ligado o worker não recebe tarefa (claim vazio) e volta a receber ao liberar", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "no PC" } })).json();
  await call("/api/pause", { method: "POST" });
  const pausado = await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} });
  assert.equal(pausado.status, 200);
  assert.equal((await pausado.json()).task, null, "entregou tarefa com o kill switch ligado");
  assert.equal(app.store.get(task.id).status, "queued");
  assert.equal(app.store.get(task.id).attempts, 0);
  await call("/api/resume", { method: "POST" });
  assert.equal((await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json()).task.id, task.id);
});

test("T85: erro e saída que o worker devolve passam pelo redact (token admin, token do worker, chave sk-ant) em toda tentativa", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "x" } })).json();
  const chaveFalsa = ["sk-ant", "api03", "abcdefghijklmnop"].join("-"); // montada em pedaços: o teste não carrega um segredo literal
  const vazamento = `falhou com ${ADMIN} e ${WORKER} e ${chaveFalsa}`;
  const devolve = async () => {
    const c = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
    assert.equal(c.task.id, task.id);
    const r = await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: c.task.id, leaseId: c.task.leaseId, ok: false, error: vazamento, output: vazamento } });
    assert.equal(r.status, 200);
  };
  const limpo = campo => { for (const s of [ADMIN, WORKER, "sk-ant-api03"]) assert.ok(!campo.includes(s), `${s} apareceu em: ${campo}`); };
  await devolve(); // 1ª tentativa: volta para a fila com o erro gravado
  assert.equal(app.store.get(task.id).status, "queued");
  limpo(app.store.get(task.id).error); limpo(app.store.get(task.id).output);
  await new Promise(r => setTimeout(r, 10));
  await devolve(); // 2ª: esgota as tentativas e falha de vez
  const final = app.store.get(task.id);
  assert.equal(final.status, "failed");
  limpo(final.error); limpo(final.output);
  assert.match(final.error, /\[segredo\]/, "o erro não foi mascarado");
  // e o que o admin lê pela API também
  limpo(JSON.stringify(await (await call(`/api/tasks/${task.id}`)).json()));
});

test("T85: /result do worker com corpo ruim é 400, de tarefa que não é dele é 409, e token de worker não cria tarefa", async t => {
  const { app, call } = await setup(t);
  const { task } = await (await call("/api/tasks", { method: "POST", json: { profile: "pc", prompt: "x" } })).json();
  const c = await (await call("/api/worker/claim", { method: "POST", token: WORKER, json: {} })).json();
  for (const json of [{}, { id: c.task.id }, { id: c.task.id, leaseId: c.task.leaseId, ok: "sim" }, { id: 1, leaseId: "x", ok: true }]) {
    assert.equal((await call("/api/worker/result", { method: "POST", token: WORKER, json })).status, 400, JSON.stringify(json));
  }
  assert.equal((await call("/api/worker/result", { method: "POST", token: WORKER, json: { id: c.task.id, leaseId: "outro", ok: true } })).status, 409);
  assert.equal(app.store.get(task.id).status, "running", "um leaseId errado fechou a tarefa");
  assert.equal((await call("/api/worker/result", { method: "GET", token: WORKER })).status, 403);
});
