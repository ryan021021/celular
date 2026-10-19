import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticar, interpretarSaidaSsh, formatarTexto } from "../diag.mjs";

// Rodar com: node --test tools/diag/test/diag.test.mjs  (respostas falsas: nada é consultado de verdade)
const AGORA = 1_800_000_000_000;
const perfil = { id: "a15", network: { ip: "192.168.1.164", ssh_port: 8022, ssh_user: "u0_a304", ssh_key: "~/.ssh/id_ed25519" } };

// Painel falso: status por caminho; "ERRO" simula sem resposta (fetch lança)
const painel = (mapa = {}) => async url => {
  const caminho = Object.keys({ "/health": 1, "/ready": 1, "/api/v1/capabilities": 1 }).find(p => url.endsWith(p));
  const st = mapa[caminho] ?? 200;
  if (st === "ERRO") throw new TypeError("fetch failed");
  return { status: st };
};

const SAIDA_OK = (over = {}) => [
  "SERVICO agentops run: agentops: (pid 1) 90s",
  "SERVICO alertas run: alertas: (pid 2) 80s",
  `DISCO ${over.disco ?? 5_000_000}`,
  over.bateria === undefined ? "BATERIA 80" : over.bateria === null ? "BATERIA " : `BATERIA ${over.bateria}`,
  over.backup === undefined ? `BACKUP {"at": ${AGORA - 3 * 3600_000}, "file": "a15-x.tar.gz.enc", "files": 3}` : over.backup === null ? "BACKUP " : `BACKUP ${over.backup}`,
].join("\n");

const ssh = (saida, erro = null) => async () => (erro ? { ok: false, erro } : { ok: true, saida });
const porId = (rel, id) => rel.itens.find(i => i.id === id);

test("tudo certo: código 0, e cada item traz valor, fonte e estado", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel({ "/ready": 200, "/api/v1/capabilities": 200 }), sshFn: ssh(SAIDA_OK()), agora: () => AGORA });
  assert.equal(rel.codigo, 0);
  assert.equal(porId(rel, "health").estado, "ok");
  assert.equal(porId(rel, "disco").valor, 4883);
  assert.equal(porId(rel, "bateria").valor, 80);
  assert.equal(porId(rel, "backup").valor.horas, 3);
  for (const i of rel.itens) {
    assert.ok(typeof i.fonte === "string" && i.fonte.length > 0, `${i.id} sem fonte`);
    assert.ok(["ok", "aviso", "falha", "unknown"].includes(i.estado), i.id);
  }
});

test("disco entre 256 MB e 1 GB é aviso (código 1)", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ disco: 500 * 1024 })), agora: () => AGORA });
  assert.equal(porId(rel, "disco").estado, "aviso");
  assert.match(porId(rel, "disco").motivo, /1024 MB/);
  assert.equal(rel.codigo, 1);
});

test("disco abaixo de 256 MB é falha (código 2)", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ disco: 100 * 1024 })), agora: () => AGORA });
  assert.equal(porId(rel, "disco").estado, "falha");
  assert.equal(rel.codigo, 2);
});

test("serviço fora de run: é aviso e o nome aparece no motivo", async () => {
  const saida = SAIDA_OK().replace("SERVICO alertas run: alertas: (pid 2) 80s", "SERVICO alertas down: alertas: 5s");
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(saida), agora: () => AGORA });
  assert.equal(porId(rel, "servicos").estado, "aviso");
  assert.match(porId(rel, "servicos").motivo, /alertas/);
  assert.equal(rel.codigo, 1);
});

test("painel respondendo 500 em /health é falha (código 2)", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel({ "/health": 500 }), sshFn: ssh(SAIDA_OK()), agora: () => AGORA });
  assert.equal(porId(rel, "health").estado, "falha");
  assert.equal(rel.codigo, 2);
});

test("painel sem resposta é falha, sem inventar valor", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel({ "/health": "ERRO" }), sshFn: ssh(SAIDA_OK()), agora: () => AGORA });
  const h = porId(rel, "health");
  assert.equal(h.estado, "falha");
  assert.equal(h.valor, null);
  assert.equal(rel.codigo, 2);
});

