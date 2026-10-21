// tools/qa/entrega.mjs — Esteira de entrega (T127): as fases do verification-loop num comando só.
// Uso: node tools/qa/entrega.mjs Txx [--ryx <pasta>] [--sem-testes]
// Fases: escopo, testes, lint, segredo, tamanho. Uma linha por fase; PASS/FAIL no fim; sai ≠ 0 se algo falhar.
// Os arquivos da tarefa são os dos commits que citam o Txx; sem commit, vale o que está no disco (aviso no escopo).
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linhaDa, padroes, foraDoEscopo, perigos, fila } from './escopo.mjs';
import { resumoNodeTest, veredito } from './veredito.mjs';

export const FASES = ['escopo', 'testes', 'lint', 'segredo', 'tamanho'];
export const LIMITE_LINHAS_DIFF = 1500;
const COMMITS_MAX = '15';
const TEMPO_MAXIMO_MS = 300_000;
const ARQUIVO_TESTE = /\.test\.[cm]?js$/;
const ARQUIVO_JS = /\.(mjs|cjs|js)$/;
// arquivos que contêm os próprios padrões (como escopo.mjs com as suas travas)
const SEM_VARREDURA_DE_SEGREDO = /^tools\/qa\/(entrega\.mjs|test\/entrega\.test\.mjs)$/;
const PADROES_SEGREDO = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'chave AWS'],
  [/\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}/, 'token do GitHub'],
  [/\bsk-[A-Za-z0-9]{20,}/, 'chave de API (sk-)'],
  [/\b(senha|password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/i, 'credencial literal'],
];
const PLACEHOLDER = /exemplo|example|changeme|troque|xxx|\*\*\*|\$\{|process\.env/i;

/** Linhas acrescentadas no diff que parecem segredo (remoções e placeholders não contam). */
export function achaSegredos(diff) {
  const achados = [];
  let arquivo = '';
  for (const l of diff.split(/\r?\n/)) {
    if (l.startsWith('+++ ')) { arquivo = l.replace(/^\+\+\+ (b\/)?/, ''); continue; }
    if (!l.startsWith('+') || SEM_VARREDURA_DE_SEGREDO.test(arquivo)) continue;
    const texto = l.slice(1);
    if (PLACEHOLDER.test(texto)) continue;
    for (const [re, nome] of PADROES_SEGREDO) if (re.test(texto)) achados.push(`${arquivo}: ${nome}`);
  }
  return achados;
}

function gitPadrao(raiz) {
  return (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true });
}

function rodarPadrao(cmd, args, cwd) {
  // dentro de outro `node --test` o filho herda NODE_TEST_CONTEXT e sai 0 mesmo falhando
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', timeout: TEMPO_MAXIMO_MS, windowsHide: true, maxBuffer: 1 << 26 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`, travou: r.signal === 'SIGTERM' };
}

function linhas(texto) {
  return texto.split(/\r?\n/).filter(Boolean);
}

function coletar(id, git) {
  const commits = linhas(git('log', '-E', `--grep=\\b${id}\\b`, '--format=%h', '-n', COMMITS_MAX));
  if (!commits.length) {
    const arquivos = [...new Set([...linhas(git('diff', 'HEAD', '--name-only')), ...linhas(git('ls-files', '--others', '--exclude-standard'))])];
    return { commits, arquivos, diff: git('diff', 'HEAD', '-U0') };
  }
  const arquivos = [...new Set(commits.flatMap((c) => linhas(git('show', '--name-only', '--format=', c))))];
  const diff = commits.map((c) => git('show', '-U0', '--format=', c)).join('\n');
  return { commits, arquivos, diff };
}

function faseEscopo(id, dados, raiz) {
  const tasks = readFileSync(join(raiz, '.collab/TASKS.md'), 'utf8');
  const feitas = existsSync(join(raiz, '.collab/TASKS_FEITAS.md')) ? readFileSync(join(raiz, '.collab/TASKS_FEITAS.md'), 'utf8') : '';
  const linha = linhaDa(id, [tasks, feitas]);
  if (!linha) return { ok: false, resumo: `${id} não está no TASKS` };
  const erros = [];
  const fora = foraDoEscopo(dados.arquivos, padroes(linha));
  if (fora?.length) erros.push(`fora dos arquivos autorizados: ${fora.join(', ')}`);
  erros.push(...perigos(dados.diff).map((p) => `perigo: ${p}`), ...fila(dados.diff, [id]).map((p) => `fila: ${p}`));
  const origem = dados.commits.length ? `${dados.commits.length} commit(s)` : 'sem commit, valendo o que está no disco';
  return erros.length ? { ok: false, resumo: erros.join(' | ') } : { ok: true, resumo: `${dados.arquivos.length} arquivo(s) dentro da lista (${origem})` };
}

