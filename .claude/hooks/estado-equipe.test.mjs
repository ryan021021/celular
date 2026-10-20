// node --test .claude/hooks/estado-equipe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./estado-equipe.mjs', import.meta.url));

function roda(linhas) {
  const raiz = mkdtempSync(join(tmpdir(), 'estado-equipe-'));
  try {
    mkdirSync(join(raiz, '.collab'), { recursive: true });
    const cab = '| ID | Objetivo | Agente | Depende | Arquivos | Estado | Testes | Evidência | Pendências |';
    writeFileSync(join(raiz, '.collab', 'TASKS.md'), [cab, '|---|---|---|---|---|---|---|---|---|', ...linhas].join('\n'));
    const r = spawnSync('node', [hook], { env: { ...process.env, CLAUDE_PROJECT_DIR: raiz }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  } finally { rmSync(raiz, { recursive: true, force: true }); }
}

const linha = (id, agente, estado, pend = '—') => `| ${id} | x | ${agente} | — | \`a\` | ${estado} | t | — | ${pend} |`;

test('cada vaga do Gemini tem a própria fila', () => {
  const s = roda([
    linha('T1', 'GEM-IDE-1', 'READY'), linha('T2', 'GEM-IDE-2', 'IN_PROGRESS'),
    linha('T3', 'GEM-AG-1', 'READY'), linha('T4', 'GEM-AG-2', 'REVIEW'),
  ]);
  assert.match(s, /- GEM-IDE-1: T1:READY/);
  assert.match(s, /- GEM-IDE-2: T2:IN_PROGRESS/);
  assert.match(s, /- GEM-AG-1: T3:READY/);
  assert.match(s, /- GEM-AG-2: T4:REVIEW/);
  assert.doesNotMatch(s, /GEM-IDE-1: .*T2/);
});

test('sigla antiga GEM-IDE vale como GEM-IDE-1, sem duplicar na GEM-IDE-2', () => {
  const s = roda([linha('T8', 'GEM-IDE', 'BLOCKED')]);
  assert.match(s, /- GEM-IDE-1: T8:BLOCKED/);
  assert.doesNotMatch(s, /GEM-IDE-2: T8/);
});

test('revisor: GEM-IDE (antigo) e revisor: QA entram em "revisar"', () => {
  const s = roda([
    linha('T10', 'BACK', 'REVIEW', 'revisor: GEM-IDE'),
    linha('T11', 'ORQ', 'REVIEW', 'revisor: QA'),
  ]);
  assert.match(s, /- GEM-IDE-1: .*revisar: T10/);
  assert.match(s, /- QA: .*revisar: T11/);
});

test('nome entre parênteses não vira dono e GEM-CLI aposentado não aparece', () => {
  const s = roda([linha('T20', 'BACK (pede ao GEM-AG-1)', 'READY'), linha('T21', 'GEM-CLI', 'READY')]);
  assert.match(s, /- BACK: T20:READY/);
  assert.doesNotMatch(s, /GEM-AG-1: T20/);
  assert.doesNotMatch(s, /GEM-CLI/);
});