test("ready e capabilities ausentes (404) ficam unknown com motivo e não mudam o código", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel({ "/ready": 404, "/api/v1/capabilities": 404 }), sshFn: ssh(SAIDA_OK()), agora: () => AGORA });
  assert.equal(porId(rel, "ready").estado, "unknown");
  assert.match(porId(rel, "ready").motivo, /endpoint ausente/);
  assert.equal(porId(rel, "capabilities").estado, "unknown");
  assert.equal(rel.codigo, 0);
});

test("SSH fora do ar: serviços, disco e backup viram unknown obrigatório (código 1), nunca ok", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(null, "tempo esgotado no SSH"), agora: () => AGORA });
  for (const id of ["servicos", "disco", "backup"]) {
    assert.equal(porId(rel, id).estado, "unknown", id);
    assert.equal(porId(rel, id).valor, null, id);
    assert.match(porId(rel, id).motivo, /tempo esgotado/);
  }
  assert.equal(rel.codigo, 1);
});

test("backup com mais de 48 h é aviso", async () => {
  const velho = `{"at": ${AGORA - 72 * 3600_000}, "file": "a15-old.tar.gz.enc", "files": 3}`;
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ backup: velho })), agora: () => AGORA });
  assert.equal(porId(rel, "backup").estado, "aviso");
  assert.equal(porId(rel, "backup").valor.horas, 72);
  assert.equal(rel.codigo, 1);
});

test("nenhum backup registrado é aviso; marcador ilegível também", async () => {
  const sem = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ backup: null })), agora: () => AGORA });
  assert.equal(porId(sem, "backup").estado, "aviso");
  assert.match(porId(sem, "backup").motivo, /nenhum backup/);
  const ruim = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ backup: "{quebrado" })), agora: () => AGORA });
  assert.match(porId(ruim, "backup").motivo, /ilegível/);
});

test("bateria não medida é unknown e não muda o código", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ bateria: null })), agora: () => AGORA });
  assert.equal(porId(rel, "bateria").estado, "unknown");
  assert.equal(rel.codigo, 0);
});

test("bateria baixa é aviso", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ bateria: 12 })), agora: () => AGORA });
  assert.equal(porId(rel, "bateria").estado, "aviso");
  assert.equal(rel.codigo, 1);
});

test("sem --perfil: serviços, disco e backup não medidos, código 1 (nada é inventado)", async () => {
  const rel = await diagnosticar({ perfil: null, fetchFn: painel(), agora: () => AGORA });
  assert.equal(porId(rel, "disco").estado, "unknown");
  assert.match(porId(rel, "disco").motivo, /sem --perfil/);
  assert.equal(rel.codigo, 1);
  assert.equal(rel.alvo, "local");
});

test("saída em texto mostra cada item com fonte e o resultado final", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel({ "/ready": 404 }), sshFn: ssh(SAIDA_OK()), agora: () => AGORA });
  const texto = formatarTexto(rel);
  assert.match(texto, /\[OK\] health: 200/);
  assert.match(texto, /fonte: HTTP GET http:\/\/192\.168\.1\.164:8080\/health/);
  assert.match(texto, /\[N\/D\] ready: —/);
  assert.match(texto, /Resultado: ok \(código 0\)/);
});

test("saída em JSON é o relatório inteiro, com código e itens", async () => {
  const rel = await diagnosticar({ perfil, fetchFn: painel(), sshFn: ssh(SAIDA_OK({ disco: 500 * 1024 })), agora: () => AGORA });
  const j = JSON.parse(JSON.stringify(rel, null, 2));
  assert.equal(j.codigo, 1);
  assert.equal(j.alvo, "a15");
  assert.equal(j.itens.length, 7); // health, ready, capabilities + servicos, disco, bateria, backup
  for (const i of j.itens) assert.ok(i.fonte, i.id);
});

test("interpretarSaidaSsh lê disco em KB, bateria e backup, e ignora linhas estranhas", () => {
  const r = interpretarSaidaSsh("lixo\nDISCO 2048\nBATERIA 55\nBACKUP {\"at\": 1}\n");
  assert.equal(r.disco, 2);
  assert.equal(r.bateria, 55);
  assert.equal(r.backup, '{"at": 1}');
  assert.deepEqual(r.servicos, []);
});
