import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { desbloquear, dependencias } from "../desbloquear.mjs";

// T129: despacho automático. BACKLOG vira READY só quando as dependências viraram DONE e a tarefa tem dono, critérios e porte (§13).
const CABECA = `# Registro de tarefas

| ID | Objetivo | Agente | Depende | Arquivos autorizados | Estado | Testes exigidos | Evidência | Pendências |
|---|---|---|---|---|---|---|---|---|`;
const linha = (id, o = {}) => `| ${id} | objetivo de ${id} | ${o.agente ?? "ORQ"} | ${o.dep ?? "—"} | \`x/${id}.mjs\` | ${o.estado ?? "BACKLOG"} | ${o.testes ?? "a falha sem a correção; b; c"} | ${o.evid ?? "—"} | ${o.pend ?? "porte: padrão"} |`;
const quadro = (...linhas) => `${CABECA}\n${linhas.join("\n")}\n`;
const estadoDe = (texto, id) => (texto.split("\n").find(l => l.startsWith(`| ${id} |`)) || "").split("|")[6]?.trim();

test("dependência DONE no quadro libera a tarefa (BACKLOG → READY)", () => {
  const r = desbloquear(quadro(linha("T1", { estado: "DONE" }), linha("T2", { dep: "T1" })), "");
  assert.deepEqual(r.liberadas, ["T2"]);
  assert.equal(estadoDe(r.texto, "T2"), "READY");
});

test("dependência que já está em TASKS_FEITAS também conta como DONE", () => {
  const feitas = quadro(linha("T1", { estado: "DONE" }));
  const r = desbloquear(quadro(linha("T2", { dep: "T1" })), feitas);
  assert.deepEqual(r.liberadas, ["T2"]);
});

test("dependência ainda aberta (REVIEW) não libera", () => {
  const r = desbloquear(quadro(linha("T1", { estado: "REVIEW" }), linha("T2", { dep: "T1" })), "");
  assert.deepEqual(r.liberadas, []);
  assert.equal(estadoDe(r.texto, "T2"), "BACKLOG");
  assert.match(r.retidas.find(x => x.id === "T2").motivo, /T1/);
});

test("com duas dependências, uma DONE e outra aberta, não libera", () => {
  const r = desbloquear(quadro(linha("T1", { estado: "DONE" }), linha("T3", { estado: "TESTING" }), linha("T2", { dep: "T1, T3" })), "");
  assert.deepEqual(r.liberadas, []);
  assert.match(r.retidas.find(x => x.id === "T2").motivo, /T3/);
});

test("dependência de ação humana em texto livre (físico, login do Ryan) não libera", () => {
  for (const dep of ["físico", "login do Ryan", "T1 e aprovação do Ryan"]) {
    const r = desbloquear(quadro(linha("T1", { estado: "DONE" }), linha("T2", { dep })), "");
    assert.deepEqual(r.liberadas, [], `liberou com a dependência "${dep}"`);
  }
});

test("dependência que não existe no quadro não libera", () => {
  const r = desbloquear(quadro(linha("T2", { dep: "T999" })), "");
  assert.deepEqual(r.liberadas, []);
  assert.match(r.retidas[0].motivo, /T999/);
});

test("tarefa sem critérios de aceite não vai para READY", () => {
  for (const testes of ["—", "-", "", "  "]) {
    const r = desbloquear(quadro(linha("T2", { testes })), "");
    assert.deepEqual(r.liberadas, [], `liberou com critérios "${testes}"`);
    assert.match(r.retidas[0].motivo, /crit[ée]rios/);
  }
});

test("tarefa sem porte nem dono não vai para READY", () => {
  assert.deepEqual(desbloquear(quadro(linha("T2", { pend: "—" })), "").liberadas, []);
  assert.deepEqual(desbloquear(quadro(linha("T2", { agente: "" })), "").liberadas, []);
});

test("sem dependência (—) e com critérios, dono e porte: libera", () => {
  assert.deepEqual(desbloquear(quadro(linha("T2")), "").liberadas, ["T2"]);
});

