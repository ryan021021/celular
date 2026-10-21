import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { entrega, FASES, achaSegredos } from '../entrega.mjs';

const LINHA = '| T900 | demo | QA | — | `tools/x/a.mjs`, `tools/x/test/a.test.mjs` | IN_PROGRESS | c | e | p |';
const OK_TESTE = 'ℹ tests 2\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\n';
// montado em pedaços para o texto deste arquivo não parecer comando destrutivo
const COMANDO_PERIGOSO = ['adb', 'shell', 'rm', '-rf', '/sdcard/Download'].join(' ');

function cenario({ arquivos = ['tools/x/a.mjs', 'tools/x/test/a.test.mjs'], diff = '+++ b/tools/x/a.mjs\n+const a = 1;\n', run } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'entrega-t-'));
  mkdirSync(join(raiz, '.collab'));
  mkdirSync(join(raiz, 'tools/x/test'), { recursive: true });
  writeFileSync(join(raiz, '.collab/TASKS.md'), `${LINHA}\n`);
  for (const f of arquivos) { mkdirSync(dirname(join(raiz, f)), { recursive: true }); writeFileSync(join(raiz, f), 'x\n'); }
  const chamadas = [];
  const git = (...a) => {
    if (a[0] === 'log') return 'abc1234\n';
    if (a[0] === 'show' && a.includes('--name-only')) return arquivos.join('\n');
    if (a[0] === 'show' && a.includes('-s')) return 'QA: T900 demo';
    if (a[0] === 'show') return diff;
    return '';
  };
  const rodar = run ?? ((cmd, args) => { chamadas.push([cmd, ...args]); return { code: 0, out: OK_TESTE, travou: false }; });
  return { raiz, git, run: rodar, chamadas };
}
const fase = (r, nome) => r.fases.find((f) => f.nome === nome);
const limpar = (c) => rmSync(c.raiz, { recursive: true, force: true });

test('tudo em ordem: uma linha por fase e PASS', async () => {
  const c = cenario();
  try {
    const r = await entrega('T900', c);
    assert.deepEqual(r.fases.map((f) => f.nome), FASES);
    assert.equal(r.ok, true);
    assert.ok(r.fases.every((f) => f.ok));
  } finally { limpar(c); }
});

test('fase escopo: arquivo fora da lista da tarefa reprova', async () => {
  const c = cenario({ arquivos: ['tools/x/a.mjs', 'tools/x/test/a.test.mjs', 'tools/y/b.mjs'] });
  try {
    const r = await entrega('T900', c);
    assert.equal(fase(r, 'escopo').ok, false);
    assert.match(fase(r, 'escopo').resumo, /tools\/y\/b\.mjs/);
    assert.equal(r.ok, false);
  } finally { limpar(c); }
});

test('fase escopo: comando perigoso no diff reprova', async () => {
  const c = cenario({ diff: `+++ b/tools/x/a.mjs\n+${COMANDO_PERIGOSO}\n` });
  try {
    assert.equal(fase(await entrega('T900', c), 'escopo').ok, false);
  } finally { limpar(c); }
});

test('fase testes: teste que falha reprova, e sem arquivo de teste também (salvo --sem-testes)', async () => {
  const falha = cenario({ run: () => ({ code: 1, out: 'ℹ tests 2\nℹ pass 1\nℹ fail 1\nℹ cancelled 0\nℹ skipped 0\n', travou: false }) });
  const semTeste = cenario({ arquivos: ['tools/x/a.mjs'] });
  try {
    assert.equal(fase(await entrega('T900', falha), 'testes').ok, false);
    assert.equal(fase(await entrega('T900', semTeste), 'testes').ok, false);
    assert.equal(fase(await entrega('T900', { ...semTeste, semTestes: true }), 'testes').ok, true);
  } finally { limpar(falha); limpar(semTeste); }
});

test('fase testes: saída sem resumo reprova com a mensagem de falha alta', async () => {
  const c = cenario({ run: () => ({ code: 0, out: 'nada', travou: false }) });
  try {
    const f = fase(await entrega('T900', c), 'testes');
    assert.equal(f.ok, false);
    assert.match(f.resumo, /resumo do node --test não encontrado/);
  } finally { limpar(c); }
});

