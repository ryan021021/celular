import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classificar, decidir, rodar, lerGateway, lerSsid } from "../netguard.mjs";

// T81: guarda de rede, só leitura. Tudo com respostas falsas (fetch e comandos injetados); nada de rede nem de aparelho.
// Rodar com: node --test server/termux/test/netguard.test.mjs
const resp = (status) => async () => ({ status, ok: status >= 200 && status < 300 });
const semRede = async () => { throw new TypeError("fetch failed"); };

function ambiente({ ssid = null, gateway = "192.168.1.1", pingOk = true, topico = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ng-"));
  if (topico) writeFileSync(join(dir, "alertas.json"), JSON.stringify({ ntfy_topic: "topico-teste" }));
  const chamadas = [];
  const run = async (cmd, args) => {
    chamadas.push([cmd, ...args].join(" "));
    if (cmd === "ip") return gateway ? `default via ${gateway} dev wlan0\n` : null;
    if (cmd === "ping") return pingOk ? "1 packets transmitted, 1 received" : null;
    if (cmd === "termux-wifi-connectioninfo") return ssid ? JSON.stringify({ ssid: `"${ssid}"` }) : null;
    return "";
  };
  const envios = [];
  const ntfy = (probe) => async (url, opts) => {
    if (opts?.method === "POST") { envios.push(JSON.parse(opts.body)); return { status: 200, ok: true }; }
    return probe(url, opts);
  };
  const ler = () => JSON.parse(readFileSync(join(dir, "netguard.json"), "utf8"));
  return { dir, run, chamadas, envios, ntfy, ler };
}
const passo = (a, probe, extra = {}) => rodar({ dir: a.dir, run: a.run, fetchImpl: a.ntfy(probe), probeFetch: probe, ...extra });
const locais = a => a.chamadas.filter(c => c.startsWith("termux-notification"));

test("T81: classifica 204, 302 do portal, 200 com corpo, sem rede e sem Wi-Fi", () => {
  assert.equal(classificar({ tipo: "204" }, true), "ok");
  assert.equal(classificar({ tipo: "redirect", status: 302 }, true), "portal");
  assert.equal(classificar({ tipo: "outro", status: 200 }, true), "portal");
  assert.equal(classificar({ tipo: "erro" }, true), "sem_internet");
  assert.equal(classificar({ tipo: "erro" }, false), "sem_wifi");
  assert.equal(classificar({ tipo: "erro" }, null), "sem_internet");
});

test("T81: rede normal desde o início não avisa nada", async () => {
  const a = ambiente({ ssid: "Casa" });
  const r = await passo(a, resp(204));
  assert.equal(r.leitura.estado, "ok");
  assert.equal(r.aviso, null);
  assert.equal(a.envios.length, 0);
  assert.equal(locais(a).length, 0);
});

test("T81: 302 do portal (MEO-WiFi) confirmado em 2 leituras avisa UMA vez por ntfy e local; repetir não repete", async () => {
  const a = ambiente({ ssid: "MEO-WiFi" });
  await passo(a, resp(204));
  await passo(a, resp(302));
  assert.equal(a.envios.length, 0, "uma leitura ruim isolada não avisa");
  const r = await passo(a, resp(302));
  assert.equal(r.aviso.tipo, "portal");
  assert.equal(a.envios.length, 1);
  assert.equal(a.envios[0].topic, "topico-teste");
  assert.match(a.envios[0].message, /portal cativo/);
  assert.match(a.envios[0].message, /MEO-WiFi/);
  assert.equal(locais(a).length, 1);
  for (let i = 0; i < 5; i++) await passo(a, resp(302));
  assert.equal(a.envios.length, 1, "1 aviso por mudança, sem flood");
  assert.equal(locais(a).length, 1);
});

test("T81: avisa de novo quando a rede volta (204)", async () => {
  const a = ambiente({ ssid: "MEO-WiFi" });
  await passo(a, resp(204));
  await passo(a, resp(302)); await passo(a, resp(302));
  await passo(a, resp(204));
  assert.equal(a.envios.length, 1);
  await passo(a, resp(204));
  assert.equal(a.envios.length, 2);
  assert.match(a.envios[1].title, /normal de novo/);
  assert.equal(a.ler().estado, "ok");
});

test("T81: sem rede (gateway não responde) vira sem_wifi; gateway ok sem internet vira sem_internet", async () => {
  const a = ambiente({ pingOk: false });
  await passo(a, semRede); const r = await passo(a, semRede);
  assert.equal(r.leitura.estado, "sem_wifi");
  const b = ambiente({ pingOk: true });
  await passo(b, resp(204)); await passo(b, semRede);
  const s = await passo(b, semRede);
  assert.equal(s.leitura.estado, "sem_internet");
  assert.match(s.aviso.mensagem, /sem internet/i);
});

test("T81: troca de rede (nome diferente, ambas ok) avisa; nome ausente sem termux-api não é troca", async () => {
  const a = ambiente({ ssid: "Casa" });
  await passo(a, resp(204));
  const b = { ...a, run: ambiente({ ssid: "Cafe" }).run };
  await passo(b, resp(204)); const r = await passo(b, resp(204));
  assert.equal(r.aviso.tipo, "outra_rede");
  assert.match(r.aviso.mensagem, /Casa → Cafe/);
  const c = { ...a, run: ambiente({ ssid: null }).run };
  await passo(c, resp(204)); const q = await passo(c, resp(204));
  assert.equal(q.aviso, null, "sem termux-api o nome some e não vira alarme");
});

test("T81: sem internet o ntfy falha mas o aviso local sai, e o pendente não repete nem se perde", async () => {
  const a = ambiente({ ssid: "MEO-WiFi" });
  await passo(a, resp(204));
  const ntfyFora = async (url, opts) => { if (opts?.method === "POST") throw new Error("sem rota"); return { status: 302 }; };
  await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyFora, probeFetch: resp(302) });
  const r = await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyFora, probeFetch: resp(302) });
  assert.equal(r.aviso.tipo, "portal");
  assert.equal(r.enviado, false);
  assert.equal(locais(a).length, 1, "notificação local saiu mesmo sem internet");
  assert.equal(a.ler().pendente.tipo, "portal");
  const r2 = await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyFora, probeFetch: resp(302) });
  assert.equal(r2.aviso, null);
  assert.equal(locais(a).length, 1, "não repete a notificação local");

  // Rede volta ao normal (204) e ntfy volta a responder:
  const ntfyVoltou = async (url, opts) => {
    if (opts?.method === "POST") { a.envios.push(JSON.parse(opts.body)); return { status: 200, ok: true }; }
    return resp(204)(url, opts);
  };
  const r3 = await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyVoltou, probeFetch: resp(204) });
  assert.equal(r3.enviado, true, "deve reenviar aviso pendente quando a rede volta");
  assert.equal(a.envios.length, 1, "deve ter enviado 1 aviso ntfy acumulado");
  assert.match(a.envios[0].message, /aviso atrasado: ficou sem internet/, "mensagem deve indicar atraso");
  assert.equal(a.ler().pendente, null, "pendente deve ser limpo após reenvio bem-sucedido (mata M11)");

  // Na segunda leitura com 204 (CONFIRMAR = 2), dispara o aviso de que a rede voltou
  const r4 = await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyVoltou, probeFetch: resp(204) });
  assert.equal(r4.aviso.tipo, "voltou");
  assert.equal(a.ler().pendente, null);

  // Na terceira leitura com 204: rede estabilizada, nenhum novo aviso gerado nem reenvio do pendente
  const r5 = await rodar({ dir: a.dir, run: a.run, fetchImpl: ntfyVoltou, probeFetch: resp(204) });
  assert.equal(r5.aviso, null);
  assert.equal(a.envios.length, 2, "deve ter apenas o atrasado e o voltou, sem duplicar");
  assert.equal(a.ler().pendente, null);
});