test("só mexe em BACKLOG: BLOCKED, REVIEW e DONE ficam como estão", () => {
  const q = quadro(linha("T1", { estado: "BLOCKED" }), linha("T2", { estado: "REVIEW" }), linha("T3", { estado: "IN_PROGRESS" }));
  const r = desbloquear(q, "");
  assert.deepEqual(r.liberadas, []);
  assert.equal(r.texto, q);
});

test("muda só a célula Estado: o resto da linha e das outras linhas fica igual", () => {
  const q = quadro(linha("T1", { estado: "DONE", evid: "tem `crase` e texto" }), linha("T2", { dep: "T1" }));
  const r = desbloquear(q, "");
  const antes = q.split("\n"), depois = r.texto.split("\n");
  assert.equal(antes.length, depois.length);
  const mudadas = antes.map((l, i) => i).filter(i => antes[i] !== depois[i]);
  assert.equal(mudadas.length, 1);
  assert.equal(depois[mudadas[0]], antes[mudadas[0]].replace("| BACKLOG |", "| READY |"));
});

test("é idempotente: a segunda rodada não libera mais nada", () => {
  const q = quadro(linha("T1", { estado: "DONE" }), linha("T2", { dep: "T1" }));
  const um = desbloquear(q, "");
  const dois = desbloquear(um.texto, "");
  assert.deepEqual(dois.liberadas, []);
  assert.equal(dois.texto, um.texto);
});

test("preserva fim de linha CRLF", () => {
  const q = quadro(linha("T1", { estado: "DONE" }), linha("T2", { dep: "T1" })).replace(/\n/g, "\r\n");
  const r = desbloquear(q, "");
  assert.equal(r.texto, q.replace("| BACKLOG |", "| READY |"));
});

test("dependencias(): separa ids de texto livre", () => {
  assert.deepEqual(dependencias("T96, T103"), { ids: ["T96", "T103"], livre: "" });
  assert.deepEqual(dependencias("T96 e T103"), { ids: ["T96", "T103"], livre: "" });
  assert.deepEqual(dependencias("—"), { ids: [], livre: "" });
  assert.deepEqual(dependencias("físico"), { ids: [], livre: "físico" });
  assert.equal(dependencias("T1 e aprovação do Ryan").livre, "aprovação do Ryan");
});

// ---- linha de comando: simulação por padrão, escreve só com --aplicar ----
const CLI = fileURLToPath(new URL("../desbloquear.mjs", import.meta.url));
function cli(args, textoQuadro) {
  const raiz = mkdtempSync(join(tmpdir(), "desbloquear-"));
  mkdirSync(join(raiz, ".collab"));
  writeFileSync(join(raiz, ".collab", "TASKS.md"), textoQuadro);
  writeFileSync(join(raiz, ".collab", "TASKS_FEITAS.md"), CABECA + "\n");
  const r = spawnSync(process.execPath, [CLI, "--raiz", raiz, ...args], { encoding: "utf8", windowsHide: true });
  const depois = readFileSync(join(raiz, ".collab", "TASKS.md"), "utf8");
  rmSync(raiz, { recursive: true, force: true });
  return { ...r, depois };
}
const Q = quadro(linha("T1", { estado: "DONE" }), linha("T2", { dep: "T1" }));

test("CLI sem --aplicar só simula: lista a tarefa e não grava", () => {
  const r = cli([], Q);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /T2/);
  assert.equal(r.depois, Q);
});

test("CLI com --aplicar grava READY no TASKS.md", () => {
  const r = cli(["--aplicar"], Q);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(estadoDe(r.depois, "T2"), "READY");
});

test("CLI sem nada a liberar não regrava o arquivo e diz isso", () => {
  const sem = quadro(linha("T2", { dep: "T9" }));
  const r = cli(["--aplicar"], sem);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.depois, sem);
  assert.match(r.stdout, /nada/i);
});
