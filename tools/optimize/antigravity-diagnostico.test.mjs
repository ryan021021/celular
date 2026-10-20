import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = process.env.DIAGNOSTICO_SCRIPT
  ?? join(dirname(fileURLToPath(import.meta.url)), 'antigravity-diagnostico.ps1');
const TIMEOUT = 30000;
const ID = '11111111-1111-1111-1111-111111111111';

function grava(caminho, texto) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, texto);
}

// conversa com uma chamada ao modelo que leva `segundos` ate o passo seguinte
function transcript(segundos, modelo = 'Gemini 3.8 Flash (High)') {
  const t0 = new Date('2026-10-20T12:00:00Z');
  const t1 = new Date(t0.getTime() + segundos * 1000);
  const passos = [
    { step_index: 0, type: 'USER_INPUT', created_at: t0.toISOString(),
      content: `opa The user changed setting \`Model Selection\` from None to ${modelo}. No need to comment` },
    { step_index: 1, type: 'PLANNER_RESPONSE', created_at: t0.toISOString(), content: 'ok' },
    { step_index: 2, type: 'VIEW_FILE', created_at: t1.toISOString(), content: 'x' },
  ];
  return passos.map((p) => JSON.stringify(p)).join('\n') + '\n';
}

function monta({ segundos = 10, turbo = false, superpowers = false, mcpAtivo = false, logErros = false } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'ag-diag-'));
  const raiz = join(pasta, 'ide');
  const config = join(pasta, 'config');
  const logs = join(pasta, 'logs');
  grava(join(raiz, 'brain', ID, '.system_generated', 'logs', 'transcript_full.jsonl'), transcript(segundos));
  grava(join(config, 'config.json'), JSON.stringify({
    plugins: { superpowers: { enabled: false } },
    userSettings: {
      autoExecutionPolicy: turbo ? 'CASCADE_COMMANDS_AUTO_EXECUTION_ON' : 'CASCADE_COMMANDS_AUTO_EXECUTION_OFF',
      nonWorkspaceFileAccessPolicy: 'AGENT_SETTING_POLICY_DENY',
    },
  }));
  grava(join(config, 'mcp_config.json'), JSON.stringify({
    mcpServers: { 'chrome-devtools': { command: 'npx', disabled: !mcpAtivo } },
  }));
  mkdirSync(join(config, 'plugins', 'android-cli-plugin'), { recursive: true });
  if (superpowers) grava(join(config, 'plugins', 'superpowers', 'GEMINI.md'), '@./skills/x.md');
  const linhaLog = logErros
    ? 'E1020 defaults.go:401] failed to get checkpoint config: unknown model key MODEL_PLACEHOLDER_M36\n'
    : 'I1020 tudo certo\n';
  grava(join(logs, '20261020T140000', 'ls-main.log'), linhaLog);
  // janela que abriu e fechou: pasta de log mais nova, sem ls-main.log
  grava(join(logs, '20261020T150000', 'renderer.log'), 'x\n');
  return { pasta, args: ['-Raiz', raiz, '-Config', config, '-Logs', logs] };
}

function roda(args) {
  return spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: TIMEOUT,
  });
}

function comFixture(opcoes, verifica) {
  const { pasta, args } = monta(opcoes);
  try {
    const r = roda(args);
    assert.equal(r.status, 0, r.stderr);
    verifica(r.stdout);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

test('tudo saudavel: mostra latencia e modelo, sem ALERTA', () => {
  comFixture({}, (saida) => {
    assert.match(saida, /Gemini 3\.8 Flash \(High\)/);
    assert.match(saida, /10 s/);
    assert.doesNotMatch(saida, /ALERTA/);
  });
});

test('resposta do modelo acima de 60 s gera ALERTA de limite de uso', () => {
  comFixture({ segundos: 180 }, (saida) => {
    assert.match(saida, /ALERTA.*(limite|cota)/i);
    assert.match(saida, /180 s/);
  });
});

test('execucao automatica turbo gera ALERTA', () => {
  comFixture({ turbo: true }, (saida) => assert.match(saida, /ALERTA.*autom/i));
});

test('pasta do superpowers em plugins gera ALERTA mesmo com enabled false', () => {
  comFixture({ superpowers: true }, (saida) => assert.match(saida, /ALERTA.*superpowers/i));
});

test('MCP ativo e listado; chrome-devtools ativo gera ALERTA', () => {
  comFixture({ mcpAtivo: true }, (saida) => assert.match(saida, /ALERTA.*chrome-devtools/i));
});

test('erro de checkpoint (modelo desconhecido) no log gera ALERTA', () => {
  comFixture({ logErros: true }, (saida) => assert.match(saida, /ALERTA.*checkpoint/i));
});

test('raiz inexistente nao quebra: avisa e sai com 0', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'ag-diag-'));
  try {
    const r = roda(['-Raiz', join(pasta, 'nao'), '-Config', join(pasta, 'nao'), '-Logs', join(pasta, 'nao')]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /n[aã]o encontrad/i);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});
