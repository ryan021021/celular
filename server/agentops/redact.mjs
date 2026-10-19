// Máscara única de segredos para logs e respostas (T65, OMNISERVER §20.1).
// Usado pelo AgentOps (core.mjs / server.mjs) e pelo worker do PC (tools/worker/worker.mjs).
// Só troca o valor secreto por [segredo]; o nome da chave, a URL e o resto do texto ficam como estão.

const MASCARA = "[segredo]";

// Ordem importa: padrões específicos antes dos genéricos.
const PADROES = [
  // chave privada PEM (bloco inteiro)
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, MASCARA],
  // tokens com prefixo conhecido: Anthropic, GitHub, AWS, Slack
  [/\bsk-ant-[A-Za-z0-9_\-]{10,}/g, MASCARA],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, MASCARA],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, MASCARA],
  [/\bAKIA[0-9A-Z]{16}\b/g, MASCARA],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, MASCARA],
  // Bearer no texto (cabeçalho ou log)
  [/\b(Bearer)\s+[A-Za-z0-9._~+\/\-]{16,}=*/gi, `$1 ${MASCARA}`],
  // senha dentro de URL: https://usuario:SENHA@host
  [/([a-z][a-z0-9+.-]*:\/\/[^\s\/:@]+:)[^\s\/@]+@/gi, `$1${MASCARA}@`],
  // segredo em query string: ?token=..., &api_key=..., &sig=...
  [/([?&][\w.-]*(?:token|key|secret|password|senha|sig|auth)[\w.-]*=)[^&\s#"']+/gi, `$1${MASCARA}`],
  // chave: valor (api_key, token, secret, password, senha, authorization), com ou sem esquema
  [/((?:api[_-]?key|token|secret|password|passwd|senha|authorization)["']?\s*[:=]\s*["']?(?:(?:Bearer|Basic|Token)\s+)?)[^\s"',;&]{8,}/gi, `$1${MASCARA}`],
];

/** Devolve uma função que mascara `text`. `secrets` são valores literais (ex.: tokens de config) com 8+ caracteres. */
export function makeRedactor(secrets = []) {
  const literais = secrets.filter(s => typeof s === "string" && s.length >= 8);
  return text => {
    let out = String(text ?? "");
    for (const s of literais) out = out.split(s).join(MASCARA);
    for (const [re, troca] of PADROES) out = out.replace(re, troca);
    return out;
  };
}

/** Atalho: redact(texto, [segredos]). */
export function redact(text, secrets = []) {
  return makeRedactor(secrets)(text);
}
