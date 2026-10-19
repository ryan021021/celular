// Estado da equipe em poucas linhas: fila por agente, locks, handoffs pendentes e fim do LOG.
// Uso: node .claude/hooks/estado-equipe.mjs  (também roda como hook SessionStart; nunca falha)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = p => { try { return readFileSync(join(raiz, p), 'utf8'); } catch { return ''; } };
const SIGLAS = ['CHEFE', 'ORQ', 'BACK', 'FRONT', 'QA', 'GEM-IDE', 'RYAN'];
const out = [];

try {
  const fila = Object.fromEntries(SIGLAS.map(s => [s, { faz: [], revisa: [] }]));
  for (const l of ler('.collab/TASKS.md').split(/\r?\n/)) {
    if (!/^\| T\d+ \|/.test(l)) continue;
    const c = l.split('|').map(x => x.trim());
    const [id, , agente, , , estado] = c.slice(1);
    const pend = c[c.length - 2] || '';
    const semNotas = agente.replace(/\([^)]*\)/g, '');
    const donos = SIGLAS.filter(s => new RegExp(`\\b${s}\\b`).test(semNotas));
    const revisor = (pend.match(/revisor[a]?:\s*([A-Z][\w-]*)/) || [])[1];
    if (estado === 'REVIEW' && revisor && fila[revisor]) fila[revisor].revisa.push(id);
    for (const d of donos) fila[d].faz.push(`${id}:${estado}`);
  }
  out.push('## Equipe agora (estado-equipe)');
  for (const s of SIGLAS) {
    const { faz, revisa } = fila[s];
    if (faz.length || revisa.length) out.push(`- ${s}: ${faz.join(' ')}${revisa.length ? ` · revisar: ${revisa.join(' ')}` : ''}`);
  }

  const dirLocks = join(raiz, '.collab/locks');
  const locks = existsSync(dirLocks) ? readdirSync(dirLocks).filter(f => f.endsWith('.lock')) : [];
  for (const f of locks) {
    const min = Math.round((Date.now() - statSync(join(dirLocks, f)).mtimeMs) / 60000);
    out.push(`- lock ${f} (${min} min${min > 120 ? ', ABANDONADO?' : ''}): ${ler(`.collab/locks/${f}`).trim().slice(0, 100)}`);
  }

  const dirH = join(raiz, '.collab/handoff');
  const abertos = (existsSync(dirH) ? readdirSync(dirH) : [])
    .filter(f => f.endsWith('.md') && !/RESOLVIDO/.test(ler(`.collab/handoff/${f}`).split(/\r?\n/).slice(0, 3).join(' ')))
    .sort().slice(-4);
  if (abertos.length) out.push(`- handoffs abertos (últimos): ${abertos.join(', ')}`);

  const log = ler('docs/LOG.md').trim().split(/\r?\n/).slice(-3).map(l => `  ${l.slice(0, 170)}`);
  out.push('- LOG:', ...log);
  out.push('Regras: §9/§10 do docs/COLABORACAO.md. Feche tarefa com /fechar-tarefa (testes + revisor + DONE).');
} catch (e) {
  out.push(`(estado-equipe indisponível: ${e.message})`);
}
process.stdout.write(out.join('\n') + '\n');
