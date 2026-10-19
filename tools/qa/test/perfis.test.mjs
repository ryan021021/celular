// node --test "tools/qa/test/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validarPerfis, validar, PASTA_PERFIS, SCHEMA } from "../perfis.mjs";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
const bom = { id: "teste", name: "Aparelho de teste", brand: "Marca", serial: null, network: { ssh_port: 8022 } };

test("perfis reais: todos os profiles/*.json passam no schema", () => {
  const r = validarPerfis(PASTA_PERFIS, SCHEMA);
  assert.ok(r.length >= 4, "deveria achar os perfis reais");
  const ruins = r.filter(x => x.erros.length).map(x => `${x.arquivo}: ${x.erros.join("; ")}`);
  assert.deepEqual(ruins, []);
});

test("perfil quebrado falha: sem id, id com maiúscula, porta como texto e JSON inválido", () => {
  const pasta = mkdtempSync(join(tmpdir(), "perfis-"));
  try {
    writeFileSync(join(pasta, "sem_id.json"), JSON.stringify({ name: "X", brand: "Y" }));
    writeFileSync(join(pasta, "id_ruim.json"), JSON.stringify({ ...bom, id: "A15" }));
    writeFileSync(join(pasta, "porta_texto.json"), JSON.stringify({ ...bom, network: { ssh_port: "8022" } }));
    writeFileSync(join(pasta, "quebrado.json"), "{ isto não é json");
    writeFileSync(join(pasta, "bom.json"), JSON.stringify(bom));
    const r = Object.fromEntries(validarPerfis(pasta, SCHEMA).map(x => [x.arquivo, x.erros]));
    assert.match(r["sem_id.json"].join(), /id: obrigatório/);
    assert.match(r["id_ruim.json"].join(), /não bate com/);
    assert.match(r["porta_texto.json"].join(), /network\.ssh_port: esperado integer, veio string/);
    assert.match(r["quebrado.json"].join(), /JSON inválido/);
    assert.deepEqual(r["bom.json"], []);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("template com _ fica de fora e o serial null é aceito", () => {
  const pasta = mkdtempSync(join(tmpdir(), "perfis-"));
  try {
    copyFileSync(join(PASTA_PERFIS, "_template.json"), join(pasta, "_template.json"));
    writeFileSync(join(pasta, "serial_null.json"), JSON.stringify({ ...bom, serial: null }));
    const r = validarPerfis(pasta, SCHEMA);
    assert.deepEqual(r.map(x => x.arquivo), ["serial_null.json"]);
    assert.deepEqual(r[0].erros, []);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("validar: campo não previsto só falha quando additionalProperties é false", () => {
  assert.deepEqual(validar({ ...bom, extra: 1 }, schema), []);
  assert.match(validar({ ...bom, extra: 1 }, { ...schema, additionalProperties: false }).join(), /extra: campo não previsto/);
});
