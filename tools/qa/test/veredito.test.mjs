import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoNodeTest, veredito, CRITICAS } from '../veredito.mjs';

const saida = (t, p, f, s) => `ℹ tests ${t}\nℹ pass ${p}\nℹ fail ${f}\nℹ cancelled 0\nℹ skipped ${s}\n`;
const ok0 = { code: 0, travou: false };

test('resumoNodeTest lê tests/pass/fail/skipped e os nomes que falharam', () => {
  const r = resumoNodeTest(`${saida(5, 3, 1, 1)}  ✖ quebra aqui (1.2ms)\n`);
  assert.deepEqual([r.testes, r.passou, r.falhou, r.pulados], [5, 3, 1, 1]);
  assert.deepEqual(r.falhas, ['quebra aqui']);
});

test('suíte verde sem pulados passa em qualquer pasta', () => {
  assert.equal(veredito(ok0, resumoNodeTest(saida(4, 4, 0, 0)), 'tools/server').ok, true);
});

test('A2: pulado em suíte crítica (tools/server, server/termux) falha e diz o motivo', () => {
  for (const nome of ['tools/server', 'server/termux/test']) {
    const v = veredito(ok0, resumoNodeTest(saida(4, 3, 0, 1)), nome);
    assert.equal(v.ok, false, nome);
    assert.match(v.motivo, /pulad/);
  }
});

test('A2: pulado em suíte não crítica continua só aviso (teste de plataforma)', () => {
  for (const nome of ['server/agentops/test', 'painel']) assert.equal(veredito(ok0, resumoNodeTest(saida(4, 3, 0, 1)), nome).ok, true, nome);
});

test('travou, código ≠ 0, falha e zero testes continuam vermelhos', () => {
  const s = resumoNodeTest(saida(4, 4, 0, 0));
  assert.equal(veredito({ code: 0, travou: true }, s, 'x').ok, false);
  assert.equal(veredito({ code: 1, travou: false }, s, 'x').ok, false);
  assert.equal(veredito(ok0, resumoNodeTest(saida(4, 3, 1, 0)), 'x').ok, false);
  assert.equal(veredito(ok0, resumoNodeTest('sem resumo'), 'x').ok, false);
  assert.equal(veredito(ok0, resumoNodeTest(saida(0, 0, 0, 0)), 'x').ok, false); // nada rodou
});

test('regressao.mjs decide o verde de cada suíte só pelo veredito (sem conta própria que ignore pulados)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../regressao.mjs', import.meta.url), 'utf8');
  assert.match(src, /veredito\(r, s, /);
  assert.doesNotMatch(src, /s\.falhou === 0 && s\.testes > 0/);
});

test('CRITICAS cobre backup/discovery (tools/server) e termux', () => {
  for (const n of ['tools/server', 'server/termux/test']) assert.ok(CRITICAS.some(re => re.test(n)), n);
});
