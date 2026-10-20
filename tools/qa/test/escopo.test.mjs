import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linhaDa, padroes, foraDoEscopo, perigos, fila, PERIGOS } from '../escopo.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('fila: cópia velha do TASKS que rebaixa tarefa não citada trava; a citada e o LOG append-only passam', () => {
  const linha = (id, est) => `| ${id} | x | BACK | — | \`a\` | ${est} | nota |`;
  const diff = (a, b, arq = '.collab/TASKS.md') => `--- a/${arq}\n+++ b/${arq}\n-${a}\n+${b}\n`;
  assert.equal(fila(diff(linha('T62', 'REVIEW'), linha('T62', 'READY')), ['T60']).length, 1);
  assert.equal(fila(diff(linha('T62', 'REVIEW'), linha('T62', 'READY')), ['T62']).length, 0); // devolução pelo revisor cita a tarefa
  assert.equal(fila(diff(linha('T62', 'READY'), linha('T62', 'REVIEW')), []).length, 0);       // avanço passa
  assert.equal(fila(diff(linha('T62', 'IN_PROGRESS'), linha('T62', 'BLOCKED')), []).length, 0);
  assert.equal(fila('--- a/docs/LOG.md\n+++ b/docs/LOG.md\n-- 2026 linha antiga\n', ['T1']).length, 1);
  assert.equal(fila('--- a/docs/LOG.md\n+++ b/docs/LOG.md\n+- 2026 linha nova\n', ['T1']).length, 0);
});

// B7: um caso para cada entrada de PERIGOS (texto montado em partes para este arquivo não disparar a própria trava)
const AMOSTRAS = {
  'pm destrutivo': 'adb shell p' + 'm clear com.x',
  'adb uninstall': 'adb ' + 'uninstall com.x',
  'compile (derrubou o A13)': 'cmd package ' + 'compile -m speed x',
  'wm density/size': 'adb shell w' + 'm density 300',
  'reboot/fastboot': 'adb re' + 'boot',
  'wipe/factory': 'factory' + '-reset agora',
  'rm -rf no aparelho': 'adb shell rm -r' + 'f /sdcard/DCIM',
  'chave privada': '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----',
  'token/segredo': 'k=ghp_' + 'a'.repeat(36),
};

test('B7: PERIGOS e AMOSTRAS têm exatamente as mesmas entradas, e as duas formas do wm travam', () => {
  assert.deepEqual(PERIGOS.map(p => p[1]).sort(), Object.keys(AMOSTRAS).sort());
  assert.equal(perigos('+++ b/tools/x.sh\n+adb shell w' + 'm size 1080x1920\n').length, 1);
});

test('B7: cada entrada de PERIGOS tem amostra que trava em script e passa como comentário ou doc', () => {
  for (const [, nome] of PERIGOS) assert.ok(AMOSTRAS[nome], `PERIGOS "${nome}" sem caso de teste`);
  for (const [, nome] of PERIGOS) {
    const a = perigos(`+++ b/tools/x.sh\n+${AMOSTRAS[nome]}\n`);
    assert.ok(a.some(x => x.includes(nome)), `${nome} não travou`);
    assert.deepEqual(perigos(`+++ b/tools/x.sh\n+# ${AMOSTRAS[nome]}\n`), [], `${nome} em comentário`);
    assert.deepEqual(perigos(`+++ b/docs/x.md\n+${AMOSTRAS[nome]}\n`), [], `${nome} em doc`);
  }
});

// B7: o hook não pode abrir sozinho. Roda o CLI de verdade em repositório temporário.
const CLI = fileURLToPath(new URL('../escopo.mjs', import.meta.url));
function cli(args, { tasks: t, msg = '' }) {
  const d = mkdtempSync(join(tmpdir(), 'escopo-cli-'));
  try {
    const g = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
    g('init', '-q');
    mkdirSync(join(d, '.collab'));
    if (t !== undefined) writeFileSync(join(d, '.collab', 'TASKS.md'), t);
    writeFileSync(join(d, 'a.txt'), 'x');
    g('add', 'a.txt');
    writeFileSync(join(d, 'msg'), msg);
    return spawnSync(process.execPath, [CLI, ...args.map(x => (x === '@msg' ? join(d, 'msg') : x))], { cwd: d, encoding: 'utf8' });
  } finally { rmSync(d, { recursive: true, force: true }); }
}
const LINHA = '| T1 | x | QA | — | `b.txt` | READY | n | — | — |\n';

test('B7: controle — arquivo fora do escopo trava pelo CLI', () => {
  const r = cli(['--msg', '@msg'], { tasks: LINHA, msg: 'QA: T1 x' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TRAVADO/);
});

test('B7: TASKS.md ausente não libera o commit nem o --review', () => {
  const m = cli(['--msg', '@msg'], { msg: 'QA: T1 x' });
  assert.equal(m.status, 1);
  assert.match(m.stderr, /TASKS/);
  assert.equal(cli(['--review'], {}).status, 1);
});

test('B7: exceção interna (mensagem ilegível) trava, e OK-RYAN na mensagem libera', () => {
  const e = cli(['--msg', 'nao-existe.txt'], { tasks: LINHA, msg: 'x' });
  assert.equal(e.status, 1);
  assert.match(e.stderr, /não conferiu/);
  const c = cli(['--msg', '@msg'], { tasks: LINHA, msg: 'QA: T1 OK-RYAN: motivo' });
  assert.equal(c.status, 0);
});
