// Conferência automática do CHEFE (§11): ninguém sai do escopo da tarefa nem coloca comando perigoso no código.
// Uso:
//   node tools/qa/escopo.mjs --msg <arquivo>   hook commit-msg: confere os arquivos em stage contra as Txx citadas na mensagem
//   node tools/qa/escopo.mjs --review          confere os commits de todas as tarefas em REVIEW
// Saída 1 = travado. Liberação pontual, só com OK do Ryan: "OK-RYAN: <motivo>" na mensagem do commit.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SEMPRE = [/^\.collab\//, /^docs\/LOG\.md$/, /^docs\/log\//];
const CODIGO = /\.(ps1|psm1|sh|bat|cmd|mjs|js|cjs|py)$|(^|\/)(run|finish)$/;
const TRAVAS = /^(tools\/qa\/(escopo\.mjs|test\/escopo\.test\.mjs)|\.claude\/hooks\/adb-guard(\.test)?\.mjs)$/; // contêm os padrões, não comandos
const PERIGOS = [
  [/\bpm\s+(uninstall|clear|disable(-user)?|hide|suspend)\b/, 'pm destrutivo'],
  [/\badb\b[^\n]*\buninstall\b/, 'adb uninstall'],
  [/\bcmd\s+package\s+compile\b/, 'compile (derrubou o A13)'],
  [/\bwm\s+(density|size)\b/, 'wm density/size'],
  [/\b(adb\s+reboot|reboot\s+(bootloader|recovery))\b|\bfastboot\b/, 'reboot/fastboot'],
  [/\b(wipe|factory[-_ ]?reset)\b/i, 'wipe/factory'],
  [/rm\s+-rf\s+\/(sdcard|storage|data)\b/, 'rm -rf no aparelho'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/\b(ghp_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35})\b/, 'token/segredo'],
];

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
const raiz = () => git('rev-parse', '--show-toplevel');

export function linhaDa(id, textos) {
  for (const t of textos) { const l = t.split(/\r?\n/).find(x => x.startsWith(`| ${id} |`)); if (l) return l; }
  return null;
}

// "Arquivos autorizados" = itens entre crases na 5ª coluna; ** = qualquer caminho, * = dentro da pasta
export function padroes(linha) {
  const col = (linha || '').split('|')[5] || '';
  // a palavra "testes" fora das crases libera arquivos de teste
  const testes = /\btestes?\b/i.test(col.replace(/`[^`]*`/g, '')) ? [/(^|\/)tests?\/|\.test\.[cm]?js$/] : [];
  return [...testes, ...[...col.matchAll(/`([^`]+)`/g)].map(m => m[1].trim()).filter(p => /[\w*]/.test(p) && !/\s/.test(p)).map(p => {
    const re = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
    return new RegExp(`^${re}${p.endsWith('/') ? '.*' : '(/.*)?'}$`);
  })];
}

export function foraDoEscopo(arquivos, pads) {
  if (!pads.length) return null; // tarefa sem lista entre crases: escopo indefinido, só avisa
  return arquivos.filter(f => !SEMPRE.some(r => r.test(f)) && !pads.some(r => r.test(f)));
}

