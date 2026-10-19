// tools/qa/alegacoes.mjs — Varredura de alegações sem evidência (OMNISERVER P0 R5 / Matriz T64).
// Procura por afirmações superlativas, valores mockados fixos usados como medida e estados sem evidência em docs e UI.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PADROES_ALEGACOES = [
  {
    id: 'ram_ssd_enganoso',
    re: /\b(7\.6\s*GB\s*RAM|100\s*GB\s*SSD)\b/i,
    motivo: 'Número enganoso de hardware (confunde swap com RAM ou flash com SSD)'
  },
  {
    id: 'superlativo_sem_prova',
    re: /\b(alto\s+desempenho|alta\s+performance|100%\s+segur[oa]|totalmente\s+segur[oa]|60\s*FPS\s*sem\s*crash)\b/i,
    motivo: 'Afirmação superlativa de desempenho/segurança sem comando ou prova registrada'
  },
  {
    id: 'verified_sem_evidencia',
    re: /\bVERIFIED(_WORKING)?\b(?![^|\n]*(`[^`]+`|\b\w+\.test\.[cm]?js|\b(GET|POST)\s+\/|\bhttp:\/\/))/i,
    motivo: 'Rótulo VERIFIED sem teste, rota ou comando de evidência associado na linha'
  },
  {
    id: 'medida_mockada_hardcoded',
    re: /(totalBytes:\s*105\s*\*|freeBytes:\s*74\s*\*|percent:\s*85,\s*plugged:\s*true)/i,
    motivo: 'Valor mockado fixo de hardware usado em local de leitura/medida'
  }
];

// Arquivos ou diretórios isentos da varredura
const IGNORAR = [
  /(^|\/)test(s)?\//,
  /\.test\.[cm]?js$/,
  /(^|\/)fixtures\//,
  /AFIRMACOES\.md$/,
  /test-matrix\.md$/,
  /(^|\/)reports\//,
  /(^|\/)\.collab\//,
  /(^|\/)node_modules\//
];

/**
 * Varre o conteúdo de um arquivo ou texto em busca de alegações suspeitas.
 * @param {string} caminho Relativo ou absoluto
 * @param {string} conteudo
 * @returns {Array<{ arquivo: string, linha: number, padrao: string, trecho: string, motivo: string }>}
 */
export function checarConteudo(caminho, conteudo) {
  if (IGNORAR.some(re => re.test(caminho.replace(/\\/g, '/')))) return [];
  const linhas = conteudo.split(/\r?\n/);
  const achados = [];

  linhas.forEach((linha, idx) => {
    // Ignora comentários de código e cabeçalhos explicativos
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('//') || limpa.startsWith('*') || limpa.startsWith('#')) return;

    for (const p of PADROES_ALEGACOES) {
      if (p.id === 'verified_sem_evidencia') {
        if (/\bVERIFIED(_WORKING)?\b/i.test(linha)) {
          const temEvidencia = /(`[^`]+`|\.test\.[cm]?js|\bGET\b|\bPOST\b|https?:\/\/)/i.test(linha);
          if (!temEvidencia) {
            achados.push({
              arquivo: caminho.replace(/\\/g, '/'),
              linha: idx + 1,
              padrao: p.id,
              trecho: limpa.slice(0, 100),
              motivo: p.motivo
            });
          }
        }
      } else if (p.re.test(linha)) {
        achados.push({
          arquivo: caminho.replace(/\\/g, '/'),
          linha: idx + 1,
          padrao: p.id,
          trecho: limpa.slice(0, 100),
          motivo: p.motivo
        });
      }
    }
  });

  return achados;
}

/**
 * Varre uma lista de arquivos informados.
 * @param {string[]} arquivos
 * @param {string} raiz
 */
export function varrerArquivos(arquivos, raiz = process.cwd()) {
  const achados = [];
  for (const f of arquivos) {
    const full = resolve(raiz, f);
    if (!existsSync(full)) continue;
    try {
      const stat = statSync(full);
      if (!stat.isFile()) continue;
      const conteudo = readFileSync(full, 'utf8');
      achados.push(...checarConteudo(f, conteudo));
    } catch {}
  }
  return achados;
}

// Execução direta via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let arquivos = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (arquivos.length === 0) {
    try {
      const gitOut = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
      arquivos = gitOut.split(/\r?\n/).filter(f => {
        const ext = extname(f).toLowerCase();
        return (f.startsWith('docs/') && ext === '.md') ||
               f === 'README.md' ||
               (f.includes('public/') && (ext === '.html' || ext === '.js'));
      });
    } catch {
      arquivos = ['README.md'];
    }
  }

  const achados = varrerArquivos(arquivos);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(achados, null, 2));
  } else {
    console.log(`[alegacoes] ${arquivos.length} arquivos verificados, ${achados.length} alegação(ões) encontrada(s):`);
    for (const a of achados) {
      console.log(`  ${a.arquivo}:${a.linha} [${a.padrao}]: ${a.motivo} → "${a.trecho}"`);
    }
  }
}
