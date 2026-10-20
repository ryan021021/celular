import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { validarAgentes } from '../agentes.mjs';
// Contrato de validarAgentes(raiz): lista de { arquivo, erros[] } para//  - .claude/agents/*.md: frontmatter com name == nome do arquivo, description, tools, model (haiku|sonnet|opus), maxTurns numerico;//    agente de leitura (code-explorer, code-reviewer, security-reviewer, silent-failure-hunter, verificador) sem Edit/Write em tools//    e, os que revisam, com disallowedTools Write e Edit;//  - docs/AGENTES.md: cada agente do disco aparece entre crases, e cada `agente` listado na tabela "Subagentes" existe;//  - comando `/x` citado no quadro existe como .agents/workflows/x.md ou .claude/skills/x/SKILL.md (`/ecc:*` e ignorado).

const FM = (campos) => `---\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\ncorpo\n`;
const BOM = { description: 'faz coisa', tools: 'Read, Grep', model: 'haiku', maxTurns: 10 };

function grava(raiz, rel, texto) {
  const p = join(raiz, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, texto);
}
// projeto minimo valido: um agente de escrita (termux-infra) e um revisor (code-reviewer)
function monta(ajusta = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'agentes-'));
  const agentes = {
    'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: 'Bash, Read, Edit, Write', model: 'sonnet' }),
    'code-reviewer': FM({ name: 'code-reviewer', ...BOM, tools: 'Read, Grep, Bash', disallowedTools: 'Write, Edit, NotebookEdit', model: 'sonnet' }),
    ...ajusta.agentes,
  };
  for (const [nome, texto] of Object.entries(agentes)) if (texto !== null) grava(raiz, `.claude/agents/${nome}.md`, texto);
  const quadro = ajusta.quadro ?? [
    '# Agentes',
    '## Subagentes',
    '| Agente | Modelo |',
    '|---|---|',
    '| `termux-infra` | sonnet |',
    '| `code-reviewer` | sonnet |',
    'Workflows do Gemini: `/vaga-1` e `/entregar`. Skill do Claude: `/rotina`. Do ECC: `/ecc:plan`.',
  ].join('\n');
  grava(raiz, 'docs/AGENTES.md', quadro);
  grava(raiz, '.agents/workflows/vaga-1.md', 'x');
  grava(raiz, '.agents/workflows/entregar.md', 'x');
  grava(raiz, '.claude/skills/rotina/SKILL.md', FM({ name: 'rotina', description: 'inicio de turno' }));
  for (const [pasta, texto] of Object.entries(ajusta.skills ?? {})) grava(raiz, `.claude/skills/${pasta}/SKILL.md`, texto);
  return raiz;
}

function erros(opcoes) {
  const raiz = monta(opcoes);
  try { return validarAgentes(raiz).flatMap((a) => a.erros.map((e) => `${a.arquivo}: ${e}`)); }
  finally { rmSync(raiz, { recursive: true, force: true }); }
}

test('projeto coerente: nenhum erro, um item por agente do disco, por skill e o do quadro', () => {
  const raiz = monta();
  try {
    const r = validarAgentes(raiz);
    assert.equal(r.length, 4);
    assert.deepEqual(r.flatMap((a) => a.erros), []);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('name diferente do nome do arquivo e recusado', () => {
  const e = erros({ agentes: { 'termux-infra': FM({ name: 'infra-termux', ...BOM, tools: 'Bash', model: 'sonnet' }) } });
  assert.match(e.join('\n'), /termux-infra.*name/i);
});

test('campo obrigatorio faltando (model) e modelo desconhecido sao recusados', () => {
  const sem = { ...BOM }; delete sem.model;
  assert.match(erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...sem }) } }).join('\n'), /model/);
  assert.match(erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, model: 'gpt' }) } }).join('\n'), /model/);
});

test('maxTurns que nao e numero e recusado', () => {
  assert.match(erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, maxTurns: 'muitos' }) } }).join('\n'), /maxTurns/);
});

test('sem frontmatter e recusado sem quebrar', () => {
  assert.match(erros({ agentes: { 'termux-infra': 'so texto\n' } }).join('\n'), /frontmatter/i);
});

test('agente de leitura com Edit ou Write em tools e recusado', () => {
  const e = erros({ agentes: { 'code-reviewer': FM({ name: 'code-reviewer', ...BOM, tools: 'Read, Edit', disallowedTools: 'Write, Edit', model: 'sonnet' }) } });
  assert.match(e.join('\n'), /code-reviewer.*(Edit|Write)/);
});

