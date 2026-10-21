// tools/collab/handoff-gemini.mjs — Handoff pronto para colar no Gemini (T129, §13 do COLABORACAO).
// Uso: node tools/collab/handoff-gemini.mjs Txx [--raiz <pasta>]   (imprime no stdout; não escreve em .collab/handoff/)
// Cinco campos: objetivo, critérios de aceite, arquivos autorizados, teste que falha e comando de entrega.
// Sai 1 se a tarefa não tem critérios (o Gemini só pega tarefa com critérios) e 2 se faltar o id ou a tarefa não existir.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { linhaDa } from '../qa/escopo.mjs';

const COL = { objetivo: 2, arquivos: 5, testes: 7 };
const SO_TRACO = /^[—–-]*$/;
const ARQUIVO_TESTE = /\.test\.[cm]?js$/;
const CAMINHO_DE_TESTE = /(^|\/)tests?\/|\.test\.[cm]?js$/;

/** Arquivos de teste já escritos no disco entre os autorizados (aceita arquivo, pasta e padrão com *). */
function testesEscritos(raiz, arquivos) {
  const achados = [];
  for (const p of arquivos.filter(a => CAMINHO_DE_TESTE.test(a))) {
    const base = p.includes('*') ? p.slice(0, p.indexOf('*')) : p;
    const alvo = join(raiz, base);
    if (!existsSync(alvo)) continue;
    if (statSync(alvo).isFile()) { achados.push(base); continue; }
    for (const rel of readdirSync(alvo, { recursive: true })) {
      const norm = String(rel).replace(/\\/g, '/');
      if (ARQUIVO_TESTE.test(norm)) achados.push(`${base.replace(/\/?$/, '/')}${norm}`);
    }
  }
  return [...new Set(achados)];
}

/** tasks/feitas = texto de TASKS.md e TASKS_FEITAS.md; raiz = onde conferir se o teste já existe. */
export function handoff(id, tasks, feitas = '', raiz = '.') {
  const linha = linhaDa(id, [tasks, feitas]);
  if (!linha) return { ok: false, codigo: 2, erro: `${id} não existe no quadro` };
  const c = linha.split('|');
  const criterios = (c[COL.testes] || '').split(';').map(x => x.trim()).filter(x => x && !SO_TRACO.test(x));
  if (!criterios.length) return { ok: false, codigo: 1, erro: `${id} sem critérios de aceite (coluna Testes exigidos): não vai para o Gemini (§13)` };
  const arquivos = [...(c[COL.arquivos] || '').matchAll(/`([^`]+)`/g)].map(m => m[1].trim());
  const escritos = testesEscritos(raiz, arquivos);

  const teste = escritos.length
    ? `${escritos.map(t => `- \`${t}\``).join('\n')}\n\nRode antes de codar e confirme que falha: \`node --test ${escritos.join(' ')}\``
    : 'Nenhum teste escrito ainda. O Claude escreve o teste que falha antes (§13, tdd-guide); sem ele o Gemini não começa.';
  const aviso = escritos.length ? '' : `> AVISO: ${id} ainda não tem o teste que falha escrito; peça ao Claude antes de entregar isto ao Gemini.\n\n`;
  const texto = `# Handoff ${id} para o Gemini

${aviso}## Objetivo
${(c[COL.objetivo] || '').trim()}

## Critérios de aceite
${criterios.map(x => `- [ ] ${x}`).join('\n')}

## Arquivos autorizados
${arquivos.length ? arquivos.map(a => `- \`${a}\``).join('\n') : '- (nenhum listado entre crases: confirme com o CHEFE)'}

## Teste que falha
${teste}

## Comando de entrega
\`\`\`
node tools/qa/entrega.mjs ${id}
\`\`\`

## Regras
- Mexa só nos arquivos autorizados; sem push e sem apagar arquivo.
- Valor sem fonte: marque a tarefa BLOCKED e diga o que falta, nunca invente.
- Entrega = a saída PASS do comando acima colada no docs/LOG.md.
`;
  return { ok: true, texto };
}

function principal(argv) {
  const i = argv.indexOf('--raiz');
  const raiz = resolve(i >= 0 ? argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const id = argv.find((a, k) => /^T\d+$/.test(a) && argv[k - 1] !== '--raiz');
  if (!id) { console.error('uso: node tools/collab/handoff-gemini.mjs Txx [--raiz <pasta>]'); return 2; }
  const ler = nome => { const p = join(raiz, '.collab', nome); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
  const r = handoff(id, ler('TASKS.md'), ler('TASKS_FEITAS.md'), raiz);
  if (!r.ok) { console.error(`handoff-gemini: ${r.erro}`); return r.codigo; }
  process.stdout.write(r.texto);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = principal(process.argv.slice(2)); } catch (e) { console.error(`handoff-gemini: ${e.message}`); process.exitCode = 1; }
}