// linhas acrescentadas (diff -U0) em arquivos de código, ignorando comentários
export function perigos(diff) {
  const achados = []; let arq = '';
  for (const l of diff.split(/\r?\n/)) {
    if (l.startsWith('+++ ')) { arq = l.replace(/^\+\+\+ (b\/)?/, ''); continue; }
    if (!l.startsWith('+') || !CODIGO.test(arq) || TRAVAS.test(arq)) continue;
    const s = l.slice(1).trim();
    if (/^(#|\/\/|REM\b|::)/i.test(s)) continue;
    for (const [re, nome] of PERIGOS) if (re.test(s)) achados.push(`${arq}: ${nome} → ${s.slice(0, 90)}`);
  }
  return achados;
}

// controle da fila: ninguém rebaixa o estado de tarefa que não cita (cópia velha do TASKS) nem apaga linha do LOG (append-only)
const ORDEM = ['BACKLOG', 'READY', 'IN_PROGRESS', 'TESTING', 'REVIEW', 'DONE'];
export function fila(diff, ids) {
  const achados = [], antes = new Map(), depois = new Map(); let arq = '';
  for (const l of diff.split(/\r?\n/)) {
    if (l.startsWith('+++ ') || l.startsWith('--- ')) { if (l.startsWith('+++ ')) arq = l.replace(/^\+\+\+ (b\/)?/, ''); continue; }
    if (arq === 'docs/LOG.md' && l.startsWith('-')) achados.push(`apagou linha do LOG (só acrescentar): ${l.slice(1, 80)}`);
    if (arq !== '.collab/TASKS.md' || !/^[-+]\| T\d+ \|/.test(l)) continue;
    const c = l.slice(1).split('|'); (l[0] === '-' ? antes : depois).set(c[1].trim(), c[6]?.trim());
  }
  for (const [id, era] of antes) {
    const virou = depois.get(id);
    if (ids.includes(id) || virou === undefined || virou === 'BLOCKED' || era === 'BLOCKED') continue;
    if (ORDEM.indexOf(virou) < ORDEM.indexOf(era)) achados.push(`${id} voltou de ${era} para ${virou} sem ser citada (TASKS sobrescrito com cópia velha?)`);
  }
  return achados;
}

function textosTarefas(r) {
  return ['.collab/TASKS.md', '.collab/TASKS_FEITAS.md'].map(f => { try { return readFileSync(`${r}/${f}`, 'utf8'); } catch { return ''; } });
}

function conferir(ids, arquivos, diff, textos) {
  const erros = [], avisos = [];
  const pads = ids.flatMap(id => { const l = linhaDa(id, textos); if (!l) avisos.push(`${id} não está no TASKS`); return padroes(l); });
  const fora = ids.length ? foraDoEscopo(arquivos, pads) : null;
  if (fora === null && ids.length) avisos.push(`escopo indefinido para ${ids.join(' ')} (sem arquivos entre crases)`);
  if (fora?.length) erros.push(`fora dos arquivos autorizados de ${ids.join(' ')}: ${fora.join(', ')}`);
  for (const p of perigos(diff)) erros.push(`perigo: ${p}`);
  for (const p of fila(diff, ids)) erros.push(`fila: ${p}`);
  return { erros, avisos };
}

function modoMsg(arqMsg) {
  const r = raiz(), msg = readFileSync(arqMsg, 'utf8');
  const ids = [...new Set(msg.match(/\bT\d+\b/g) || [])];
  const arquivos = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const { erros, avisos } = conferir(ids, arquivos, git('diff', '--cached', '-U0'), textosTarefas(r));
  for (const a of avisos) console.error(`escopo: aviso: ${a}`);
  if (!erros.length) return 0;
  if (/OK-RYAN:/.test(msg)) { console.error(`escopo: liberado por OK-RYAN (${erros.length} achado(s) registrados no commit)`); return 0; }
  console.error(`escopo: COMMIT TRAVADO (§11)\n- ${erros.join('\n- ')}\nCorrija, ou peça ao CHEFE para ampliar os arquivos autorizados da tarefa.`);
  return 1;
}

function modoReview() {
  const r = raiz(), textos = textosTarefas(r);
  const ids = textos[0].split(/\r?\n/).filter(l => /^\| T\d+ \|/.test(l) && l.split('|')[6]?.trim() === 'REVIEW').map(l => l.split('|')[1].trim());
  let ruim = 0;
  for (const id of ids) {
    const commits = git('log', '-E', `--grep=\\b${id}\\b`, '--format=%h', '-n', '15').split('\n').filter(Boolean);
    if (!commits.length) { console.log(`?    ${id}: nenhum commit cita a tarefa`); continue; }
    // cada commit vale contra todas as Txx que a mensagem dele cita (commit de duas tarefas vale para as duas)
    const erros = [], avisos = [];
    for (const c of commits) {
      const msg = git('show', '-s', '--format=%B', c);
      const ids2 = [...new Set(msg.match(/\bT\d+\b/g) || [id])];
      const arquivos = git('show', '--name-only', '--format=', c).split('\n').filter(Boolean);
      const res = conferir(ids2, arquivos, git('show', '-U0', '--format=', c), textos);
      // OK-RYAN não zera a conferência: vira aviso para o CHEFE confirmar com o Ryan
      if (/OK-RYAN:/.test(msg)) res.avisos.push(...res.erros.map(e => `${c} liberado por OK-RYAN (confirmar com o Ryan): ${e}`));
      else erros.push(...res.erros.map(e => `${c} ${e}`));
      for (const a of res.avisos) if (!avisos.includes(a)) avisos.push(a);
    }
    if (erros.length) ruim++;
    console.log(`${erros.length ? 'FALHA' : 'ok  '} ${id} (${commits.length} commit(s): ${commits.slice(0, 4).join(' ')})${[...erros, ...avisos].map(e => `\n     - ${e}`).join('')}`);
  }
  if (!ids.length) console.log('nenhuma tarefa em REVIEW');
  return ruim ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [modo, arg] = process.argv.slice(2);
  try { process.exit(modo === '--msg' ? modoMsg(arg) : modoReview()); }
  catch (e) { console.error(`escopo: não conferiu (${e.message.split('\n')[0]}), commit liberado`); process.exit(0); }
}
