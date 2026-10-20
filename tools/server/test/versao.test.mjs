import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseArgs,
  carregarPerfil,
  listarVersoes,
  executarRollback,
  obterGitPadrao,
} from '../versao.mjs';

function gitCmd(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

test('T78 - parseArgs: interpreta flags corretamente', () => {
  const args1 = parseArgs(['--perfil', 'a15', '--listar']);
  assert.equal(args1.perfil, 'a15');
  assert.equal(args1.acao, 'listar');
  assert.equal(args1.confirmar, false);

  const args2 = parseArgs(['--perfil', 'a15', '--voltar', 'abc1234', '--confirmar', '--json']);
  assert.equal(args2.perfil, 'a15');
  assert.equal(args2.acao, 'voltar');
  assert.equal(args2.commit, 'abc1234');
  assert.equal(args2.confirmar, true);
  assert.equal(args2.json, true);

  const args3 = parseArgs(['--perfil', 'a15', '--voltar', '--confirmar']);
  assert.equal(args3.commit, null, 'não deve engolir --confirmar como commit');
  assert.equal(args3.confirmar, true);
});

test('T78 - carregarPerfil: rejeita perfil ausente ou inexistente', () => {
  assert.throws(() => carregarPerfil(null), /obrigatório/);
  assert.throws(() => carregarPerfil('perfil-fantasma-xyz'), /não encontrado/);
});

test('T78 - carregarPerfil: carrega a15 com remote e branch configurados', () => {
  const p = carregarPerfil('a15');
  assert.equal(p.perfil.id, 'a15');
  assert.equal(p.branch, 'celular');
  assert.ok(p.remote.includes('ssh://'));
});

test('T78 - ciclo completo com repositório e remoto falso: listar e rollback', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'sb-versao-test-'));

  try {
    const localDir = join(tempDir, 'local-repo');
    const remoteDir = join(tempDir, 'fake-remote.git');

    mkdirSync(localDir, { recursive: true });
    mkdirSync(remoteDir, { recursive: true });

    // 1. Inicializa repositório remoto bare
    gitCmd(['init', '--bare', remoteDir], tempDir);

    // 2. Inicializa repositório local com branch celular e dois commits
    gitCmd(['init', '-b', 'celular', localDir], tempDir);
    gitCmd(['config', 'user.name', 'Test Runner'], localDir);
    gitCmd(['config', 'user.email', 'test@example.com'], localDir);

    writeFileSync(join(localDir, 'arquivo.txt'), 'versao 1');
    gitCmd(['add', 'arquivo.txt'], localDir);
    gitCmd(['commit', '-m', 'feat: primeira versao (v1)'], localDir);
    const hashV1 = gitCmd(['rev-parse', 'HEAD'], localDir);

    writeFileSync(join(localDir, 'arquivo.txt'), 'versao 2');
    gitCmd(['add', 'arquivo.txt'], localDir);
    gitCmd(['commit', '-m', 'feat: segunda versao (v2)'], localDir);
    const hashV2 = gitCmd(['rev-parse', 'HEAD'], localDir);

    // 3. Faz o push inicial de v2 para o remoto celular
    gitCmd(['remote', 'add', 'origin', remoteDir], localDir);
    gitCmd(['push', '-u', 'origin', 'celular'], localDir);

    // Verifica que o remoto está em v2
    const remoteRefV2 = gitCmd(['rev-parse', 'refs/heads/celular'], remoteDir);
    assert.equal(remoteRefV2, hashV2);

    const perfilFake = {
      perfil: { id: 'fake-dev' },
      remote: remoteDir,
      branch: 'celular',
    };

    // 4. Teste de listarVersoes
    const listagem = await listarVersoes({
      perfilInfo: perfilFake,
      localRepo: localDir,
      git: obterGitPadrao(execFileSync),
    });

    assert.equal(listagem.perfil, 'fake-dev');
    assert.equal(listagem.remoto.acessivel, true);
    assert.equal(listagem.remoto.commitAtivo, hashV2);
    assert.equal(listagem.commitsLocais.length, 2);
    assert.equal(listagem.commitsLocais[0].noAr, true); // v2 é o mais recente e está no ar
    assert.equal(listagem.commitsLocais[1].noAr, false);

    // Cria branch isolado com commit que NÃO pertence ao histórico de 'celular'
    gitCmd(['checkout', '-b', 'outra-branch'], localDir);
    writeFileSync(join(localDir, 'arquivo-outra.txt'), 'versao outra');
    gitCmd(['add', 'arquivo-outra.txt'], localDir);
    gitCmd(['commit', '-m', 'feat: commit em outro branch'], localDir);
    const hashOutra = gitCmd(['rev-parse', 'HEAD'], localDir);
    gitCmd(['checkout', 'celular'], localDir);

    // Tentativa de rollback para commit de outro branch DEVE ser rejeitada
    await assert.rejects(
      async () => {
        await executarRollback({
          perfilInfo: perfilFake,
          commitAlvo: hashOutra,
          confirmar: true,
          localRepo: localDir,
          git: obterGitPadrao(execFileSync),
        });
      },
      /não pertence ao histórico do branch/
    );

    // 5. Teste de executarRollback SEM --confirmar (DRY-RUN)
    const dryRunResult = await executarRollback({
      perfilInfo: perfilFake,
      commitAlvo: hashV1,
      confirmar: false,
      localRepo: localDir,
      git: obterGitPadrao(execFileSync),
    });

    assert.equal(dryRunResult.executado, false);
    assert.equal(dryRunResult.modo, 'dry-run');
    assert.equal(dryRunResult.commitAlvo.hash, hashV1);
    assert.ok(dryRunResult.comando.includes('push -f'));
    assert.ok(dryRunResult.avisoDeploy && dryRunResult.avisoDeploy.includes('deploy.ps1'));

    // VERIFICAÇÃO CRÍTICA DE SEGURANÇA: o remoto continua em v2, NUNCA foi alterado
    const remoteRefAposDryRun = gitCmd(['rev-parse', 'refs/heads/celular'], remoteDir);
    assert.equal(remoteRefAposDryRun, hashV2, 'Dry-run NUNCA deve alterar o remoto');

    // 6. Teste de executarRollback COM --confirmar
    const rollbackConfirmado = await executarRollback({
      perfilInfo: perfilFake,
      commitAlvo: hashV1,
      confirmar: true,
      localRepo: localDir,
      git: obterGitPadrao(execFileSync),
    });

    assert.equal(rollbackConfirmado.executado, true);
    assert.equal(rollbackConfirmado.modo, 'confirmado');
    assert.equal(rollbackConfirmado.commitAlvo.hash, hashV1);
    assert.equal(rollbackConfirmado.commitAtivoAnterior, hashV2, 'deve registrar o commit ativo anterior');
    assert.ok(rollbackConfirmado.linhaDesfazer && rollbackConfirmado.linhaDesfazer.includes(hashV2));
    assert.ok(rollbackConfirmado.linhaDesfazer.includes('--confirmar'));
    assert.ok(rollbackConfirmado.avisoDeploy && rollbackConfirmado.avisoDeploy.includes('deploy.ps1'));

    // Agora o remoto DEVE estar em v1 após confirmação
    const remoteRefAposRollback = gitCmd(['rev-parse', 'refs/heads/celular'], remoteDir);
    assert.equal(remoteRefAposRollback, hashV1, 'Remoto deve ter voltado para o commit v1');

    // 7. Teste de rollback com commit inválido
    await assert.rejects(
      async () => {
        await executarRollback({
          perfilInfo: perfilFake,
          commitAlvo: 'hash-completamente-invalido-999999',
          confirmar: true,
          localRepo: localDir,
        });
      },
      /inválido ou não encontrado/
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T78 - listarVersoes degrada com elegância quando o remoto está inacessível', async () => {
  const perfilOffline = {
    perfil: { id: 'dev-offline' },
    remote: 'ssh://usuario-inexistente@127.0.0.1:9999/caminho/falso',
    branch: 'celular',
  };

  const fakeGit = (args, cwd) => {
    if (args[0] === 'log') {
      return 'aaa1111000000000000000000000000000000000\x00aaa1111\x002026-10-19 12:00:00\x00commit teste';
    }
    if (args[0] === 'ls-remote') {
      throw new Error('Connection refused (fake offline)');
    }
    return '';
  };

  const res = await listarVersoes({
    perfilInfo: perfilOffline,
    localRepo: process.cwd(),
    git: fakeGit,
  });

  assert.equal(res.perfil, 'dev-offline');
  assert.equal(res.remoto.acessivel, false);
  assert.ok(res.remoto.erro.includes('Connection refused'));
  assert.equal(res.commitsLocais.length, 1);
  assert.equal(res.commitsLocais[0].noAr, false);
});