test('revisor sem disallowedTools Write/Edit e recusado', () => {
  const e = erros({ agentes: { 'code-reviewer': FM({ name: 'code-reviewer', ...BOM, tools: 'Read, Grep', model: 'sonnet' }) } });
  assert.match(e.join('\n'), /code-reviewer.*disallowedTools/);
});

test('agente no disco que nao aparece no quadro e recusado', () => {
  const e = erros({ agentes: { novato: FM({ name: 'novato', ...BOM }) } });
  assert.match(e.join('\n'), /novato.*AGENTES\.md/);
});

test('agente listado na tabela Subagentes sem arquivo e recusado', () => {
  const quadro = ['## Subagentes', '| `termux-infra` | x |', '| `code-reviewer` | x |', '| `fantasma` | x |'].join('\n');
  assert.match(erros({ quadro }).join('\n'), /fantasma.*n[aã]o existe/i);
});

test('workflow do Gemini citado no quadro sem arquivo e recusado', () => {
  const quadro = ['## Subagentes', '| `termux-infra` | x |', '| `code-reviewer` | x |', 'use `/vaga-9`'].join('\n');
  assert.match(erros({ quadro }).join('\n'), /vaga-9/);
});

test('quadro ausente e recusado, sem excecao', () => {
  const raiz = monta();
  rmSync(join(raiz, 'docs', 'AGENTES.md'));
  try { assert.match(validarAgentes(raiz).flatMap((a) => a.erros).join('\n'), /AGENTES\.md/); }
  finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('skill com name diferente da pasta e recusada', () => {
  const e = erros({ skills: { cola: FM({ name: 'outra', description: 'x' }) } });
  assert.match(e.join('\n'), /skills\/cola.*name/i);
});

test('skill sem description ou sem frontmatter e recusada', () => {
  assert.match(erros({ skills: { cola: FM({ name: 'cola', description: '' }) } }).join('\n'), /skills\/cola.*description/i);
  assert.match(erros({ skills: { cola: 'so texto\n' } }).join('\n'), /skills\/cola.*frontmatter/i);
});

test('skill valida sem disable-model-invocation passa', () => {
  assert.deepEqual(erros({ skills: { cola: FM({ name: 'cola', description: 'x' }) } }), []);
});

test('agente fora das listas fixas sem Edit/Write exige disallowedTools Write e Edit', () => {
  const e = erros({ quadro: undefined, agentes: { novato: FM({ name: 'novato', ...BOM, tools: 'Read, Grep' }) } });
  assert.match(e.join('\n'), /novato\.md.*disallowedTools/);
});

test('agente fora das listas com Edit ou Write nao exige disallowedTools', () => {
  const e = erros({ agentes: { novato: FM({ name: 'novato', ...BOM, tools: 'Read, Write' }) } });
  assert.doesNotMatch(e.join('\n'), /novato\.md.*disallowedTools/);
});

test('agente sem Edit/Write com disallowedTools completo passa a regra deduzida', () => {
  const e = erros({ agentes: { novato: FM({ name: 'novato', ...BOM, tools: 'Read', disallowedTools: 'Edit, Write' }) } });
  assert.doesNotMatch(e.join('\n'), /novato\.md.*disallowedTools/);
});

test('model diferente da coluna Modelo do quadro e recusado (sem diferenciar maiuscula)', () => {
  const e = erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: 'Read, Edit', model: 'haiku' }) } });
  assert.match(e.join('\n'), /termux-infra\.md.*haiku.*sonnet/);
  const ok = erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: 'Read, Edit', model: 'sonnet' }) }, quadro: [
    '## Subagentes', '| Agente | Modelo |', '|---|---|', '| `termux-infra` | Sonnet |', '| `code-reviewer` | SONNET |'].join('\n') });
  assert.deepEqual(ok, []);
});

test('ferramenta fora da lista conhecida e recusada', () => {
  const e = erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: 'Read, Edit, Foo' }) } });
  assert.match(e.join('\n'), /termux-infra\.md.*Foo/);
});

test('Agent ou Task em subagente e recusado (sem delegacao em cadeia)', () => {
  for (const t of ['Agent', 'Task']) {
    const e = erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: `Read, Edit, ${t}` }) } });
    assert.match(e.join('\n'), new RegExp(`termux-infra\.md.*${t}.*deleg`));
  }
});

test('todas as ferramentas conhecidas sao aceitas em tools', () => {
  const todas = 'Read, Grep, Glob, Bash, Edit, Write, NotebookEdit, WebFetch, WebSearch, PowerShell';
  assert.deepEqual(erros({ agentes: { 'termux-infra': FM({ name: 'termux-infra', ...BOM, tools: todas, model: 'sonnet' }) } }), []);
});
