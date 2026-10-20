#!/usr/bin/env node
/**
 * tools/server/versao.mjs - P2 repair/rollback do servidor de painel (server-box)
 *
 * Mostra as versões do painel disponíveis / ativas no aparelho e permite reverter
 * (rollback) para um commit anterior acionando o hook remoto post-receive.
 *
 * Uso:
 *   node tools/server/versao.mjs --perfil a15 [--listar]
 *   node tools/server/versao.mjs --perfil a15 --voltar <commit>            (dry-run por padrão)
 *   node tools/server/versao.mjs --perfil a15 --voltar <commit> --confirmar (aplica pelo hook)
 *   node tools/server/versao.mjs --perfil a15 --json
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const RAIZ_PROJETO = resolve(__dirname, '../..');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    perfil: null,
    acao: 'listar',
    commit: null,
    confirmar: false,
    json: false,
    localRepo: null,
    limite: 10,
    ajuda: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--perfil' || arg === '-p') {
      args.perfil = argv[++i];
    } else if (arg === '--listar' || arg === '-l') {
      args.acao = 'listar';
    } else if (arg === '--voltar' || arg === '-v') {
      args.acao = 'voltar';
      const prox = argv[i + 1];
      if (prox && !prox.startsWith('-')) {
        args.commit = argv[++i];
      } else {
        args.commit = null;
      }
    } else if (arg === '--confirmar') {
      args.confirmar = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--local-repo') {
      args.localRepo = argv[++i];
    } else if (arg === '--limite' || arg === '-n') {
      args.limite = parseInt(argv[++i], 10) || 10;
    } else if (arg === '--help' || arg === '-h') {
      args.ajuda = true;
    }
  }

  return args;
}

export function carregarPerfil(idPerfil, raiz = RAIZ_PROJETO) {
  if (!idPerfil) {
    throw new Error('Parâmetro --perfil é obrigatório.');
  }

  const arquivoPerfil = join(raiz, 'profiles', `${idPerfil}.json`);
  if (!existsSync(arquivoPerfil)) {
    throw new Error(`Perfil '${idPerfil}' não encontrado em profiles/${idPerfil}.json.`);
  }

  const bruto = readFileSync(arquivoPerfil, 'utf8');
  const perfil = JSON.parse(bruto);

  const net = perfil.network || {};
  const ip = net.ip;
  const user = net.ssh_user;
  const port = net.ssh_port || 8022;
  const branch = perfil.deploy?.branch || 'celular';

  let remote = perfil.deploy?.remote;
  if (!remote && user && ip) {
    remote = `ssh://${user}@${ip}:${port}/~/servidor/panel/server-box`;
  }

  return {
    perfil,
    ip,
    user,
    port,
    remote,
    branch,
  };
}

export function obterGitPadrao(execFn = execFileSync) {
  return function git(args, cwd, timeout = 30000) {
    return execFn('git', args, {
      cwd,
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  };
}

export async function listarVersoes({
  perfilInfo,
  localRepo = join(RAIZ_PROJETO, 'server/panel/server-box'),
  limite = 10,
  git = obterGitPadrao(),
}) {
  if (!existsSync(localRepo)) {
    throw new Error(`Repositório local do painel não encontrado em: ${localRepo}`);
  }

  // 1. Obter histórico local de commits
  let commitsLocais = [];
  try {
    const logSaida = git(
      ['log', `-${limite}`, '--format=%H%x00%h%x00%ci%x00%s', `refs/heads/${perfilInfo.branch}`],
      localRepo
    );

    if (logSaida) {
      commitsLocais = logSaida.split('\n').filter(Boolean).map(linha => {
        const [hash, shortHash, data, assunto] = linha.split('\0');
        return { hash, shortHash, data, assunto };
      });
    }
  } catch (err) {
    // Se o branch local não for encontrado, tenta HEAD
    try {
      const logSaida = git(['log', `-${limite}`, '--format=%H%x00%h%x00%ci%x00%s', 'HEAD'], localRepo);
      if (logSaida) {
        commitsLocais = logSaida.split('\n').filter(Boolean).map(linha => {
          const [hash, shortHash, data, assunto] = linha.split('\0');
          return { hash, shortHash, data, assunto };
        });
      }
    } catch {
      commitsLocais = [];
    }
  }

  // 2. Tentar consultar o commit ativo no aparelho via git ls-remote
  let commitAtivo = null;
  let acessivel = false;
  let erroRemoto = null;

  if (perfilInfo.remote) {
    try {
      const lsSaida = git(
        ['ls-remote', perfilInfo.remote, `refs/heads/${perfilInfo.branch}`],
        localRepo,
        8000 // 8s timeout para evitar travas em rede
      );
      if (lsSaida) {
        const partes = lsSaida.split(/\s+/);
        if (partes[0]) {
          commitAtivo = partes[0];
          acessivel = true;
        }
      }
    } catch (err) {
      acessivel = false;
      erroRemoto = err.message || String(err);
    }
  }

  return {
    perfil: perfilInfo.perfil.id,
    remoto: {
      url: perfilInfo.remote,
      branch: perfilInfo.branch,
      commitAtivo,
      acessivel,
      erro: erroRemoto,
    },
    commitsLocais: commitsLocais.map(c => ({
      ...c,
      noAr: commitAtivo ? c.hash === commitAtivo || commitAtivo.startsWith(c.hash) : false,
    })),
  };
}

export async function executarRollback({
  perfilInfo,
  commitAlvo,
  confirmar = false,
  localRepo = join(RAIZ_PROJETO, 'server/panel/server-box'),
  git = obterGitPadrao(),
}) {
  if (!existsSync(localRepo)) {
    throw new Error(`Repositório local não encontrado em: ${localRepo}`);
  }
  if (!commitAlvo) {
    throw new Error('Informe o commit de destino com --voltar <commit>.');
  }

  // 1. Validar e resolver o commit no repositório local
  let fullHash = null;
  let shortHash = null;
  let assunto = null;

  try {
    fullHash = git(['rev-parse', '--verify', `${commitAlvo}^{commit}`], localRepo);
    shortHash = git(['rev-parse', '--short', fullHash], localRepo);
    assunto = git(['log', '-1', '--format=%s', fullHash], localRepo);
  } catch {
    throw new Error(`Commit inválido ou não encontrado no repositório local: '${commitAlvo}'`);
  }

  // 1.1 Exigir que o commit pertença ao histórico do branch de destino (ancestral de refs/heads/<branch>)
  let isAncestor = false;
  try {
    git(['merge-base', '--is-ancestor', fullHash, `refs/heads/${perfilInfo.branch}`], localRepo);
    isAncestor = true;
  } catch {
    // Tenta também sem o prefixo refs/heads/
    try {
      git(['merge-base', '--is-ancestor', fullHash, perfilInfo.branch], localRepo);
      isAncestor = true;
    } catch {
      isAncestor = false;
    }
  }

  if (!isAncestor) {
    throw new Error(
      `Commit '${commitAlvo}' (${shortHash}) não pertence ao histórico do branch '${perfilInfo.branch}'. Rollback recusado.`
    );
  }

  // 1.2 Consultar o commit ativo anterior no aparelho via ls-remote (se acessível)
  let commitAtivoAnterior = null;
  if (perfilInfo.remote) {
    try {
      const lsSaida = git(
        ['ls-remote', perfilInfo.remote, `refs/heads/${perfilInfo.branch}`],
        localRepo,
        8000
      );
      if (lsSaida) {
        const partes = lsSaida.split(/\s+/);
        if (partes[0]) {
          commitAtivoAnterior = partes[0];
        }
      }
    } catch {
      commitAtivoAnterior = null;
    }
  }

  const idPerfil = perfilInfo.perfil?.id || perfilInfo.perfil || 'aparelho';
  const linhaDesfazer = commitAtivoAnterior
    ? `node tools/server/versao.mjs --perfil ${idPerfil} --voltar ${commitAtivoAnterior} --confirmar`
    : null;
  const avisoDeploy =
    'Atenção: o próximo deploy (deploy.ps1) enviará o branch local atual e poderá desfazer este rollback se o repositório local não for alinhado com a versão revertida.';

  const comandoPush = ['push', '-f', perfilInfo.remote, `${fullHash}:refs/heads/${perfilInfo.branch}`];

  // 2. Sem --confirmar: comportamento DRY-RUN estrito
  if (!confirmar) {
    return {
      executado: false,
      modo: 'dry-run',
      perfil: idPerfil,
      commitAlvo: {
        hash: fullHash,
        shortHash,
        assunto,
      },
      commitAtivoAnterior,
      linhaDesfazer,
      avisoDeploy,
      comando: `git -C ${localRepo} ${comandoPush.join(' ')}`,
      mensagem:
        'Operação em DRY-RUN. Nenhum comando de force-push foi enviado ao aparelho. Use --confirmar para aplicar o rollback.',
    };
  }

  // 3. Com --confirmar: executa o force push disparando o hook remoto post-receive
  let saidaPush = '';
  try {
    saidaPush = git(comandoPush, localRepo, 60000);
  } catch (err) {
    throw new Error(`Falha ao executar force push no remoto: ${err.stderr || err.message}`);
  }

  return {
    executado: true,
    modo: 'confirmado',
    perfil: idPerfil,
    commitAlvo: {
      hash: fullHash,
      shortHash,
      assunto,
    },
    commitAtivoAnterior,
    linhaDesfazer,
    avisoDeploy,
    saida: saidaPush,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.ajuda) {
    console.log(`
Uso: node tools/server/versao.mjs --perfil <aparelho> [opções]

Opções:
  --perfil, -p <nome>       Identificador do perfil (ex.: a15, a13) [obrigatório]
  --listar, -l              Lista versões locais e destaca a versão ativa no aparelho (padrão)
  --voltar, -v <commit>     Prepara ou aplica rollback para o commit especificado
  --confirmar               Aplica o force push no aparelho (sem esta flag, roda em dry-run)
  --json                    Saída em formato JSON
  --limite, -n <qtd>        Quantidade de commits a listar (padrão: 10)
  --local-repo <caminho>    Caminho alternativo para o repositório server-box
    `);
    process.exit(0);
  }

  if (!args.perfil) {
    console.error('Erro: informe o perfil com --perfil <aparelho> (ex: --perfil a15).');
    process.exit(2);
  }

  let perfilInfo;
  try {
    perfilInfo = carregarPerfil(args.perfil);
  } catch (err) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }

  const localRepo = args.localRepo || join(RAIZ_PROJETO, 'server/panel/server-box');

  if (args.acao === 'voltar') {
    if (!args.commit) {
      console.error('Erro: informe o commit de destino com --voltar <commit>.');
      process.exit(2);
    }

    try {
      const res = await executarRollback({
        perfilInfo,
        commitAlvo: args.commit,
        confirmar: args.confirmar,
        localRepo,
      });

      if (args.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }

      if (!res.executado) {
        console.log(`\n[DRY-RUN] Simulação de Rollback para o aparelho '${res.perfil}':`);
        console.log(`  Commit Alvo: ${res.commitAlvo.shortHash} - ${res.commitAlvo.assunto}`);
        console.log(`  Hash Completo: ${res.commitAlvo.hash}`);
        if (res.commitAtivoAnterior) {
          console.log(`  Versão ativa atual: ${res.commitAtivoAnterior.slice(0, 7)}`);
        }
        console.log(`  Comando a executar:\n    ${res.comando}`);
        console.log(`\nAVISO: ${res.avisoDeploy}`);
        console.log(`Para aplicar o rollback via post-receive hook, execute com a flag --confirmar:\n`);
        console.log(`  node tools/server/versao.mjs --perfil ${res.perfil} --voltar ${args.commit} --confirmar\n`);
      } else {
        console.log(`\n[SUCESSO] Rollback executado com sucesso no aparelho '${res.perfil}':`);
        console.log(`  Commit Ativo: ${res.commitAlvo.shortHash} - ${res.commitAlvo.assunto}`);
        if (res.commitAtivoAnterior) {
          console.log(`  Versão anterior no ar: ${res.commitAtivoAnterior.slice(0, 7)}`);
        }
        if (res.linhaDesfazer) {
          console.log(`\nPara desfazer este rollback e re-aplicar a versão anterior:`);
          console.log(`  ${res.linhaDesfazer}`);
        }
        console.log(`\nAVISO: ${res.avisoDeploy}`);
        if (res.saida) console.log(`\nSaída do hook:\n${res.saida}`);
      }
    } catch (err) {
      console.error(`\n[ERRO] Falha no rollback: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    // Listar
    try {
      const res = await listarVersoes({
        perfilInfo,
        localRepo,
        limite: args.limite,
      });

      if (args.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }

      console.log(`\nVersões do painel (server-box) para o perfil '${res.perfil}':`);
      console.log(`  Remoto: ${res.remoto.url || '(não configurado)'}`);
      console.log(`  Branch: ${res.remoto.branch}`);
      if (res.remoto.acessivel) {
        console.log(`  Versão ativa no aparelho: ${res.remoto.commitAtivo}`);
      } else {
        console.log(`  Aparelho inacessível no momento: ${res.remoto.erro || 'sem resposta de rede'}`);
      }

      console.log('\nHistórico recente (local):');
      for (const c of res.commitsLocais) {
        const badge = c.noAr ? ' [NO AR] *' : '         ';
        console.log(`  ${badge} ${c.shortHash} (${c.data.slice(0, 10)}) ${c.assunto}`);
      }
      console.log('\nPara reverter para uma versão anterior:');
      console.log(`  node tools/server/versao.mjs --perfil ${res.perfil} --voltar <commit> [--confirmar]\n`);
    } catch (err) {
      console.error(`\n[ERRO] Falha ao listar versões: ${err.message}\n`);
      process.exit(1);
    }
  }
}

// Executa direto se invocado como script
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
