import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Rodar com: node --test tools/worker/test/*.test.mjs  (passar só a pasta falha no Node 25 do Windows)
import { buildRunner, prepareDir, claudeSettings, DISALLOWED, blockedWorkdir, fitResult } from "../worker.mjs";

test("importar o worker não exige worker.json nem roda o loop", () => {
  assert.equal(typeof buildRunner, "function");
});

test("pc-claude: modo dontAsk, só leitura da pasta, sem shell/edição/web/MCP", () => {
  const r = buildRunner("pc-claude", "C:/x");
  const a = r.args.join(" ");
  assert.match(a, /--permission-mode dontAsk/);
  assert.equal(r.args[r.args.indexOf("--allowedTools") + 1], "Read(./**)");
  const dis = r.args[r.args.indexOf("--disallowedTools") + 1].split(",");
  for (const t of ["Bash", "PowerShell", "Edit", "Write", "WebFetch", "WebSearch"]) assert.ok(dis.includes(t), t);
  assert.ok(r.args.includes("--strict-mcp-config"));
  assert.doesNotMatch(a, /dangerously|bypassPermissions|--yolo|acceptEdits|auto\b/);
  assert.ok(!r.args.includes("--prompt") && !a.includes("{{"), "texto da tarefa vai pelo stdin, não por argumento");
});

test("pc-hermes fica desligado até prova de segurança; perfil desconhecido não roda", () => {
  assert.match(buildRunner("pc-hermes", "C:/x").disabled, /desligado/);
  assert.equal(buildRunner("pc-qualquer", "C:/x"), null);
});

test("pasta do perfil recebe regras: lê só ./, nega pastas sensíveis e ferramentas perigosas", () => {
  const dir = prepareDir(mkdtempSync(join(tmpdir(), "worker-")), "pc-claude");
  const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(s, claudeSettings());
  assert.deepEqual(s.permissions.allow, ["Read(./**)"]);
  for (const p of ["Read(~/.ssh/**)", "Read(~/.servidor-a13/**)", "Read(~/.claude/**)", "Read(~/Desktop/**)", "Bash", "PowerShell", "Write"]) {
    assert.ok(s.permissions.deny.includes(p), p);
  }
  assert.equal(s.permissions.defaultMode, "dontAsk");
  for (const t of DISALLOWED) assert.ok(s.permissions.deny.includes(t));
});

test("pc-claude: sessão só com Read/Grep/Glob, restrita e com o settings da pasta (Q3)", () => {
  const r = buildRunner("pc-claude", "C:/w/pc-claude");
  assert.equal(r.args[r.args.indexOf("--tools") + 1], "Read,Grep,Glob");
  assert.ok(r.args.includes("--restricted"));
  assert.match(r.args[r.args.indexOf("--settings") + 1].replace(/\\/g, "/"), /C:\/w\/pc-claude\/\.claude\/settings\.json$/);
});

test("workdir dentro de pasta bloqueada é recusado (R1)", () => {
  assert.equal(blockedWorkdir("C:/Users/x/agentes-pc", "C:/Users/x"), null);
  assert.equal(blockedWorkdir("C:\\Users\\x\\AppData\\Local\\Temp\\w", "C:\\Users\\x"), "~/AppData");
  assert.equal(blockedWorkdir("C:/Users/x/Desktop/w", "C:/Users/x"), "~/Desktop");
});

test("nome de perfil com caminho é recusado", () => {
  assert.throws(() => prepareDir(tmpdir(), "../fora"), /inválido/);
  assert.throws(() => prepareDir(tmpdir(), "a/b"), /inválido/);
});

test("fitResult: output de 100 KB (com aspas e acentos) cabe no corpo de 32 KB do AgentOps", () => {
  const res = { ok: true, output: '"é\n'.repeat(35_000), error: "x".repeat(100_000) };
  const body = JSON.stringify({ id: "t", leaseId: "l", ...fitResult(res) });
  assert.ok(Buffer.byteLength(body) < 32 * 1024);
  const r = fitResult(res);
  assert.equal(r.ok, true);
  assert.match(r.output, /cortado pelo worker/);
  assert.deepEqual(fitResult({ ok: true, output: "curto" }), { ok: true, output: "curto" });
});

test("fitResult mede BYTES: acentos e emoji perto do limite não passam de 32 KB nem quebram UTF-8", () => {
  for (const unidade of ["é", "😀", "日", "\"\\", "a"]) {
    const res = { ok: false, output: unidade.repeat(40_000), error: unidade.repeat(40_000) };
    const body = JSON.stringify({ id: "t", leaseId: "l", ...fitResult(res) });
    assert.ok(Buffer.byteLength(body) <= 32 * 1024, unidade + " " + Buffer.byteLength(body));
    const r = fitResult(res);
    assert.ok(r.output.length > 1000, "output não pode ser zerado por causa do error");
    assert.ok(r.output.isWellFormed() && r.error.isWellFormed(), "não pode sobrar par substituto partido");
    assert.ok(!body.includes("�"));
  }
});

// ---- T85 (auditoria A4, B6): regras do worker em lista LITERAL e respostas do A13 conferidas ----
import { cycle, prazoMs } from "../worker.mjs";

test("T85: settings do agente do PC com a lista literal de regras (apagar uma regra reprova)", () => {
  const s = claudeSettings();
  assert.deepEqual(s.permissions.allow, ["Read(./**)"]);
  assert.equal(s.permissions.defaultMode, "dontAsk");
  assert.deepEqual(s.permissions.deny, [
    "Read(~/.ssh/**)", "Read(~/.servidor-a13/**)", "Read(~/.claude/**)", "Read(~/.gemini/**)", "Read(~/Desktop/**)", "Read(~/Documents/**)", "Read(~/AppData/**)",
    "Read(**/.env)", "Read(**/.env.*)", "Read(**/*.pem)", "Read(**/*.key)", "Read(**/*.token)", "Read(**/id_ed25519*)", "Read(**/id_rsa*)",
    "Bash", "PowerShell", "Edit", "Write", "MultiEdit", "NotebookEdit", "WebFetch", "WebSearch", "Agent", "Task",
  ]);
  assert.deepEqual(DISALLOWED, ["Bash", "PowerShell", "Edit", "Write", "MultiEdit", "NotebookEdit", "WebFetch", "WebSearch", "Agent", "Task"]);
});

