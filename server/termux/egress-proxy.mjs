// Proxy de saída do Claude Code no A13 (projeto celular).
// Por quê: o Claude Code é um binário musl de 64 bits e procura o DNS em /etc/resolv.conf,
// que não existe no Android (sem root não dá para criar). Este proxy roda no Node do Termux,
// que resolve DNS normalmente, e só aceita CONNECT para domínios permitidos.
// Escuta só em 127.0.0.1: nada da rede chega nele.
import { createServer } from "node:http";
import { connect } from "node:net";

const PORT = Number(process.env.EGRESS_PORT) || 8091;
const ALLOW = (process.env.EGRESS_ALLOW || "anthropic.com,claude.ai,claude.com").split(",").map(s => s.trim()).filter(Boolean);

export function allowed(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  return ALLOW.some(d => h === d || h.endsWith(`.${d}`));
}

const server = createServer((req, res) => {
  // só HTTPS (CONNECT); HTTP puro é recusado
  res.writeHead(403, { "Content-Type": "text/plain" });
  res.end("proxy: so CONNECT para dominios permitidos\n");
});

server.on("connect", (req, client, head) => {
  const m = /^([^:\s]+):(\d{1,5})$/.exec(req.url || "");
  const host = m?.[1], port = Number(m?.[2]);
  if (!m || port !== 443 || !allowed(host)) {
    console.log(`[egress] NEGADO ${req.url}`);
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const upstream = connect(port, host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head?.length) upstream.write(head);
    upstream.pipe(client); client.pipe(upstream);
  });
  const close = () => { upstream.destroy(); client.destroy(); };
  upstream.setTimeout(300_000, close);
  upstream.on("error", e => { console.log(`[egress] erro ${host}: ${e.code || e.message}`); client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); });
  client.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => console.log(`[egress] ouvindo em 127.0.0.1:${PORT}; permitidos: ${ALLOW.join(", ")}`));
