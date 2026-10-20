// Confere os subagentes do projeto (.claude/agents/*.md) contra o quadro docs/AGENTES.md.
// Usado por tools/qa/regressao.mjs; devolve [{ arquivo, erros[] }] (lista vazia de erros = ok).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODELOS = ["haiku", "sonnet", "opus"];
// só leem: nunca podem ter Edit/Write em `tools`
const SO_LEITURA = ["code-explorer", "code-reviewer", "security-reviewer", "silent-failure-hunter", "verificador"];
// os que revisam o trabalho dos outros também carregam a trava explícita
const REVISORES = ["code-reviewer", "security-reviewer", "silent-failure-hunter"];
const ESCRITA = ["Edit", "Write"];

const lista = (v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function frontmatter(texto) {
  const m = texto.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const campos = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const c = linha.match(/^([A-Za-z]+):\s*(.*)$/);
    if (c) campos[c[1]] = c[2].trim().replace(/^["']|["']$/g, "");
  }
  return campos;
}

function errosDoAgente(nome, texto) {
  const fm = frontmatter(texto);
  if (!fm) return ["sem frontmatter (--- ... ---) no começo do arquivo"];
  const erros = [];
  if (fm.name !== nome) erros.push(`name '${fm.name ?? ""}' difere do nome do arquivo '${nome}'`);
  if (!fm.description) erros.push("falta description");
  if (!fm.tools) erros.push("falta tools");
  if (!MODELOS.includes(fm.model)) erros.push(`model '${fm.model ?? ""}' inválido (use ${MODELOS.join("|")})`);
  if (!/^\d+$/.test(fm.maxTurns ?? "")) erros.push(`maxTurns '${fm.maxTurns ?? ""}' precisa ser número`);
  if (SO_LEITURA.includes(nome)) {
    const tem = lista(fm.tools).filter((t) => ESCRITA.includes(t));
    if (tem.length) erros.push(`agente de leitura não pode ter ${tem.join("/")} em tools`);
  }
  if (REVISORES.includes(nome)) {
    const proibidas = lista(fm.disallowedTools);
    if (!ESCRITA.every((t) => proibidas.includes(t))) erros.push("revisor precisa de disallowedTools com Write e Edit");
  }
  return erros;
}

function errosDoQuadro(raiz, agentes) {
  const arquivo = join(raiz, "docs", "AGENTES.md");
  if (!existsSync(arquivo)) return ["docs/AGENTES.md não existe"];
  const quadro = readFileSync(arquivo, "utf8");
  const erros = [];
  for (const a of agentes) if (!quadro.includes(`\`${a}\``)) erros.push(`agente '${a}' não aparece em docs/AGENTES.md`);
  const secao = quadro.split(/^## /m).find((s) => /^Subagentes/.test(s)) ?? "";
  const listados = new Set([...secao.matchAll(/^\|\s*`([a-z0-9-]+)`/gm)].map((m) => m[1]));
  for (const l of listados) if (!agentes.includes(l)) erros.push(`'${l}' está na tabela Subagentes mas o arquivo .claude/agents/${l}.md não existe`);
  for (const m of quadro.matchAll(/`\/([a-z0-9-]+)`/g)) {
    const cmd = m[1];
    const existe = existsSync(join(raiz, ".agents", "workflows", `${cmd}.md`)) || existsSync(join(raiz, ".claude", "skills", cmd, "SKILL.md"));
    if (!existe) erros.push(`comando /${cmd} citado no quadro não existe em .agents/workflows nem em .claude/skills`);
  }
  return [...new Set(erros)];
}

export function validarAgentes(raiz = ROOT) {
  const pasta = join(raiz, ".claude", "agents");
  const arquivos = existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith(".md")).sort() : [];
  const nomes = arquivos.map((f) => f.slice(0, -3));
  const itens = arquivos.map((f) => ({ arquivo: `.claude/agents/${f}`, erros: errosDoAgente(f.slice(0, -3), readFileSync(join(pasta, f), "utf8")) }));
  itens.push({ arquivo: "docs/AGENTES.md", erros: errosDoQuadro(raiz, nomes) });
  return itens;
}
