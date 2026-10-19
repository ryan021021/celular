// tools/qa/perfis.mjs — Valida profiles/*.json contra profiles/schema.json (T70, P1 R7).
// Sem dependências: implementa só o subconjunto de JSON Schema que o schema.json usa.
//   node tools/qa/perfis.mjs            -> valida a pasta profiles/; saída 0 = todos válidos, 1 = algum inválido
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PASTA_PERFIS = join(ROOT, "profiles");
export const SCHEMA = join(PASTA_PERFIS, "schema.json");

const tipoDe = v => v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;

/** Devolve a lista de erros ("caminho: mensagem") de `valor` contra `schema`. Lista vazia = válido. */
export function validar(valor, schema, caminho = "") {
  const erros = [];
  const onde = caminho || "(raiz)";
  if (schema.type) {
    const tipos = [].concat(schema.type);
    const t = tipoDe(valor);
    const ok = tipos.some(x => x === t || (x === "number" && t === "integer"));
    if (!ok) return [`${onde}: esperado ${tipos.join(" ou ")}, veio ${t}`];
  }
  if (typeof valor === "string") {
    if (schema.minLength && valor.length < schema.minLength) erros.push(`${onde}: vazio (mínimo ${schema.minLength} caractere)`);
    if (schema.pattern && !new RegExp(schema.pattern).test(valor)) erros.push(`${onde}: "${valor}" não bate com ${schema.pattern}`);
  }
  if (schema.enum && !schema.enum.includes(valor)) erros.push(`${onde}: valor fora de ${JSON.stringify(schema.enum)}`);
  if (tipoDe(valor) === "object") {
    for (const k of schema.required || []) if (!(k in valor)) erros.push(`${caminho ? caminho + "." : ""}${k}: obrigatório`);
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in valor) erros.push(...validar(valor[k], sub, caminho ? `${caminho}.${k}` : k));
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(valor)) if (!(k in (schema.properties || {}))) erros.push(`${caminho ? caminho + "." : ""}${k}: campo não previsto`);
    }
  }
  if (Array.isArray(valor) && schema.items) valor.forEach((x, i) => erros.push(...validar(x, schema.items, `${onde}[${i}]`)));
  return erros;
}

/** Valida cada *.json da pasta (exceto os que começam com _ e o próprio schema). */
export function validarPerfis(pasta = PASTA_PERFIS, schemaPath = SCHEMA) {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const arquivos = readdirSync(pasta).filter(f => f.endsWith(".json") && !f.startsWith("_") && f !== "schema.json").sort();
  return arquivos.map(arquivo => {
    let erros;
    try { erros = validar(JSON.parse(readFileSync(join(pasta, arquivo), "utf8")), schema); }
    catch (e) { erros = [`JSON inválido: ${e.message}`]; }
    return { arquivo, erros };
  });
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = validarPerfis();
  for (const { arquivo, erros } of r) console.log(`${erros.length ? "FALHA" : "ok   "} ${arquivo}${erros.length ? "\n  " + erros.join("\n  ") : ""}`);
  const ruins = r.filter(x => x.erros.length).length;
  console.log(`\n${r.length - ruins}/${r.length} perfis válidos`);
  process.exitCode = ruins ? 1 : 0;
}
