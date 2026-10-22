// T75: liga a leitura de capabilities COM token (via SSH, curl no aparelho) ao diag.mjs.
// Mutação mental (6): se o item capabilities sair do fluxo SSH (itensSsh/diagnosticar deixar de chamar
// itemCapacidades(saida)), o teste 1 morre (item cai no ramo HTTP sem token) e o 2 também (fetchFn é chamado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diagnosticar, formatarTexto, SCRIPT_DIAG } from "../diag.mjs";
import { SCRIPT_CAPACIDADES } from "../capacidades.mjs";

const TOKEN_TESTE = "tok-SECRETO-123456";
const perfil = { id: "a15", network: { ip: "192.0.2.10", ssh_user: "u0_a1", ssh_key: "~/k", ssh_port: 8022 } };
const agora = () => 1_700_000_000_000;

const lista14 = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, status: i < 9 ? "available" : i < 12 ? "limited" : "unavailable" }));
const saidaSsh = [
  "SERVICO painel run: (pid 1) 10s", "DISCO 4194304", "BATERIA_TERMUX_AUSENTE",
  `BACKUP ${JSON.stringify({ at: agora(), file: "b.tgz" })}`,
  "CAPS_HTTP 200", `CAPS_JSON ${JSON.stringify({ capabilities: lista14 })}`,
].join("\n");

const fetchOk = (chamadas) => async (url) => { chamadas.push(url); return { status: 200 }; };
const sshFalso = async () => ({ ok: true, saida: saidaSsh });

test("diagnosticar com SSH falso produz capabilities=14, ok e contagem por status", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: fetchOk([]), sshFn: sshFalso, agora });
  const caps = rel.itens.filter(i => i.id === "capabilities");
  assert.equal(caps.length, 1);
  assert.equal(caps[0].valor, 14);
  assert.equal(caps[0].estado, "ok");
  assert.deepEqual(caps[0].contagem, { available: 9, limited: 3, unavailable: 2 });
});

test("capabilities vem da saída SSH: fetchFn nunca é chamado para /api/v1/capabilities", async () => {
  const chamadas = [];
  await diagnosticar({ perfil, fetchFn: fetchOk(chamadas), sshFn: sshFalso, agora });
  assert.ok(chamadas.length > 0, "health/ready ainda usam fetchFn");
  assert.deepEqual(chamadas.filter(u => u.includes("/api/v1/capabilities")), []);
});

test("formatarTexto mostra '14 itens' e a contagem por status na linha de capabilities", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: fetchOk([]), sshFn: sshFalso, agora });
  const linha = formatarTexto(rel).split("\n").find(l => l.includes("capabilities:"));
  assert.ok(linha, "linha capabilities existe");
  assert.match(linha, /14 itens/);
  assert.match(linha, /available 9 · limited 3 · unavailable 2/);
});

test("sem --perfil, capabilities fica unknown com motivo e sem chamar fetchFn nela", async () => {
  const chamadas = [];
  const rel = await diagnosticar({ perfil: null, fetchFn: fetchOk(chamadas), agora });
  const caps = rel.itens.find(i => i.id === "capabilities");
  assert.ok(caps);
  assert.equal(caps.estado, "unknown");
  assert.equal(caps.valor, null);
  assert.ok(caps.motivo && caps.motivo.length > 0);
  assert.deepEqual(chamadas.filter(u => u.includes("/api/v1/capabilities")), []);
});

test("token nunca vai ao argv do ssh: script (com capacidades) vai pelo stdin e args não têm token/Bearer", () => {
  const fonte = readFileSync(fileURLToPath(new URL("../diag.mjs", import.meta.url)), "utf8");
  const args = fonte.match(/const args = \[[\s\S]*?\];/)[0];
  assert.doesNotMatch(args, /Bearer|token|SCRIPT_/i);
  assert.match(args, /"sh -s"/);
  // o que o ssh recebe no stdin tem de incluir o trecho de capacidades, e o trecho não carrega o valor do token
  const stdin = fonte.match(/p\.stdin\.end\(([^)]*)\)/)[1];
  assert.match(stdin, /SCRIPT_CAPACIDADES/);
  assert.ok(!SCRIPT_DIAG.includes(TOKEN_TESTE) && !SCRIPT_CAPACIDADES.includes(TOKEN_TESTE));
});

test("relatório e texto não contêm o token nem 'Bearer'", async () => {
  const sujo = async () => ({ ok: true, saida: saidaSsh });
  const rel = await diagnosticar({ perfil, fetchFn: fetchOk([]), sshFn: sujo, agora });
  const tudo = JSON.stringify(rel) + formatarTexto(rel);
  assert.ok(!tudo.includes(TOKEN_TESTE));
  assert.doesNotMatch(tudo, /Bearer/);
});
