import test from "node:test";
import assert from "node:assert/strict";
import { SCRIPT_CAPACIDADES, lerLinhasCapacidades, itemCapacidades, textoContagem } from "../capacidades.mjs";
import { execFileSync } from "node:child_process";

// Token falso: não pode aparecer em nenhuma saída, nem no script, nem no item.
const TOKEN_FALSO = "TOKEN-FALSO-0123456789ABCDEFGHIJ";

const CAPS_14 = Array.from({ length: 14 }, (_, i) => ({
  capability_id: `cap.${i}`,
  status: i < 9 ? "available" : i < 11 ? "limited" : i === 11 ? "UNSUPPORTED_HERE" : i === 12 ? "UNKNOWN" : "blocked",
}));
const linhaJson = (obj) => `CAPS_JSON ${JSON.stringify(obj)}`;

test("script no aparelho: lê o token do arquivo e manda pelo stdin do curl, sem o valor no script", () => {
  assert.match(SCRIPT_CAPACIDADES, /painel\.token/);
  assert.match(SCRIPT_CAPACIDADES, /curl -s -K -/);
  assert.match(SCRIPT_CAPACIDADES, /http:\/\/127\.0\.0\.1:8080\/api\/v1\/capabilities/);
  assert.doesNotMatch(SCRIPT_CAPACIDADES, new RegExp(TOKEN_FALSO));
  assert.doesNotMatch(SCRIPT_CAPACIDADES, /curl[^\n]*-H/); // nada de cabeçalho em argumento de curl
});

test("script no aparelho passa em sh -n", () => {
  execFileSync("sh", ["-n", "-c", SCRIPT_CAPACIDADES]);
});

test("200 com 14 itens: valor 14 em itens, contagem por status e estado ok", () => {
  const saida = `CAPS_HTTP 200\n${linhaJson({ ok: true, capabilities: CAPS_14 })}`;
  const it = itemCapacidades(saida);
  assert.equal(it.estado, "ok");
  assert.equal(it.valor, 14);
  assert.equal(it.unidade, "itens");
  assert.deepEqual(it.contagem, { available: 9, limited: 2, UNSUPPORTED_HERE: 1, UNKNOWN: 1, blocked: 1 });
  assert.equal(textoContagem(it.contagem), "available 9 · limited 2 · UNSUPPORTED_HERE 1 · UNKNOWN 1 · blocked 1");
  assert.match(it.fonte, /token lido de ~\/servidor\/painel\.token/);
});

test("sem token no aparelho: N/D com motivo, sem valor", () => {
  const it = itemCapacidades("CAPS_SEM_TOKEN");
  assert.equal(it.estado, "unknown");
  assert.equal(it.valor, null);
  assert.match(it.motivo, /sem ~\/servidor\/painel\.token/);
});

test("sem curl no aparelho: N/D com motivo", () => {
  assert.match(itemCapacidades("CAPS_SEM_CURL").motivo, /curl ausente/);
});

test("token recusado (401/403) é aviso e não ecoa o token", () => {
  for (const http of [401, 403]) {
    const it = itemCapacidades(`CAPS_HTTP ${http}\nCAPS_JSON {"ok":false}`);
    assert.equal(it.estado, "aviso");
    assert.match(it.motivo, /token recusado/);
    assert.equal(JSON.stringify(it).includes(TOKEN_FALSO), false);
  }
});

test("404 é N/D (painel antigo); 503 e outros códigos são aviso; sem resposta é N/D", () => {
  assert.equal(itemCapacidades("CAPS_HTTP 404\nCAPS_JSON ").estado, "unknown");
  assert.equal(itemCapacidades("CAPS_HTTP 503\nCAPS_JSON {}").estado, "aviso");
  assert.equal(itemCapacidades("CAPS_HTTP 500\nCAPS_JSON {}").estado, "aviso");
  assert.equal(itemCapacidades("CAPS_HTTP \nCAPS_JSON ").estado, "unknown");
});

test("resposta ilegível, sem lista ou lista vazia viram aviso, nunca valor inventado", () => {
  assert.match(itemCapacidades("CAPS_HTTP 200\nCAPS_JSON {ruim").motivo, /ilegível/);
  assert.match(itemCapacidades(`CAPS_HTTP 200\n${linhaJson({ ok: true })}`).motivo, /sem a lista/);
  const vazia = itemCapacidades(`CAPS_HTTP 200\n${linhaJson({ capabilities: [] })}`);
  assert.equal(vazia.estado, "aviso");
  assert.equal(vazia.valor, null);
});

test("lerLinhasCapacidades ignora linhas estranhas e não guarda nada além do necessário", () => {
  const r = lerLinhasCapacidades(`lixo\nCAPS_HTTP 200\n${linhaJson({ capabilities: [] })}\nSERVICO x run:`);
  assert.equal(r.http, 200);
  assert.equal(r.semToken, false);
  assert.deepEqual(Object.keys(r).sort(), ["corpo", "http", "semCurl", "semToken"]);
});