test("T81: é só leitura: nenhum comando muda o Wi-Fi", async () => {
  const a = ambiente({ ssid: "Casa" });
  await passo(a, resp(302)); await passo(a, resp(302)); await passo(a, semRede);
  const usados = new Set(a.chamadas.map(c => c.split(" ")[0]));
  for (const u of usados) assert.ok(["ip", "getprop", "ping", "termux-wifi-connectioninfo", "termux-notification"].includes(u), `comando inesperado: ${u}`);
  assert.ok(!a.chamadas.some(c => /enable|disconnect|scan|svc wifi|settings put/.test(c)));
});

test("T81: gateway cai para getprop quando ip route não dá; ssid <unknown ssid> vira null", async () => {
  const run = async (cmd, args) => (cmd === "ip" ? null : cmd === "getprop" && args[0] === "dhcp.wlan0.gateway" ? "10.0.0.1\n" : null);
  assert.equal(await lerGateway(run), "10.0.0.1");
  assert.equal(await lerSsid(async () => JSON.stringify({ ssid: "<unknown ssid>" })), null);
});

test("T81: decidir não anuncia uma volta ao normal que nunca foi anunciada como problema", () => {
  const { aviso } = decidir(null, { estado: "ok", ssid: "Casa" });
  assert.equal(aviso, null);
});
