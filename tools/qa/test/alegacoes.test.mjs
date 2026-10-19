import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checarConteudo, varrerArquivos, PADROES_ALEGACOES } from '../alegacoes.mjs';

test('alegacoes: detecta números enganosos de hardware (RAM/SSD)', () => {
  const texto = 'O Galaxy A13 possui 7.6 GB RAM e 100 GB SSD para servidor.';
  const achados = checarConteudo('docs/exemplo.md', texto);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].padrao, 'ram_ssd_enganoso');
  assert.match(achados[0].motivo, /Número enganoso/);
});

test('alegacoes: detecta superlativos sem prova de desempenho/segurança', () => {
  const texto = 'Construímos uma infraestrutura de alto desempenho e 100% segura.';
  const achados = checarConteudo('docs/marketing.md', texto);
  assert.ok(achados.length >= 1);
  assert.ok(achados.some(a => a.padrao === 'superlativo_sem_prova'));
});

test('alegacoes: detecta rótulo VERIFIED isolado sem evidência na linha', () => {
  const semEvidencia = '| Subsistema | Caminho | VERIFIED | — | Sem notas |';
  const a1 = checarConteudo('docs/estado.md', semEvidencia);
  assert.equal(a1.length, 1);
  assert.equal(a1[0].padrao, 'verified_sem_evidencia');

  // Com teste associado na linha: NÃO deve acusar
  const comEvidencia = '| Subsistema | Caminho | VERIFIED | `test/api.test.mjs` (10/10 ok) |';
  const a2 = checarConteudo('docs/estado.md', comEvidencia);
  assert.equal(a2.length, 0);
});

test('alegacoes: ignora arquivos de teste e pastas isentas', () => {
  const texto = 'Afirmação com 7.6 GB RAM em arquivo de teste';
  const achados = checarConteudo('tools/qa/test/fixtures/fake.test.mjs', texto);
  assert.equal(achados.length, 0);
});

test('alegacoes: varrerArquivos integra varredura em disco com caminhos reais', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'alegacoes-test-'));
  try {
    const arquivoRuim = join(tmp, 'doc-ruim.md');
    const arquivoBom = join(tmp, 'doc-bom.md');

    writeFileSync(arquivoRuim, 'Promessa de 60 FPS sem crash garantida.\n');
    writeFileSync(arquivoBom, 'Medição documentada em `server/termux/test/watchdog.test.mjs` com 2/2 ok.\n');

    const achados = varrerArquivos([arquivoRuim, arquivoBom], tmp);
    assert.equal(achados.length, 1);
    assert.equal(achados[0].padrao, 'superlativo_sem_prova');
    assert.match(achados[0].trecho, /60 FPS/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
