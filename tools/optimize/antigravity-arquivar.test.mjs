import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = process.env.ARQUIVAR_SCRIPT
  ?? join(dirname(fileURLToPath(import.meta.url)), 'antigravity-arquivar.ps1');
const TIMEOUT = 30000;
const ID_VELHO = '11111111-1111-1111-1111-111111111111';
const ID_NOVO = '22222222-2222-2222-2222-222222222222';

function diasAtras(dias) {
  return new Date(Date.now() - dias * 24 * 3600 * 1000);
}

function criaArquivo(caminho, dias) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, 'x'.repeat(2048));
  utimesSync(caminho, diasAtras(dias), diasAtras(dias));
}

function montaRaiz() {
  const pasta = mkdtempSync(join(tmpdir(), 'ag-arq-'));
  const raiz = join(pasta, 'ide');
  const destino = join(pasta, 'arquivo');
  criaArquivo(join(raiz, 'conversations', `${ID_VELHO}.db`), 20);
  criaArquivo(join(raiz, 'conversations', `${ID_VELHO}.db-wal`), 20);
  criaArquivo(join(raiz, 'conversations', `${ID_NOVO}.db`), 1);
  criaArquivo(join(raiz, 'brain', ID_VELHO, 'plano.md'), 20);
  criaArquivo(join(raiz, 'brain', ID_NOVO, 'plano.md'), 1);
  criaArquivo(join(raiz, 'browser_recordings', 'velha.webp'), 20);
  criaArquivo(join(raiz, 'browser_recordings', 'nova.webp'), 1);
  return { pasta, raiz, destino };
}

function roda(args) {
  return spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: TIMEOUT,
  });
}

test('simulacao (padrao) lista o que moveria e nao move nada', () => {
  const { pasta, raiz, destino } = montaRaiz();
  try {
    const r = roda(['-Raiz', raiz, '-Destino', destino, '-Dias', '7']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /SIMULA/i);
    assert.ok(existsSync(join(raiz, 'conversations', `${ID_VELHO}.db`)), 'velho tem de continuar no lugar');
    assert.equal(existsSync(destino), false, 'destino nao pode ser criado na simulacao');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('-Aplicar move so o antigo (conversa, wal, brain e gravacao) e deixa o recente', () => {
  const { pasta, raiz, destino } = montaRaiz();
  try {
    const r = roda(['-Raiz', raiz, '-Destino', destino, '-Dias', '7', '-Aplicar']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(raiz, 'conversations', `${ID_VELHO}.db`)), false);
    assert.equal(existsSync(join(raiz, 'conversations', `${ID_VELHO}.db-wal`)), false);
    assert.equal(existsSync(join(raiz, 'brain', ID_VELHO)), false);
    assert.equal(existsSync(join(raiz, 'browser_recordings', 'velha.webp')), false);
    assert.ok(existsSync(join(destino, 'conversations', `${ID_VELHO}.db`)), 'conversa velha vai para o arquivo');
    assert.ok(existsSync(join(destino, 'conversations', `${ID_VELHO}.db-wal`)));
    assert.ok(existsSync(join(destino, 'brain', ID_VELHO, 'plano.md')));
    assert.ok(existsSync(join(destino, 'browser_recordings', 'velha.webp')));
    assert.ok(existsSync(join(raiz, 'conversations', `${ID_NOVO}.db`)), 'recente fica');
    assert.ok(existsSync(join(raiz, 'brain', ID_NOVO, 'plano.md')));
    assert.ok(existsSync(join(raiz, 'browser_recordings', 'nova.webp')));
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('nao apaga: o total de arquivos antes e depois (raiz + destino) e o mesmo', () => {
  const { pasta, raiz, destino } = montaRaiz();
  try {
    roda(['-Raiz', raiz, '-Destino', destino, '-Dias', '7', '-Aplicar']);
    const nomes = [
      join(raiz, 'conversations', `${ID_NOVO}.db`),
      join(raiz, 'brain', ID_NOVO, 'plano.md'),
      join(raiz, 'browser_recordings', 'nova.webp'),
      join(destino, 'conversations', `${ID_VELHO}.db`),
      join(destino, 'conversations', `${ID_VELHO}.db-wal`),
      join(destino, 'brain', ID_VELHO, 'plano.md'),
      join(destino, 'browser_recordings', 'velha.webp'),
    ];
    assert.equal(nomes.filter(existsSync).length, 7, 'os 7 arquivos criados tem de existir em algum lugar');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('raiz inexistente falha com mensagem e codigo diferente de zero, sem criar nada', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'ag-arq-'));
  try {
    const destino = join(pasta, 'arquivo');
    const r = roda(['-Raiz', join(pasta, 'nao-existe'), '-Destino', destino, '-Aplicar']);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /n[aã]o encontrad/i);
    assert.equal(existsSync(destino), false);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('conversa com .db antigo mas .wal recente (em uso) fica inteira no lugar', () => {
  const { pasta, raiz, destino } = montaRaiz();
  const emUso = '33333333-3333-3333-3333-333333333333';
  try {
    criaArquivo(join(raiz, 'conversations', `${emUso}.db`), 20);
    criaArquivo(join(raiz, 'conversations', `${emUso}.db-wal`), 0);
    criaArquivo(join(raiz, 'brain', emUso, 'plano.md'), 20);
    const r = roda(['-Raiz', raiz, '-Destino', destino, '-Dias', '7', '-Aplicar']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(raiz, 'conversations', `${emUso}.db`)), 'db fica porque o wal e recente');
    assert.ok(existsSync(join(raiz, 'conversations', `${emUso}.db-wal`)));
    assert.ok(existsSync(join(raiz, 'brain', emUso, 'plano.md')), 'brain da conversa em uso fica');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('-Dias fora da faixa e recusado', () => {
  const { pasta, raiz, destino } = montaRaiz();
  try {
    const r = roda(['-Raiz', raiz, '-Destino', destino, '-Dias', '0', '-Aplicar']);
    assert.notEqual(r.status, 0);
    assert.ok(existsSync(join(raiz, 'conversations', `${ID_VELHO}.db`)));
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});