test("T85: o settings.json gravado na pasta do perfil tem as mesmas regras literais", () => {
  const dir = prepareDir(mkdtempSync(join(tmpdir(), "worker-")), "pc-claude");
  const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
  for (const p of ["Read(**/.env)", "Read(**/.env.*)", "Read(**/*.key)", "Read(**/*.token)", "Read(**/id_rsa*)"]) assert.ok(s.permissions.deny.includes(p), p);
});

/** A13 falso: devolve o que o teste mandar e guarda cada chamada (rota + corpo). */
function a13Falso(respostas) {
  const chamadas = [];
  const api = async (path, body) => {
    chamadas.push({ path, body });
    const r = respostas[path];
    return typeof r === "function" ? r(body) : r;
  };
  return { api, chamadas };
}
const OK_HB = { status: 200, body: { ok: true, paused: false, cancel: [] } };
const TAREFA = { id: "t1", leaseId: "l1", profile: "pc-claude", prompt: "oi", timeoutMs: 300_000 };
const cfg = { workdir: tmpdir() };

test("T85: ciclo em dry-run entrega o resultado com id e leaseId da tarefa e confere o status da entrega", async t => {
  t.mock.method(console, "log", () => {});
  const { api, chamadas } = a13Falso({ "/api/worker/heartbeat": OK_HB, "/api/worker/claim": { status: 200, body: { task: TAREFA } }, "/api/worker/result": { status: 200, body: { ok: true } } });
  await cycle(cfg, api, true);
  assert.deepEqual(chamadas.map(c => c.path), ["/api/worker/heartbeat", "/api/worker/claim", "/api/worker/result"]);
  const r = chamadas[2].body;
  assert.equal(r.id, "t1"); assert.equal(r.leaseId, "l1"); assert.equal(r.ok, true);
  assert.match(r.output, /dry-run/);
});

