// Leitura de /api/v1/capabilities com token (T75). O token fica NO APARELHO: o curl roda no A15 pelo SSH,
// lê ~/servidor/painel.token e passa o cabeçalho pelo stdin do curl (-K -). O PC só recebe o JSON.
// Nada aqui imprime, grava ou põe o token em argumento de processo do PC.

/** Trecho do script de SSH (vai junto com o SCRIPT_DIAG). Só lê o token e chama o painel local. */
export const SCRIPT_CAPACIDADES = `
TOKEN_ARQ="$HOME/servidor/painel.token"
if [ ! -r "$TOKEN_ARQ" ]; then echo "CAPS_SEM_TOKEN"
elif ! command -v curl >/dev/null 2>&1; then echo "CAPS_SEM_CURL"
else
  R=$(printf 'header = "Authorization: Bearer %s"\\n' "$(cat "$TOKEN_ARQ")" | curl -s -K - -w '\\nHTTP %{http_code}' --max-time 5 http://127.0.0.1:8080/api/v1/capabilities 2>/dev/null)
  echo "CAPS_HTTP $(printf '%s' "$R" | tail -n 1 | sed 's/^HTTP //')"
  printf '%s' "$R" | sed '$d' | tr -d '\\n' | sed 's/^/CAPS_JSON /'
  echo
fi
`;

/** Lê as linhas CAPS_* da saída do SSH. Função pura. */
export function lerLinhasCapacidades(saida) {
  const r = { semToken: false, semCurl: false, http: null, corpo: null };
  for (const l of String(saida || "").split("\n")) {
    if (l === "CAPS_SEM_TOKEN") r.semToken = true;
    else if (l === "CAPS_SEM_CURL") r.semCurl = true;
    else if (l.startsWith("CAPS_HTTP ")) { const n = Number(l.slice(10)); r.http = Number.isInteger(n) && n > 0 ? n : null; }
    else if (l.startsWith("CAPS_JSON ")) r.corpo = l.slice(10);
  }
  return r;
}

const FONTE = "GET 127.0.0.1:8080/api/v1/capabilities no aparelho (token lido de ~/servidor/painel.token; curl -K -)";

/** Vira o item "capabilities" do relatório: total de itens, contagem por status, ou motivo. Função pura. */
export function itemCapacidades(saida) {
  const c = lerLinhasCapacidades(saida);
  const nao = (motivo) => ({ id: "capabilities", valor: null, estado: "unknown", fonte: FONTE, motivo, obrigatorio: false, unidade: null });
  const aviso = (motivo) => ({ ...nao(motivo), estado: "aviso" });
  if (c.semToken) return nao("sem ~/servidor/painel.token no aparelho: não há token para ler as capacidades");
  if (c.semCurl) return nao("curl ausente no aparelho: não dá para ler as capacidades");
  if (c.http === null) return nao("sem resposta do painel no aparelho");
  if (c.http === 404) return nao("endpoint ausente nesta versão do painel");
  if (c.http === 401 || c.http === 403) return aviso(`token recusado pelo painel (HTTP ${c.http})`);
  if (c.http !== 200) return aviso(`painel respondeu HTTP ${c.http} em capabilities`);
  let lista;
  try { lista = JSON.parse(c.corpo || "").capabilities; } catch { return aviso("resposta de capabilities ilegível"); }
  if (!Array.isArray(lista)) return aviso("resposta sem a lista capabilities");
  if (lista.length === 0) return aviso("lista de capabilities vazia");
  const contagem = {};
  for (const it of lista) { const s = String(it?.status ?? "sem status"); contagem[s] = (contagem[s] || 0) + 1; }
  return { id: "capabilities", valor: lista.length, estado: "ok", fonte: FONTE, motivo: null, obrigatorio: false, unidade: "itens", contagem };
}

/** Texto da contagem por status, na ordem em que aparecem: "available 9 · limited 2". */
export function textoContagem(contagem) {
  return Object.entries(contagem || {}).map(([s, n]) => `${s} ${n}`).join(" · ");
}
