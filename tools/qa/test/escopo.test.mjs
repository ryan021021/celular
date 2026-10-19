import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linhaDa, padroes, foraDoEscopo, perigos } from '../escopo.mjs';

const tasks = [
  '| T60 | x | GEM-IDE | — | `server/termux/**`, `README.md` | READY | t | — | — |',
  '| T61 | x | FRONT | — | `public/console.*` | READY | t | — | — |',
  '| T62 | x | ORQ | — | a definir | READY | t | — | — |',
].join('\n');

test('arquivo autorizado passa, fora do escopo trava, .collab e LOG sempre passam', () => {
  const p = padroes(linhaDa('T60', [tasks]));
  assert.deepEqual(foraDoEscopo(['server/termux/sv/sftp/run', 'README.md', '.collab/TASKS.md', 'docs/LOG.md'], p), []);
  assert.deepEqual(foraDoEscopo(['profiles/a13.json', 'server/termux/a.sh'], p), ['profiles/a13.json']);
});

test('* fica dentro da pasta; sem crases o escopo é indefinido', () => {
  const p = padroes(linhaDa('T61', [tasks]));
  assert.deepEqual(foraDoEscopo(['public/console.js', 'public/x/console.js'], p), ['public/x/console.js']);
  assert.equal(foraDoEscopo(['qualquer.txt'], padroes(linhaDa('T62', [tasks]))), null);
});

test('comando perigoso acrescentado em código trava; comentário e doc não', () => {
  const diff = [
    // texto montado em partes para este arquivo não disparar a própria trava
    '+++ b/tools/x.ps1', '+adb shell cmd package ' + 'compile -m speed -f com.android.systemui', '+# cmd package ' + 'compile (só comentário)',
    '+++ b/docs/x.md', '+adb shell cmd package ' + 'compile -f x',
    '+++ b/server/termux/a.sh', '+key=sk-ant-' + 'a'.repeat(30),
  ].join('\n');
  const achados = perigos(diff);
  assert.equal(achados.length, 2);
  assert.match(achados[0], /compile/);
  assert.match(achados[1], /segredo/);
});
