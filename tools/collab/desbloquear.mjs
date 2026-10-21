// tools/collab/desbloquear.mjs — Despacho automático (T129, §13): passa para READY a tarefa BACKLOG cujas dependências viraram DONE.
// Uso: node tools/collab/desbloquear.mjs [--aplicar] [--raiz <pasta>]   (sem --aplicar só simula e não grava nada)
// Vale para READY só com: dependências DONE (no quadro ou em TASKS_FEITAS), dono, critérios (coluna "Testes exigidos") e "porte:".
// Dependência em texto livre ("físico", "login do Ryan") é ação humana: continua aberta até alguém reescrever a célula.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// posição de cada coluna depois de split('|') (a 0 é o vazio antes da primeira barra)
const COL = { id: 1, agente: 3, depende: 4, estado: 6, testes: 7, pendencias: 9 };
const SO_TRACO = /^[—–-]*$/;
const ehTarefa = l => /^\| T\d+ \|/.test(l);

/** "T96, T103" → ids; o que sobrar fora os conectores (e , ; + /) é dependência em texto livre. */
export function dependencias(texto) {
  const t = (texto || '').trim();
  const ids = [...t.matchAll(/\bT\d+\b/g)].map(m => m[0]);
  const resto = t.replace(/\bT\d+\b/g, ' ').replace(/[,;+/]/g, ' ').replace(/(^|\s)e(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim();
  return { ids, livre: SO_TRACO.test(resto) ? '' : resto };
}

function estadosDo(texto) {
  const mapa = new Map();
  for (const l of texto.split('\n')) if (ehTarefa(l)) { const c = l.split('|'); mapa.set(c[COL.id].trim(), c[COL.estado].trim()); }
  return mapa;
}

/** Devolve o motivo de a tarefa ainda não poder ir para READY, ou null se pode. porDependencia diz de que lado veio o motivo. */
function motivoDeRetencao(c, feita, estados) {
  const { ids, livre } = dependencias(c[COL.depende]);
  const abertas = ids.filter(id => !feita(id));
  if (abertas.length) return { porDependencia: true, motivo: `espera ${abertas.map(id => (estados.has(id) ? `${id} (${estados.get(id)})` : `${id} (não existe no quadro)`)).join(', ')}` };
  if (livre) return { porDependencia: true, motivo: `dependência fora do quadro: "${livre}"` };
  if (SO_TRACO.test((c[COL.testes] || '').trim())) return { porDependencia: false, motivo: 'sem critérios de aceite (coluna Testes exigidos)' };
  if (!/\bporte:\s*\S+/i.test(c[COL.pendencias] || '')) return { porDependencia: false, motivo: 'sem porte: nas Pendências' };
  if (!(c[COL.agente] || '').trim()) return { porDependencia: false, motivo: 'sem dono' };
  return null;
}

/** tasks/feitas = texto de TASKS.md e TASKS_FEITAS.md. Devolve o TASKS.md novo (só a célula Estado muda), as liberadas e as retidas. */
export function desbloquear(tasks, feitas = '') {
  const estados = estadosDo(tasks);
  const feitasIds = new Set(estadosDo(feitas).keys());
  const feita = id => estados.get(id) === 'DONE' || feitasIds.has(id);
  const liberadas = [], retidas = [];
  const texto = tasks.split('\n').map(l => {
    if (!ehTarefa(l)) return l;
    const c = l.split('|');
    if (c[COL.estado].trim() !== 'BACKLOG') return l;
    const id = c[COL.id].trim();
    const r = motivoDeRetencao(c, feita, estados);
    if (r) { retidas.push({ id, ...r }); return l; }
    liberadas.push(id);
    c[COL.estado] = c[COL.estado].replace('BACKLOG', 'READY');
    return c.join('|');
  }).join('\n');
  return { texto, liberadas, retidas };
}

function principal(argv) {
  const aplicar = argv.includes('--aplicar');
  const i = argv.indexOf('--raiz');
  const raiz = resolve(i >= 0 ? argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const arquivo = join(raiz, '.collab', 'TASKS.md');
  const lerOpcional = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const r = desbloquear(readFileSync(arquivo, 'utf8'), lerOpcional(join(raiz, '.collab', 'TASKS_FEITAS.md')));
  if (r.liberadas.length) {
    if (aplicar) writeFileSync(arquivo, r.texto);
    console.log(`${aplicar ? 'liberadas' : 'liberaria (simulação, use --aplicar)'}: ${r.liberadas.join(' ')}`);
  } else console.log('nada a liberar');
  // dependências prontas mas ficha incompleta: é o que o CHEFE precisa completar
  const incompletas = r.retidas.filter(x => !x.porDependencia);
  if (incompletas.length) console.log(`dependências prontas, ficha incompleta: ${incompletas.map(x => `${x.id} (${x.motivo})`).join('; ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { principal(process.argv.slice(2)); } catch (e) { console.error(`desbloquear: ${e.message}`); process.exitCode = 1; }
}
