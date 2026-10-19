import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, migrateState, SCHEMA_VERSION } from "../core.mjs";

// T73 (P1 R11): schema_version no state.json + migração v0→v1 idempotente no carregamento.
// Rodar com: node --test server/agentops/test/migracao.test.mjs  (pasta temporária; nada no aparelho)
const pasta = () => mkdtempSync(join(tmpdir(), "agentops-mig-"));
const arquivos = (dir, sufixo) => readdirSync(dir).filter(f => f.includes(sufixo));
const TAREFA = { id: "t1", profile: "bom", prompt: "x", priority: 5, status: "queued", attempts: 0, createdAt: 1 };
const V0 = { paused: true, tasks: [TAREFA], agents: { pc: { lastSeen: 5 } } }; // formato de antes da T73: sem schema_version

test("arquivo sem versão (v0) migra para v1, mantém os dados e guarda o original", () => {
  const dir = pasta();
  const original = JSON.stringify(V0);
  writeFileSync(join(dir, "state.json"), original);
  const logs = [];
  const s = createStore(dir, { now: () => 1000, log: m => logs.push(m) });

  assert.deepEqual(s.migrated, { from: 0, to: 1, backup: join(dir, "state.json.v0-1000.bak") });
  assert.equal(s.state.schema_version, SCHEMA_VERSION);
  assert.equal(s.state.paused, true);
  assert.deepEqual(s.state.tasks, [TAREFA]);
  assert.deepEqual(s.state.agents, { pc: { lastSeen: 5 } });
  // o original ficou intacto ao lado, byte a byte
  assert.equal(readFileSync(s.migrated.backup, "utf8"), original);
  // e o state.json em disco já está na v1
  assert.equal(JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).schema_version, 1);
  assert.match(logs.join("\n"), /migrado v0 -> v1/);
  assert.match(readFileSync(join(dir, "events.jsonl"), "utf8"), /state\.migrated/);
});

test("já migrado não muda: reabrir não regrava, não cria backup e não perde nada", () => {
  const dir = pasta();
  writeFileSync(join(dir, "state.json"), JSON.stringify(V0));
  createStore(dir, { now: () => 1000, log: () => {} });
  const depoisDaMigracao = readFileSync(join(dir, "state.json"), "utf8");

  const s2 = createStore(dir, { now: () => 2000, log: () => {} });
  assert.equal(s2.migrated, null);
  assert.equal(readFileSync(join(dir, "state.json"), "utf8"), depoisDaMigracao, "state.json mudou na segunda abertura");
  assert.equal(arquivos(dir, ".bak").length, 1, "criou outro backup");
  assert.deepEqual(s2.state.tasks, [TAREFA]);

  const s3 = createStore(dir, { now: () => 3000, log: () => {} });
  assert.equal(s3.migrated, null);
  assert.equal(readFileSync(join(dir, "state.json"), "utf8"), depoisDaMigracao);
});

test("arquivo corrompido não perde o original: fica guardado, nada é migrado nem sobrescrito", () => {
  const dir = pasta();
  writeFileSync(join(dir, "state.json"), '{"paused": true, "tasks": [');
  const s = createStore(dir, { log: () => {} });
  assert.equal(s.migrated, null);
  assert.equal(readFileSync(s.corrupted, "utf8"), '{"paused": true, "tasks": [');
  assert.equal(arquivos(dir, ".bak").length, 0);
  assert.equal(s.state.schema_version, SCHEMA_VERSION); // a fila nova já nasce versionada
  assert.deepEqual(s.state.tasks, []);
});

test("formatos impossíveis (lista, tasks que não é lista) também são guardados, não migrados", () => {
  for (const texto of ["[]", "null", "42", '{"tasks": "x"}', '{"agents": []}', '{"schema_version": "1"}']) {
    const dir = pasta();
    writeFileSync(join(dir, "state.json"), texto);
    const s = createStore(dir, { log: () => {} });
    assert.ok(s.corrupted, `não guardou: ${texto}`);
    assert.equal(readFileSync(s.corrupted, "utf8"), texto);
    assert.equal(s.migrated, null);
  }
});

test("arquivo de versão mais nova é guardado e nunca rebaixado em silêncio", () => {
  const dir = pasta();
  const futuro = JSON.stringify({ schema_version: 2, paused: false, tasks: [TAREFA], agents: {}, novidade: 1 });
  writeFileSync(join(dir, "state.json"), futuro);
  const logs = [];
  const s = createStore(dir, { log: m => logs.push(m) });
  assert.equal(readFileSync(s.corrupted, "utf8"), futuro);
  assert.match(logs.join("\n"), /versão mais nova/);
  assert.equal(s.migrated, null);
});

test("sem arquivo: a fila nasce em v1 e save() grava a versão", () => {
  const dir = pasta();
  const s = createStore(dir, { log: () => {} });
  assert.equal(s.migrated, null);
  s.save();
  assert.equal(JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).schema_version, 1);
  assert.equal(arquivos(dir, ".bak").length, 0);
});

test("v0 incompleto (só {}) ganha paused/tasks/agents na migração; campos extras sobrevivem", () => {
  const dir = pasta();
  writeFileSync(join(dir, "state.json"), '{"extra": 7}');
  const s = createStore(dir, { log: () => {} });
  assert.equal(s.state.paused, false);
  assert.deepEqual(s.state.tasks, []);
  assert.deepEqual(s.state.agents, {});
  assert.equal(s.state.extra, 7);
});

test("migrateState é pura e idempotente: aplicar duas vezes dá o mesmo resultado", () => {
  const uma = migrateState(V0);
  assert.equal(uma.from, 0);
  const duas = migrateState(uma.state);
  assert.equal(duas.from, 1);
  assert.deepEqual(duas.state, uma.state);
  assert.equal(V0.schema_version, undefined, "alterou o objeto de entrada");
});

test("tarefa criada depois da migração é gravada no arquivo versionado", () => {
  const dir = pasta();
  writeFileSync(join(dir, "state.json"), JSON.stringify(V0));
  const s = createStore(dir, { log: () => {} });
  s.add("bom", { maxAttempts: 3 }, "nova", 5);
  const em_disco = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.equal(em_disco.schema_version, 1);
  assert.equal(em_disco.tasks.length, 2);
});
