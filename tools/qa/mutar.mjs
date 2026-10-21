// tools/qa/mutar.mjs — Mutação simples (T95): troca operadores e remove `throw` numa CÓPIA temporária
// e roda o teste; mutante que o teste não derruba é um buraco no teste.
// Uso: node tools/qa/mutar.mjs <arquivo.mjs> <arquivo.test.mjs> [--raiz <dir>] [--copiar <dir>,...]
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEMPO_MAXIMO_MS = 60_000;
const OPERADORES = [
  ['===', '!=='], ['!==', '==='], ['>=', '>'], ['<=', '<'], ['>', '>='], ['<', '<='],
];

// Marca quais caracteres são código (fora de string, template e comentário).
function mascaraDeCodigo(texto) {
  const codigo = new Array(texto.length).fill(false);
  let aspa = null;
  let bloco = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const par = texto.slice(i, i + 2);
    if (bloco) { if (par === '*/') { bloco = false; i++; } continue; }
    if (aspa) {
      if (c === '\\') { i++; continue; }
      if (c === aspa || (c === '\n' && aspa !== '`')) aspa = null;
      continue;
    }
    if (par === '/*') { bloco = true; i++; continue; }
    if (par === '//') { while (i < texto.length && texto[i] !== '\n') i++; continue; }
    if (c === '"' || c === "'" || c === '`') { aspa = c; continue; }
    codigo[i] = true;
  }
  return codigo;
}

function operadorEm(texto, i) {
  for (const [de, para] of OPERADORES) {
    if (!texto.startsWith(de, i)) continue;
    const antes = texto[i - 1];
    const depois = texto[i + de.length];
    if (de === '>' || de === '<') {
      if (antes === '=' || antes === '-' || antes === de || depois === de || depois === '=') continue;
    }
    if ((de === '>=' || de === '<=') && (antes === de[0] || antes === '=')) continue;
    return { de, para };
  }
  return null;
}

export function gerarMutantes(texto) {
  const codigo = mascaraDeCodigo(texto);
  const mutantes = [];
  const linhaDe = (i) => texto.slice(0, i).split('\n').length;
  const adicionar = (i, tamanho, novo, descricao) => mutantes.push({
    linha: linhaDe(i), descricao,
    codigo: texto.slice(0, i) + novo + texto.slice(i + tamanho),
  });
  for (let i = 0; i < texto.length; i++) {
    if (!codigo[i]) continue;
    const op = operadorEm(texto, i);
    if (op) { adicionar(i, op.de.length, op.para, `${op.de} → ${op.para}`); i += op.de.length - 1; continue; }
    if (texto.startsWith('throw', i) && !/[\w$]/.test(texto[i - 1] ?? '') && !/[\w$]/.test(texto[i + 5] ?? '')) {
      adicionar(i, 5, 'void', 'remove throw');
      i += 4;
    }
  }
  return mutantes;
}

function rodarTeste(raizTemp, teste) {
  // Dentro de outro `node --test` o filho herda NODE_TEST_CONTEXT e sai 0 mesmo falhando.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', join(raizTemp, teste)], {
    cwd: raizTemp, env, encoding: 'utf8', timeout: TEMPO_MAXIMO_MS, windowsHide: true,
  });
  return r.status === 0;
}

function dentroDe(raiz, arquivo) {
  const rel = relative(raiz, resolve(arquivo));
  if (rel.startsWith('..') || resolve(rel) === rel) throw new Error(`mutar: ${arquivo} fora da raiz ${raiz}`);
  return rel;
}

export async function mutar(arquivo, teste, { raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), copiar = [] } = {}) {
  const relArquivo = dentroDe(raiz, arquivo);
  const relTeste = dentroDe(raiz, teste);
  const original = readFileSync(arquivo, 'utf8');
  const temp = mkdtempSync(join(tmpdir(), 'mutar-'));
  try {
    const pastas = new Set([dirname(relArquivo), dirname(relTeste), ...copiar.map((p) => dentroDe(raiz, join(raiz, p)))]);
    for (const pasta of pastas) {
      cpSync(join(raiz, pasta), join(temp, pasta), {
        recursive: true, filter: (o) => !o.split(sep).includes('node_modules'),
      });
    }
    if (existsSync(join(raiz, 'package.json'))) cpSync(join(raiz, 'package.json'), join(temp, 'package.json'));
    if (!rodarTeste(temp, relTeste)) throw new Error(`mutar: o teste ${relTeste} já falha sem mutação`);
    const alvo = join(temp, relArquivo);
    const mutantes = gerarMutantes(original);
    const sobreviventes = [];
    for (const m of mutantes) {
      writeFileSync(alvo, m.codigo);
      if (rodarTeste(temp, relTeste)) {
        sobreviventes.push({ local: `${relArquivo.split(sep).join('/')}:${m.linha}`, descricao: m.descricao });
      }
    }
    const mortos = mutantes.length - sobreviventes.length;
    const resumo = `${mutantes.length} mutantes, ${mortos} mortos` +
      sobreviventes.map((s) => `\n  vivo: ${s.local} (${s.descricao})`).join('');
    return { total: mutantes.length, mortos, sobreviventes, resumo };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const raiz = valor('--raiz');
  const copiar = valor('--copiar');
  const [arquivo, teste] = args;
  if (!arquivo || !teste) { console.error('uso: node tools/qa/mutar.mjs <arquivo> <teste> [--raiz dir] [--copiar dir,dir]'); process.exit(2); }
  mutar(resolve(arquivo), resolve(teste), { ...(raiz && { raiz: resolve(raiz) }), copiar: copiar ? copiar.split(',') : [] })
    .then((r) => { console.log(r.resumo); process.exit(r.sobreviventes.length ? 1 : 0); })
    .catch((e) => { console.error(e.message); process.exit(2); });
}
