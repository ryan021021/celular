// Leitura do resumo do node --test e veredito de cada suíte da regressão (T83, auditoria A2).
// Fica separado de regressao.mjs porque aquele arquivo roda tudo ao ser importado.

// Suítes em que pular teste esconde prova (backup, discovery, servidor no Termux): pulado = vermelho.
// O painel fica de fora: console.test.mjs pula o teste de link simbólico no Windows sem privilégio (roda no A13).
export const CRITICAS = [/^tools\/server/, /^server\/termux/];

/** Lê o resumo do node --test (ℹ tests/pass/fail/skipped) e os nomes dos testes que falharam. */
export function resumoNodeTest(out) {
  const n = k => Number((out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
  const falhas = [...out.matchAll(/^\s*✖ (.+?) \(\d/gm)].map(m => m[1]).filter(s => s !== 'failing tests:');
  return { testes: n('tests'), passou: n('pass'), falhou: n('fail'), pulados: n('skipped'), cancelados: n('cancelled'), falhas: [...new Set(falhas)].slice(0, 20) };
}

/** Verde só se terminou no prazo, saiu com 0, nada falhou, rodou algo e (em suíte crítica) nada foi pulado. */
export function veredito(r, s, nome) {
  if (r.travou) return { ok: false, motivo: 'travou' };
  if (r.code !== 0) return { ok: false, motivo: `código de saída ${r.code}` };
  if (s.falhou !== 0) return { ok: false, motivo: `${s.falhou} falha(s)` };
  if (!(s.testes > 0)) return { ok: false, motivo: 'nenhum teste rodou' };
  if (s.pulados > 0 && CRITICAS.some(re => re.test(nome))) return { ok: false, motivo: `${s.pulados} teste(s) pulado(s) em suíte crítica` };
  return { ok: true, motivo: '' };
}