function faseTestes(dados, { raiz, run, semTestes }) {
  const arquivos = dados.arquivos.filter((f) => ARQUIVO_TESTE.test(f) && existsSync(join(raiz, f)));
  if (!arquivos.length) return semTestes ? { ok: true, resumo: 'sem testes (dispensado por --sem-testes)' } : { ok: false, resumo: 'nenhum arquivo de teste na tarefa (use --sem-testes só em tarefa de documento)' };
  const r = run(process.execPath, ['--test', ...arquivos.map((f) => join(raiz, f))], raiz);
  let s;
  try { s = resumoNodeTest(r.out); } catch (e) { return { ok: false, resumo: `${e.message} · código de saída ${r.code}` }; }
  const v = veredito(r, s, arquivos[0]);
  const base = `${s.passou}/${s.testes} ok em ${arquivos.length} arquivo(s)`;
  return v.ok ? { ok: true, resumo: base } : { ok: false, resumo: `${base} · ${v.motivo}${s.falhas.length ? ` · ${s.falhas.join('; ')}` : ''}` };
}

function faseLint(dados, { raiz, run, ryx }) {
  const erros = [];
  const js = dados.arquivos.filter((f) => ARQUIVO_JS.test(f) && existsSync(join(raiz, f)));
  for (const f of js) if (run(process.execPath, ['--check', join(raiz, f)], raiz).code !== 0) erros.push(`node --check ${f}`);
  if (ryx) {
    if (run('python', ['-m', 'ruff', 'check', '.'], ryx).code !== 0) erros.push('ruff check');
    if (run('python', ['-m', 'ruff', 'format', '--check', '.'], ryx).code !== 0) erros.push('ruff format --check');
  }
  const o = `${js.length} .mjs/.js${ryx ? ' + ruff no ryx' : ''}`;
  return erros.length ? { ok: false, resumo: `falhou: ${erros.join(', ')}` } : { ok: true, resumo: o };
}

function faseSegredo(dados) {
  const achados = achaSegredos(dados.diff);
  return achados.length ? { ok: false, resumo: achados.join(' | ') } : { ok: true, resumo: 'nada suspeito nas linhas acrescentadas' };
}

function faseTamanho(dados) {
  const n = dados.diff.split(/\r?\n/).filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
  const resumo = `${n} linha(s) acrescentada(s) (limite ${LIMITE_LINHAS_DIFF})`;
  return n > LIMITE_LINHAS_DIFF ? { ok: false, resumo: `${resumo}: divida a tarefa` } : { ok: true, resumo };
}

/** Roda as cinco fases e devolve { fases: [{ nome, ok, resumo }], ok }. `git` e `run` são injetáveis para teste. */
export async function entrega(id, { raiz, git = gitPadrao(raiz), run = rodarPadrao, ryx, semTestes = false } = {}) {
  const dados = coletar(id, git);
  const opcoes = { raiz, run, ryx, semTestes };
  const resultados = [
    ['escopo', () => faseEscopo(id, dados, raiz)],
    ['testes', () => faseTestes(dados, opcoes)],
    ['lint', () => faseLint(dados, opcoes)],
    ['segredo', () => faseSegredo(dados)],
    ['tamanho', () => faseTamanho(dados)],
  ];
  const fases = resultados.map(([nome, f]) => {
    try { return { nome, ...f() }; } catch (e) { return { nome, ok: false, resumo: `erro: ${e.message.split('\n')[0]}` }; }
  });
  return { fases, ok: fases.every((f) => f.ok) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const semTestes = args.includes('--sem-testes');
  const i = args.indexOf('--ryx');
  const ryx = i >= 0 ? resolve(args.splice(i, 2)[1]) : undefined;
  const id = args.find((a) => /^T\d+$/.test(a));
  if (!id) { console.error('uso: node tools/qa/entrega.mjs Txx [--ryx <pasta>] [--sem-testes]'); process.exit(2); }
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  entrega(id, { raiz, ryx, semTestes }).then((r) => {
    for (const f of r.fases) console.log(`${f.ok ? 'ok  ' : 'FALHA'} ${f.nome} · ${f.resumo}`);
    console.log(r.ok ? `PASS ${id}` : `FAIL ${id}`);
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => { console.error(`entrega: ${e.message}`); process.exit(2); });
}