test("T85: resultado recusado pelo A13 (401/409/500) vira erro, não 'entregue'", async t => {
  t.mock.method(console, "log", () => {});
  for (const status of [401, 409, 500]) {
    const { api } = a13Falso({ "/api/worker/heartbeat": OK_HB, "/api/worker/claim": { status: 200, body: { task: TAREFA } }, "/api/worker/result": { status, body: { ok: false } } });
    await assert.rejects(cycle(cfg, api, true), new RegExp(`${status}`), `status ${status} foi tratado como entregue`);
  }
});

test("T85: claim recusado (401/500) vira erro, não 'nenhuma tarefa'", async t => {
  t.mock.method(console, "log", () => {});
  for (const status of [401, 403, 500]) {
    const { api, chamadas } = a13Falso({ "/api/worker/heartbeat": OK_HB, "/api/worker/claim": { status, body: {} } });
    await assert.rejects(cycle(cfg, api, true), new RegExp(`claim.*${status}`));
    assert.ok(!chamadas.some(c => c.path === "/api/worker/result"));
  }
});

test("T85: heartbeat recusado, kill switch ligado e fila vazia não chegam a executar nem entregar nada", async t => {
  t.mock.method(console, "log", () => {});
  const recusado = a13Falso({ "/api/worker/heartbeat": { status: 401, body: {} } });
  await assert.rejects(cycle(cfg, recusado.api, true), /heartbeat recusado \(401\)/);
  assert.deepEqual(recusado.chamadas.map(c => c.path), ["/api/worker/heartbeat"]);

  const pausado = a13Falso({ "/api/worker/heartbeat": { status: 200, body: { paused: true } } });
  await cycle(cfg, pausado.api, true);
  assert.deepEqual(pausado.chamadas.map(c => c.path), ["/api/worker/heartbeat"], "buscou tarefa com o kill switch ligado");

  const vazio = a13Falso({ "/api/worker/heartbeat": OK_HB, "/api/worker/claim": { status: 200, body: { task: null } } });
  await cycle(cfg, vazio.api, true);
  assert.deepEqual(vazio.chamadas.map(c => c.path), ["/api/worker/heartbeat", "/api/worker/claim"]);
});

test("T85: perfil que o worker não suporta (e pc-hermes desligado) volta como falha, sem executar", async t => {
  t.mock.method(console, "log", () => {});
  for (const [perfil, texto] of [["pc-qualquer", /não suportado/], ["pc-hermes", /desligado/]]) {
    const { api, chamadas } = a13Falso({ "/api/worker/heartbeat": OK_HB, "/api/worker/claim": { status: 200, body: { task: { ...TAREFA, profile: perfil } } }, "/api/worker/result": { status: 200, body: {} } });
    await cycle(cfg, api, false);
    const r = chamadas.at(-1).body;
    assert.equal(r.ok, false); assert.match(r.error, texto);
  }
});

test("T85: prazo da tarefa: sem timeoutMs não vira NaN (setTimeout disparava na hora), e nunca abaixo de 60 s", () => {
  assert.equal(prazoMs({}), 270_000);
  assert.equal(prazoMs({ timeoutMs: "lixo" }), 270_000);
  assert.equal(prazoMs({ timeoutMs: 600_000 }), 570_000);
  assert.equal(prazoMs({ timeoutMs: 10_000 }), 60_000);
  assert.ok(Number.isFinite(prazoMs({ timeoutMs: null })));
});
