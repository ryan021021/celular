import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gerarMutantes, mutar } from '../mutar.mjs';

function projeto(codigo, teste) {
  const raiz = mkdtempSync(join(tmpdir(), 'mutar-t-'));
  mkdirSync(join(raiz, 'src'));
  mkdirSync(join(raiz, 'test'));
  writeFileSync(join(raiz, 'src/a.mjs'), codigo);
  writeFileSync(join(raiz, 'test/a.test.mjs'), teste);
  return raiz;
}

test('gera mutantes de operador e de throw, com linha', () => {
  const m = gerarMutantes('if (a === b) x();\nif (n > 3) y();\nthrow new Error("x");\n');
  const desc = m.map((x) => `${x.linha}:${x.descricao}`);
  assert.deepEqual(desc, ['1:=== → !==', '2:> → >=', '3:remove throw']);
});

test('ignora operadores em string, comentário e seta', () => {
  const m = gerarMutantes('const s = "a === b"; // x > y\nconst f = (a) => a;\nconst t = `n >= 1`;\n');
  assert.equal(m.length, 0);
});

test('mascara aspa escapada, comentário de bloco e aspa sem fechar na linha', () => {
  const desc = (t) => gerarMutantes(t).map((x) => `${x.linha}:${x.descricao}`);
  assert.deepEqual(desc('const s = "a\\" > b"; x > y;\n'), ['1:> → >=']);
  assert.deepEqual(desc('/* a > b\n c < d */ x < y;\n'), ['2:< → <=']);
  assert.deepEqual(desc("const s = 'abc\nx > y;\n"), ['2:> → >=']);
  assert.deepEqual(desc('a // c\nb > c;\n'), ['2:> → >=']);
});

test('não confunde >>, <<, =>, ->, ==, throw dentro de identificador', () => {
  const desc = (t) => gerarMutantes(t).map((x) => x.descricao);
  assert.deepEqual(desc('a >> 1; b << 2; f = (x) => x; c -> d; a == b; rethrow(); throwaway();'), []);
  assert.deepEqual(desc('a >= b; c <= d; e !== f;'), ['>= → >', '<= → <', '!== → ===']);
  assert.deepEqual(desc('x < y; throw e; z > w'), ['< → <=', 'remove throw', '> → >=']);
});

test('mutante vivo aparece com arquivo:linha e o original fica intacto', async () => {
  const cod = 'export const maior = (n) => n > 3;\n';
  const raiz = projeto(cod,
    `import { test } from 'node:test'; import assert from 'node:assert/strict';\nimport { maior } from '../src/a.mjs';\ntest('x', () => { assert.equal(maior(10), true); });\n`);
  try {
    const r = await mutar(join(raiz, 'src/a.mjs'), join(raiz, 'test/a.test.mjs'), { raiz });
    assert.equal(r.total, 1);
    assert.equal(r.mortos, 0);
    assert.match(r.sobreviventes[0].local, /src\/a\.mjs:1$/);
    assert.equal(readFileSync(join(raiz, 'src/a.mjs'), 'utf8'), cod);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('teste na fronteira mata o mutante', async () => {
  const raiz = projeto('export const maior = (n) => n > 3;\n',
    `import { test } from 'node:test'; import assert from 'node:assert/strict';\nimport { maior } from '../src/a.mjs';\ntest('x', () => { assert.equal(maior(3), false); assert.equal(maior(4), true); });\n`);
  try {
    const r = await mutar(join(raiz, 'src/a.mjs'), join(raiz, 'test/a.test.mjs'), { raiz });
    assert.deepEqual([r.total, r.mortos, r.sobreviventes.length], [1, 1, 0]);
    assert.match(r.resumo, /^1 mutantes, 1 mortos/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('teste que já falha sem mutação é erro, não "mortos"', async () => {
  const raiz = projeto('export const a = 1;\n',
    `import { test } from 'node:test'; import assert from 'node:assert/strict';\ntest('x', () => { assert.equal(1, 2); });\n`);
  try {
    await assert.rejects(mutar(join(raiz, 'src/a.mjs'), join(raiz, 'test/a.test.mjs'), { raiz }), /já falha/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('recusa arquivo fora da raiz', async () => {
  const raiz = projeto('export const a = 1;\n', 'x');
  try {
    await assert.rejects(mutar(join(raiz, '..', 'fora.mjs'), join(raiz, 'test/a.test.mjs'), { raiz }), /fora da raiz/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
