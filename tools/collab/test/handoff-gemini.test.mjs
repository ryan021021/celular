import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { handoff } from "../handoff-gemini.mjs";

// T129: handoff pronto para colar no Gemini (§13): objetivo, critérios de aceite, arquivos, teste que falha e comando de entrega.
const CABECA = `| ID | Objetivo | Agente | Depende | Arquivos autorizados | Estado | Testes exigidos | Evidência | Pendências |
|---|---|---|---|---|---|---|---|---|`;
const CRITERIOS = "falha com valor sem fonte; sai 1 sem aparelho; mostra o percentual";
const LINHA = `| T50 | Ler a bateria do aparelho sem tocar nele | GEM-IDE-1 | — | \`tools/bat/ler.mjs\`, \`tools/bat/test/**\` | READY | ${CRITERIOS} | — | porte: padrão |`;
const quadro = (...l) => `${CABECA}\n${l.join("\n")}\n`;

function comRaiz(f) {
  const raiz = mkdtempSync(join(tmpdir(), "handoff-"));
  try { return f(raiz); } finally { rmSync(raiz, { recursive: true, force: true }); }
}
const secao = (texto, titulo) => {
  const m = texto.match(new RegExp(`^## ${titulo}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : null;
};

test("o handoff traz as cinco seções, cada uma com o conteúdo certo", () => comRaiz(raiz => {
  const r = handoff("T50", quadro(LINHA), "", raiz);
  assert.equal(r.ok, true, r.erro);
  for (const t of ["Objetivo", "Crit[ée]rios de aceite", "Arquivos autorizados", "Teste que falha", "Comando de entrega"]) {
    assert.ok(secao(r.texto, t), `falta a seção "${t}" ou está vazia`);
  }
}));

test("campo objetivo: vem da coluna Objetivo", () => comRaiz(raiz => {
  const r = handoff("T50", quadro(LINHA), "", raiz);
  assert.match(secao(r.texto, "Objetivo"), /Ler a bateria do aparelho sem tocar nele/);
}));

test("campo critérios: um item por critério da coluna Testes exigidos", () => comRaiz(raiz => {
  const itens = secao(handoff("T50", quadro(LINHA), "", raiz).texto, "Crit[ée]rios de aceite").split("\n").filter(l => /^- /.test(l));
  assert.deepEqual(itens.map(l => l.replace(/^- (\[ \] )?/, "")), ["falha com valor sem fonte", "sai 1 sem aparelho", "mostra o percentual"]);
}));

test("campo arquivos: lista cada arquivo autorizado", () => comRaiz(raiz => {
  const s = secao(handoff("T50", quadro(LINHA), "", raiz).texto, "Arquivos autorizados");
  assert.match(s, /`tools\/bat\/ler\.mjs`/);
  assert.match(s, /`tools\/bat\/test\/\*\*`/);
}));

test("campo comando de entrega: usa o id da tarefa", () => comRaiz(raiz => {
  assert.match(secao(handoff("T50", quadro(LINHA), "", raiz).texto, "Comando de entrega"), /node tools\/qa\/entrega\.mjs T50/);
}));

test("campo teste que falha: aponta o teste já escrito no disco", () => comRaiz(raiz => {
  mkdirSync(join(raiz, "tools", "bat", "test"), { recursive: true });
  writeFileSync(join(raiz, "tools", "bat", "test", "ler.test.mjs"), "// teste\n");
  writeFileSync(join(raiz, "tools", "bat", "test", "ajuda.mjs"), "// auxiliar, não é teste\n");
  writeFileSync(join(raiz, "tools", "bat", "ler.mjs"), "// código, não é teste\n");
  const r = handoff("T50", quadro(LINHA), "", raiz);
  const s = secao(r.texto, "Teste que falha");
  assert.match(s, /tools\/bat\/test\/ler\.test\.mjs/);
  assert.ok(!/ajuda\.mjs/.test(s), "listou um arquivo auxiliar como teste");
  assert.ok(!/tools\/bat\/ler\.mjs/.test(s), "listou o código como teste");
  assert.ok(!/AVISO/.test(r.texto), "avisou que falta teste, mas ele existe");
}));

test("sem teste escrito: avisa que o Claude precisa escrever antes (§13), mas gera o handoff", () => comRaiz(raiz => {
  const r = handoff("T50", quadro(LINHA), "", raiz);
  assert.equal(r.ok, true);
  assert.match(r.texto, /AVISO.*teste/is);
  assert.match(secao(r.texto, "Teste que falha"), /n[ãa]o (foi )?escrito|nenhum/i);
}));

test("tarefa sem critérios de aceite não gera handoff", () => comRaiz(raiz => {
  const semCriterio = LINHA.replace(CRITERIOS, "—");
  const r = handoff("T50", quadro(semCriterio), "", raiz);
  assert.equal(r.ok, false);
  assert.match(r.erro, /crit[ée]rios/);
  assert.equal(r.texto, undefined);
}));

test("tarefa que não existe dá erro claro", () => comRaiz(raiz => {
  const r = handoff("T999", quadro(LINHA), "", raiz);
  assert.equal(r.ok, false);
  assert.match(r.erro, /T999/);
}));

test("lembra as regras do Gemini: valor sem fonte vira BLOCKED e entrega PASS no LOG", () => comRaiz(raiz => {
  const r = handoff("T50", quadro(LINHA), "", raiz);
  assert.match(r.texto, /BLOCKED/);
  assert.match(r.texto, /LOG/);
}));

test("acha a tarefa também em TASKS_FEITAS", () => comRaiz(raiz => {
  const r = handoff("T50", quadro("| T1 | x | ORQ | — | `a` | DONE | a | — | — |"), quadro(LINHA), raiz);
  assert.equal(r.ok, true, r.erro);
}));

// ---- linha de comando ----
const CLI = fileURLToPath(new URL("../handoff-gemini.mjs", import.meta.url));
function cli(args, textoQuadro) {
  const raiz = mkdtempSync(join(tmpdir(), "handoff-cli-"));
  mkdirSync(join(raiz, ".collab"));
  writeFileSync(join(raiz, ".collab", "TASKS.md"), textoQuadro);
  writeFileSync(join(raiz, ".collab", "TASKS_FEITAS.md"), CABECA + "\n");
  try { return spawnSync(process.execPath, [CLI, "--raiz", raiz, ...args], { encoding: "utf8", windowsHide: true }); }
  finally { rmSync(raiz, { recursive: true, force: true }); }
}

test("CLI imprime o handoff no stdout e sai 0", () => {
  const r = cli(["T50"], quadro(LINHA));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /## Objetivo/);
});

test("CLI sem critérios sai 1 e explica no stderr", () => {
  const r = cli(["T50"], quadro(LINHA.replace(CRITERIOS, "—")));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /crit[ée]rios/);
  assert.equal(r.stdout, "");
});

test("CLI sem id ou com tarefa inexistente sai 2", () => {
  assert.equal(cli([], quadro(LINHA)).status, 2);
  assert.equal(cli(["T999"], quadro(LINHA)).status, 2);
});
