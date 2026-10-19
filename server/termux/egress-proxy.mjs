// Proxy de saída do Claude Code no A13 (projeto celular).
// Por quê: o Claude Code é um binário musl de 64 bits e procura o DNS em /etc/resolv.conf,
// que não existe no Android (sem root não dá para criar). Este proxy roda no Node do Termux,
// que resolve DNS normalmente, e só aceita CONNECT para domínios permitidos.
// Escuta só em 127.0.0.1: nada da rede chega nele.
import { createServer } from "node:http";
import { connect } from "node:net";
import { pathToFileURL } from "node:url";

const DEFAULT_ALLOW = "anthropic.com,claude.ai,claude.com";

export function parseAllow(list = process.env.EGRESS_ALLOW || DEFAULT_ALLOW) {
  return String(list).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** Domínio exato ou subdomínio de um permitido. "evilanthropic.com" NÃO casa com "anthropic.com". */
export function allowed(host, allow = parseAllow()) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!h || h.includes("/") || h.includes("@")) return false;
  return allow.some(d => h === d || h.endsWith(`.${d}`));
}

export function createProxy({ allow = parseAllow(), connectFn = connect, log = console.log } = {}) {
  const server = createServer((req, res) => {
    // só HTTPS (CONNECT); HTTP puro é recusado
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("proxy: so CONNECT para dominios permitidos\n");
  });

  server.on("connect", (req, client, head) => {
    const m = /^([^:\s]+):(\d{1,5})$/.exec(req.url || "");
    const host = m?.[1], port = Number(m?.[2]);
    if (!m || port !== 443 || !allowed(host, allow)) {
      log(`[egress] NEGADO ${req.url}`);
      if (!client.destroyed && client.writable) {
        try { client.end("HTTP/1.1 403 Forbidden\r\n\r\n"); } catch {}
      }
      return;
    }
    let established = false;
    const upstream = connectFn(port, host, () => {
      established = true;
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head?.length) upstream.write(head);
      upstream.pipe(client); client.pipe(upstream);
    });
    const close = () => { upstream.destroy(); client.destroy(); };
    upstream.setTimeout(300_000, close);
    upstream.on("error", e => {
      log(`[egress] erro ${host}: ${e.code || e.message}`);
      // antes do 200 dá para responder 502; depois, o canal já é TLS do cliente: só fecha (achado Q4)
      if (!established) {
        if (!client.destroyed && client.writable) {
          try { client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); } catch {}
        }
      } else client.destroy();
    });
    client.on("error", close);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.EGRESS_PORT) || 8091;
  const allow = parseAllow();
  createProxy({ allow }).listen(port, "127.0.0.1", () => console.log(`[egress] ouvindo em 127.0.0.1:${port}; permitidos: ${allow.join(", ")}`));
}