test('fase lint: node --check que falha reprova; ruff check e format rodam no ryx quando informado', async () => {
  const c = cenario({ run: (cmd, args) => (args[0] === '--check' ? { code: 1, out: 'SyntaxError', travou: false } : { code: 0, out: OK_TESTE, travou: false }) });
  const r2 = cenario();
  try {
    assert.equal(fase(await entrega('T900', c), 'lint').ok, false);
    await entrega('T900', { ...r2, ryx: 'C:/ryx' });
    assert.ok(r2.chamadas.some((x) => x.includes('ruff') && x.includes('check') && !x.includes('format')));
    assert.ok(r2.chamadas.some((x) => x.includes('ruff') && x.includes('format') && x.includes('--check')));
  } finally { limpar(c); limpar(r2); }
});

test('fase lint: ruff que reprova derruba a entrega', async () => {
  const c = cenario({ run: (cmd, args) => (args.includes('ruff') ? { code: 1, out: 'E501', travou: false } : { code: 0, out: OK_TESTE, travou: false }) });
  try {
    assert.equal(fase(await entrega('T900', { ...c, ryx: 'C:/ryx' }), 'lint').ok, false);
  } finally { limpar(c); }
});

test('fase segredo: chave, token e senha literal no diff reprovam; placeholder passa', async () => {
  const ruins = [
    `+const k = "${'-----BEGIN RSA ' + 'PRIVATE KEY-----'}";`,
    `+const t = "${'gh' + 'p_abcdefghijklmnopqrstuvwxyz0123'}";`,
    '+password = "Abcd1234xyzW"',
    '+const a = "AKIAABCDEFGHIJKLMNOP";',
  ];
  for (const l of ruins) {
    const c = cenario({ diff: `+++ b/tools/x/a.mjs\n${l}\n` });
    try { assert.equal(fase(await entrega('T900', c), 'segredo').ok, false, l); } finally { limpar(c); }
  }
  assert.deepEqual(achaSegredos('+++ b/a.mjs\n+const password = process.env.SENHA;\n+token = "exemplo-troque-aqui"\n'), []);
});

test('fase segredo: remoção de linha não conta', () => {
  assert.deepEqual(achaSegredos('+++ b/a.mjs\n-password = "Abcd1234xyzW"\n'), []);
});

test('fase tamanho: diff acima do limite reprova', async () => {
  const grande = '+++ b/tools/x/a.mjs\n' + '+const a = 1;\n'.repeat(1600);
  const c = cenario({ diff: grande });
  try {
    const f = fase(await entrega('T900', c), 'tamanho');
    assert.equal(f.ok, false);
    assert.match(f.resumo, /1600/);
  } finally { limpar(c); }
});

test('sem commit citando a tarefa: usa o diff do que está no disco e avisa', async () => {
  const c = cenario();
  const git = (...a) => (a[0] === 'log' ? '' : c.git(...a));
  try {
    const r = await entrega('T900', { ...c, git });
    assert.match(fase(r, 'escopo').resumo, /sem commit/);
  } finally { limpar(c); }
});

test('tarefa que não existe no TASKS reprova o escopo', async () => {
  const c = cenario();
  try {
    assert.equal(fase(await entrega('T777', c), 'escopo').ok, false);
  } finally { limpar(c); }
});

test('fase lint: ruff check e ruff format --check reprovam cada um sozinho', async () => {
  const so = (marca) => (cmd, args) => ({ code: args.includes('ruff') && marca(args) ? 1 : 0, out: OK_TESTE, travou: false });
  const c1 = cenario({ run: so((a) => !a.includes('format')) });
  const c2 = cenario({ run: so((a) => a.includes('format')) });
  try {
    assert.equal(fase(await entrega('T900', { ...c1, ryx: 'C:/ryx' }), 'lint').ok, false);
    assert.equal(fase(await entrega('T900', { ...c2, ryx: 'C:/ryx' }), 'lint').ok, false);
  } finally { limpar(c1); limpar(c2); }
});

test('fase tamanho: exatamente no limite passa, uma linha a mais reprova', async () => {
  const diff = (n) => '+++ b/tools/x/a.mjs\n' + '+const a = 1;\n'.repeat(n);
  const c1 = cenario({ diff: diff(1500) });
  const c2 = cenario({ diff: diff(1501) });
  try {
    assert.equal(fase(await entrega('T900', c1), 'tamanho').ok, true);
    assert.equal(fase(await entrega('T900', c2), 'tamanho').ok, false);
  } finally { limpar(c1); limpar(c2); }
});
