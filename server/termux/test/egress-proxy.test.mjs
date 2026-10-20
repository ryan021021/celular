// Rodar com: node --test server/termux/test/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { connect, createServer } from "node:net";
import { EventEmitter } from "node:events";
import { allowed, createProxy, parseAllow } from "../egress-proxy.mjs";

const ALLOW = parseAllow("anthropic.com,claude.ai,claude.com");

test("allowed: domínio e subdomínios permitidos; parecidos e truques não", () => {
  for (const h of ["anthropic.com", "api.anthropic.com", "API.Anthropic.COM.", "claude.ai", "x.claude.com"]) assert.ok(allowed(h, ALLOW), h);
  for (const h of ["evilanthropic.com", "anthropic.com.evil.com", "claude.ai.attacker.net", "", "example.com", "anthropic.com@evil.com", "a/anthropic.com"]) assert.equal(allowed(h, ALLOW), false, h);
});

function startProxy(t, connectFn) {
  const logs = [];
  const server = createProxy({ allow: ALLOW, connectFn, log: m => logs.push(m) });
  return new Promise(r => server.listen(0, "127.0.0.1", () => { t.after(() => server.close()); r({ port: server.address().port, logs }); }));
}

function rawConnect(port, target) {
  return new Promise(resolve => {
    const s = connect(port, "127.0.0.1", () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
    let data = "";
    s.on("data", c => { data += c; });
    s.on("close", () => resolve(data));
    s.on("error", () => resolve(data));
    setTimeout(() => s.destroy(), 1500);
  });
}

test("CONNECT para domínio não permitido ou porta diferente de 443 dá 403", async t => {
  const { port } = await startProxy(t, () => { throw new Error("não deveria conectar"); });
  assert.match(await rawConnect(port, "example.com:443"), /403/);
  assert.match(await rawConnect(port, "api.anthropic.com:80"), /403/);
  assert.match(await rawConnect(port, "evilanthropic.com:443"), /403/);
});

test("erro ANTES do túnel: responde 502", async t => {
  const fake = () => { const e = new EventEmitter(); e.setTimeout = () => {}; e.destroy = () => {}; setImmediate(() => e.emit("error", Object.assign(new Error("x"), { code: "ENOTFOUND" }))); return e; };
  const { port } = await startProxy(t, fake);
  assert.match(await rawConnect(port, "api.anthropic.com:443"), /502/);
});

test("erro DEPOIS do 200: só fecha, sem escrever HTTP dentro do túnel (Q4)", async t => {
  const fake = (p, h, onConnect) => {
    const e = new EventEmitter(); e.setTimeout = () => {}; e.destroy = () => {}; e.write = () => {}; e.pipe = () => {};
    setImmediate(() => { onConnect(); setTimeout(() => e.emit("error", Object.assign(new Error("x"), { code: "ECONNRESET" })), 50); });
    return e;
  };
  const { port } = await startProxy(t, fake);
  const data = await rawConnect(port, "api.anthropic.com:443");
  assert.match(data, /200 Connection Established/);
  assert.doesNotMatch(data, /502/);
});

test("cliente destruído prematuramente antes do erro: não lança exceção (G11)", async t => {
  const fake = () => {
    const e = new EventEmitter(); e.setTimeout = () => {}; e.destroy = () => {};
    setTimeout(() => e.emit("error", Object.assign(new Error("x"), { code: "ECONNREFUSED" })), 50);
    return e;
  };
  const { port } = await startProxy(t, fake);
  const s = connect(port, "127.0.0.1", () => {
    s.write("CONNECT api.anthropic.com:443 HTTP/1.1\r\nHost: api.anthropic.com:443\r\n\r\n");
    s.destroy();
  });
  await new Promise(r => setTimeout(r, 100));
  assert.ok(true);
});

test("túnel com eco real: dados bidirecionais fluem cliente <-> upstream (mata M2)", async t => {
  const echoServer = createServer(socket => socket.pipe(socket));
  await new Promise(r => echoServer.listen(0, "127.0.0.1", r));
  const echoPort = echoServer.address().port;
  t.after(() => echoServer.close());

  const connectFn = (port, host, onConnect) => {
    return connect(echoPort, "127.0.0.1", onConnect);
  };

  const { port } = await startProxy(t, connectFn);

  const client = connect(port, "127.0.0.1");
  t.after(() => client.destroy());

  const payload = "ECO_TEST_BYTES_12345";
  const resposta = await new Promise((resolve, reject) => {
    client.on("connect", () => {
      client.write("CONNECT api.anthropic.com:443 HTTP/1.1\r\nHost: api.anthropic.com:443\r\n\r\n");
    });

    let handshakeConcluido = false;
    let acumulado = "";

    client.on("data", chunk => {
      const txt = chunk.toString();
      if (!handshakeConcluido) {
        if (txt.includes("200 Connection Established")) {
          handshakeConcluido = true;
          client.write(payload);
        }
      } else {
        acumulado += txt;
        if (acumulado.includes(payload)) {
          resolve(acumulado);
        }
      }
    });

    client.on("error", reject);
    setTimeout(() => reject(new Error("Timeout aguardando eco no túnel")), 2000);
  });

  assert.match(resposta, new RegExp(payload), "Payload enviado deve ser retornado pelo eco do túnel");
});

