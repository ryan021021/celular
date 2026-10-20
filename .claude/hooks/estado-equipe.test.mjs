// node --test .claude/hooks/estado-equipe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./estado-equipe.mjs', import.meta.url));

// `prep(raiz)` monta locks/handoffs; `semTasks` não cria o TASKS.md (arquivo ausente).
function roda(linhas, { prep, semTasks } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'estado-equipe-'));
  try {
    mkdirSync(join(raiz, '.collab'), { recursive: true });
    const cab = '| ID | Objetivo | Agente | Depende | Arquivos | Estado | Testes | Evidência | Pendências |';
    if (!semTasks) writeFileSync(join(raiz, '.collab', 'TASKS.md'), [cab, '|---|---|---|---|---|---|---|---|---|', ...linhas].join('\n'));
    if (prep) prep(raiz);
    const r = spawnSync('node', [hook], { env: { ...process.env, CLAUDE_PROJECT_DIR: raiz }, encoding: 'utf8', timeout: 15000 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  } finally { rmSync(raiz, { recursive: true, force: true }); }
}

const linha = (id, agente, estado, pend = '—') => `| ${id} | x | ${agente} | — | \`a\` | ${estado} | t | — | ${pend} |`;

test('cada vaga do Gemini (2: GEM-IDE-1 e GEM-IDE-2) tem a própria fila', () => {
  const s = roda([linha('T1', 'GEM-IDE-1', 'READY'), linha('T2', 'GEM-IDE-2', 'IN_PROGRESS')]);
  assert.match(s, /- GEM-IDE-1: T1:READY/);
  assert.match(s, /- GEM-IDE-2: T2:IN_PROGRESS/);
  assert.doesNotMatch(s, /GEM-IDE-1: .*T2/);
});

test('GEM-AG-1/2 foram retiradas (20/10): não viram fila nem dono', () => {
  const s = roda([linha('T3', 'GEM-AG-1', 'READY'), linha('T4', 'GEM-AG-2', 'REVIEW'), linha('T5', 'GEM-IDE-1', 'READY')]);
  assert.doesNotMatch(s, /GEM-AG/);
  assert.match(s, /- GEM-IDE-1: T5:READY/);
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

const lockCom = (nome, minutos, texto = 'T9 orq') => raiz => {
  mkdirSync(join(raiz, '.collab', 'locks'), { recursive: true });
  const arq = join(raiz, '.collab', 'locks', nome);
  writeFileSync(arq, texto);
  const t = new Date(Date.now() - minutos * 60000);
  utimesSync(arq, t, t);
};

test('lock com mais de 120 min aparece como ABANDONADO?, um recente não (mata M14: limite 1200)', () => {
  const s = roda([], { prep: raiz => { lockCom('T9-orq.lock', 130)(raiz); lockCom('T10-back.lock', 5)(raiz); } });
  assert.match(s, /lock T9-orq\.lock \(1[23]\d min, ABANDONADO\?\): T9 orq/);
  assert.match(s, /lock T10-back\.lock \(\d+ min\): T9 orq/);
  assert.doesNotMatch(s, /T10-back\.lock[^\n]*ABANDONADO/);
});

test('limite do lock: 119 min ainda vale, 121 min já é abandonado', () => {
  const s = roda([], { prep: raiz => { lockCom('A.lock', 119)(raiz); lockCom('B.lock', 121)(raiz); } });
  assert.doesNotMatch(s, /lock A\.lock[^\n]*ABANDONADO/);
  assert.match(s, /lock B\.lock \([^)]*ABANDONADO\?\)/);
});

test('só arquivos .lock entram e o texto do lock é cortado em 100 caracteres', () => {
  const s = roda([], { prep: raiz => { lockCom('X.lock', 1, 'a'.repeat(300))(raiz); lockCom('nota.txt', 1)(raiz); } });
  assert.doesNotMatch(s, /nota\.txt/);
  assert.match(s, /lock X\.lock \(\d+ min\): a{100}\n/);
});

test('TASKS.md ausente: não quebra, sai 0, mostra o resto e nenhuma fila', () => {
  const s = roda([], { semTasks: true, prep: raiz => lockCom('T1-qa.lock', 1)(raiz) });
  assert.match(s, /## Equipe agora/);
  assert.match(s, /lock T1-qa\.lock/);
  assert.doesNotMatch(s, /- (CHEFE|ORQ|BACK|FRONT|QA|GEM-\S+):/);
  assert.doesNotMatch(s, /indisponível/);
});

test('handoff com RESOLVIDO nas 3 primeiras linhas some da lista; os abertos ficam', () => {
  const s = roda([], { prep: raiz => {
    const d = join(raiz, '.collab', 'handoff');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, '2026-10-20_aberto.md'), '# aberto\n\npedido\n');
    writeFileSync(join(d, '2026-10-20_resolvido.md'), '# pedido\nRESOLVIDO em 20/10\n');
    writeFileSync(join(d, '2026-10-20_tardio.md'), '# a\n\n\n\nRESOLVIDO só na linha 5\n');
    writeFileSync(join(d, 'nota.txt'), 'RESOLVIDO');
  } });
  assert.match(s, /handoffs abertos[^\n]*2026-10-20_aberto\.md/);
  assert.match(s, /handoffs abertos[^\n]*2026-10-20_tardio\.md/);
  assert.doesNotMatch(s, /2026-10-20_resolvido/);
  assert.doesNotMatch(s, /nota\.txt/);
});

test('erro inesperado vira aviso "indisponível" e o hook ainda sai 0 (nunca trava a sessão)', () => {
  // `.collab/locks` é um arquivo: readdirSync lança ENOTDIR dentro do try.
  const s = roda([linha('T1', 'BACK', 'READY')], { prep: raiz => writeFileSync(join(raiz, '.collab', 'locks'), 'x') });
  assert.match(s, /\(estado-equipe indisponível: /);
  assert.match(s, /- BACK: T1:READY/); // o que já foi montado antes do erro continua saindo
});

test('nome entre parênteses não vira dono e GEM-CLI aposentado não aparece', () => {
  const s = roda([linha('T20', 'BACK (pede ao GEM-IDE-2)', 'READY'), linha('T21', 'GEM-CLI', 'READY')]);
  assert.match(s, /- BACK: T20:READY/);
  assert.doesNotMatch(s, /GEM-IDE-2: T20/);
  assert.doesNotMatch(s, /GEM-CLI/);
});
