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
