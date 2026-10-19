import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  achar, resolverPerfil, descreverAchado, lerKeyscan, impressaoDeChave, normalizarImpressao, ipLocalValido, lerIpDoAdb,
  subredesParaVarrer, lerCache, gravarCache, pastaCache,
} from "../achar-aparelho.mjs";

// Rodar com: node --test tools/lib/test/achar-aparelho.test.mjs  (rede falsa: nada é consultado de verdade)
const CHAVE_B64 = "AAAAC3NzaC1lZDI1NTE5AAAAIBGJQ9qZPF9eB4nbXnKf8apPdtGkpNM6AQtTrNWYv7NI"; // chave pública de exemplo (A15)
const DIGITAL = impressaoDeChave(CHAVE_B64);
const ESTRANHA = "x".repeat(43);

const perfil = (net = {}) => ({ id: "a15", serial: "SERIAL-FALSO", network: { ip: "192.168.1.164", ssh_port: 8022, ssh_hostkey_sha256: `SHA256:${DIGITAL}`, ...net } });

// Rede falsa: `hosts` = { ip: impressão digital | null (porta aberta, sem ed25519) }. Quem não está na lista não responde.
// Registra quem foi consultado, para provar a ordem e que a varredura não roda à toa.
function rede({ hosts = {}, adb = { erro: "adb sem aparelho (cabo desligado?)" }, interfaces = { Wi_Fi: [{ family: "IPv4", address: "192.168.1.50", internal: false }] } } = {}) {
  const portas = [], chaves = [];
  return {
    portas, chaves,
    portaAberta: async (ip) => { portas.push(ip); return ip in hosts; },
    impressao: async (ip) => { chaves.push(ip); return hosts[ip] ? { impressao: hosts[ip] } : { erro: "não ofereceu chave ed25519" }; },
    ipPeloAdb: async () => adb,
    interfaces: () => interfaces,
  };
}
const pasta = () => mkdtempSync(join(tmpdir(), "achar-"));

test("1º: o último IP que funcionou (cache) vence e nem olha o perfil", async () => {
  const dir = pasta();
  gravarCache(dir, "a15", "192.168.1.200");
  const r = rede({ hosts: { "192.168.1.200": DIGITAL, "192.168.1.164": DIGITAL } });
  const a = await achar(perfil(), { rede: r, cacheDir: dir });
  assert.equal(a.ok, true);
  assert.equal(a.ip, "192.168.1.200");
  assert.equal(a.via, "cache");
  assert.equal(a.verificado, true);
  assert.deepEqual(r.portas, ["192.168.1.200"]);
});

test("2º: sem cache, o IP do perfil (agora só uma dica); o achado vai para o cache", async () => {
  const dir = pasta();
  const a = await achar(perfil(), { rede: rede({ hosts: { "192.168.1.164": DIGITAL } }), cacheDir: dir });
  assert.equal(a.via, "perfil");
  assert.equal(a.ip, "192.168.1.164");
  assert.equal(lerCache(dir, "a15"), "192.168.1.164");
});

test("IP mudou (.164 → .170): cache velho e perfil não respondem, o adb dá o IP novo", async () => {
  const dir = pasta();
  gravarCache(dir, "a15", "192.168.1.99");
  const r = rede({ hosts: { "192.168.1.170": DIGITAL }, adb: { ip: "192.168.1.170" } });
  const a = await achar(perfil(), { rede: r, cacheDir: dir });
  assert.equal(a.ok, true);
  assert.equal(a.ip, "192.168.1.170");
  assert.equal(a.via, "adb");
  assert.equal(lerCache(dir, "a15"), "192.168.1.170", "o IP novo vira o cache");
  assert.deepEqual(a.tentativas.filter(t => t.resultado === "sem resposta").map(t => t.ip), ["192.168.1.99", "192.168.1.164"]);
});

test("adb sem cabo é pulado com motivo, e a varredura acha o aparelho", async () => {
  const hosts = { "192.168.1.170": DIGITAL };
  const r = rede({ hosts }); // adb padrão do rede(): sem cabo
  const a = await achar(perfil(), { rede: r, cacheDir: pasta() });
  assert.equal(a.ok, true);
  assert.equal(a.ip, "192.168.1.170");
  assert.equal(a.via, "varredura");
  assert.ok(a.tentativas.some(t => t.via === "adb" && /pulado: adb sem aparelho/.test(t.resultado)));
  assert.ok(!r.portas.includes("192.168.1.50"), "varreu o próprio computador");
});

test("aparelho estranho na mesma porta é RECUSADO e nunca devolvido", async () => {
  const dir = pasta();
  // o IP do perfil agora é de outro aparelho com SSH na 8022 (outro celular, roteador, Raspberry...)
  const r = rede({ hosts: { "192.168.1.164": ESTRANHA, "192.168.1.170": DIGITAL } });
  const a = await achar(perfil(), { rede: r, cacheDir: dir });
  assert.equal(a.ok, true);
  assert.equal(a.ip, "192.168.1.170", "tem de achar o verdadeiro, não o estranho");
  const recusa = a.tentativas.find(t => t.ip === "192.168.1.164");
  assert.match(recusa.resultado, /recusado: impressão digital diferente/);
  assert.equal(lerCache(dir, "a15"), "192.168.1.170", "o estranho nunca entra no cache");
});

test("só existe o estranho na rede: não acha, lista a recusa e não grava cache", async () => {
  const dir = pasta();
  const r = rede({ hosts: { "192.168.1.164": ESTRANHA, "192.168.1.77": ESTRANHA } });
  const a = await achar(perfil(), { rede: r, cacheDir: dir });
  assert.equal(a.ok, false);
  assert.equal(a.ip, undefined);
  assert.match(a.erro, /2 aparelho\(s\) recusado\(s\)/);
  assert.ok(a.tentativas.filter(t => t.resultado.startsWith("recusado")).length === 2);
  assert.equal(lerCache(dir, "a15"), null);
});

test("cache aponta para um estranho: recusa, segue a ordem e acha o certo", async () => {
  const dir = pasta();
  gravarCache(dir, "a15", "192.168.1.55"); // IP reaproveitado pelo roteador para outro aparelho
  const r = rede({ hosts: { "192.168.1.55": ESTRANHA, "192.168.1.164": DIGITAL } });
  const a = await achar(perfil(), { rede: r, cacheDir: dir });
  assert.equal(a.ip, "192.168.1.164");
  assert.equal(a.via, "perfil");
  assert.match(a.tentativas[0].resultado, /recusado/);
});

test("porta aberta sem chave ed25519 também é recusada (não dá para provar quem é)", async () => {
  const r = rede({ hosts: { "192.168.1.164": null } });
  const a = await achar(perfil(), { rede: r, cacheDir: pasta(), varrer: false });
  assert.equal(a.ok, false);
  assert.match(a.tentativas.find(t => t.ip === "192.168.1.164").resultado, /recusado: não consegui ler a chave de host/);
});

test("perfil sem impressão digital: aceita cache/perfil/adb como antes (verificado:false) e NÃO varre", async () => {
  const p = perfil({ ssh_hostkey_sha256: undefined });
  const r = rede({ hosts: { "192.168.1.164": ESTRANHA } });
  const a = await achar(p, { rede: r, cacheDir: pasta() });
  assert.equal(a.ok, true);
  assert.equal(a.verificado, false);
  assert.match(descreverAchado(a), /identidade não provada/);

  const nada = await achar(p, { rede: rede({ hosts: { "192.168.1.170": DIGITAL } }), cacheDir: pasta() });
  assert.equal(nada.ok, false, "sem impressão digital, qualquer SSH da rede passaria por ser o aparelho");
  assert.ok(nada.tentativas.some(t => t.via === "varredura" && /pulada: o perfil não tem network\.ssh_hostkey_sha256/.test(t.resultado)));
});

test("--sem-varredura (varrer:false) não toca na rede além dos candidatos", async () => {
  const r = rede({ hosts: { "192.168.1.170": DIGITAL } });
  const a = await achar(perfil(), { rede: r, cacheDir: pasta(), varrer: false });
  assert.equal(a.ok, false);
  assert.deepEqual(r.portas, ["192.168.1.164"]);
});

test("a varredura só olha o /24 do computador e para quando acha", async () => {
  const r = rede({ hosts: { "192.168.1.20": DIGITAL, "10.0.0.5": ESTRANHA } });
  const a = await achar(perfil(), { rede: r, cacheDir: pasta(), concorrencia: 1 });
  assert.equal(a.ip, "192.168.1.20");
  assert.ok(r.portas.every(ip => ip.startsWith("192.168.1.")), "saiu da rede do computador");
  assert.ok(r.portas.length < 40, `varreu demais depois de achar: ${r.portas.length}`);
});

test("sem rede local privada no computador: varredura pulada com motivo", async () => {
  const r = rede({ interfaces: { lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }] } });
  const a = await achar(perfil(), { rede: r, cacheDir: pasta() });
  assert.equal(a.ok, false);
  assert.ok(a.tentativas.some(t => /nenhuma rede local privada ativa/.test(t.resultado)));
});

test("IP público ou lixo (do cache, do perfil ou do adb) é ignorado antes de abrir conexão", async () => {
  const dir = pasta();
  gravarCache(dir, "a15", "8.8.8.8");
  const r = rede({ hosts: {}, adb: { ip: "1.2.3.4" } });
  const a = await achar(perfil({ ip: "999.1.1.1" }), { rede: r, cacheDir: dir, varrer: false });
  assert.equal(a.ok, false);
  assert.ok(!r.portas.includes("8.8.8.8") && !r.portas.includes("999.1.1.1") && !r.portas.includes("1.2.3.4"));
});

test("resolverPerfil devolve uma cópia com o IP achado e não mexe no perfil original", async () => {
  const original = perfil();
  const { perfil: novo, achado } = await resolverPerfil(original, { rede: rede({ hosts: { "192.168.1.170": DIGITAL }, adb: { ip: "192.168.1.170" } }), cacheDir: pasta() });
  assert.equal(novo.network.ip, "192.168.1.170");
  assert.equal(original.network.ip, "192.168.1.164");
  assert.equal(novo.network.ssh_user, original.network.ssh_user);
  assert.equal(achado.via, "adb");
  const falhou = await resolverPerfil(original, { rede: rede(), cacheDir: pasta(), varrer: false });
  assert.equal(falhou.perfil, original, "sem achar, o perfil segue como está");
  assert.equal(falhou.achado.ok, false);
});

test("lerKeyscan: tira a impressão digital da linha do ssh-keyscan e ignora comentários e outros tipos", () => {
  const saida = `# 192.168.1.170:8022 SSH-2.0-OpenSSH_10.6\n[192.168.1.170]:8022 ssh-ed25519 ${CHAVE_B64}\n`;
  assert.equal(lerKeyscan(saida), DIGITAL);
  assert.equal(lerKeyscan("# só comentário\n"), null);
  assert.equal(lerKeyscan("[1.2.3.4]:8022 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ"), null);
  assert.equal(lerKeyscan(""), null);
  assert.equal(DIGITAL.length, 43);
});

test("normalizarImpressao aceita SHA256:, '=' final e espaços", () => {
  assert.equal(normalizarImpressao(`SHA256:${DIGITAL}=`), DIGITAL);
  assert.equal(normalizarImpressao(`  ${DIGITAL} `), DIGITAL);
  assert.equal(normalizarImpressao(undefined), "");
});

test("lerIpDoAdb: formato do cmd wifi status e do ip addr; público e lixo viram null", () => {
  assert.equal(lerIpDoAdb('Wifi is connected to "Casa"\n  WifiInfo: SSID: "Casa", BSSID: aa:bb, MAC: cc:dd, IP: /192.168.1.170, Security type: 2'), "192.168.1.170");
  assert.equal(lerIpDoAdb("    inet 192.168.0.23/24 brd 192.168.0.255 scope global wlan0"), "192.168.0.23");
  assert.equal(lerIpDoAdb("IP: /8.8.8.8"), null);
  assert.equal(lerIpDoAdb("Wifi is disabled"), null);
});

test("ipLocalValido: só 10/8, 172.16/12, 192.168/16 e 100.64/10", () => {
  for (const ok of ["10.1.2.3", "172.16.0.1", "172.31.9.9", "192.168.1.170", "100.101.102.103"]) assert.ok(ipLocalValido(ok), ok);
  for (const ruim of ["8.8.8.8", "127.0.0.1", "172.32.0.1", "192.169.1.1", "100.63.0.1", "256.1.1.1", "1.2.3", "", null, "192.168.1.1; rm -rf"]) assert.ok(!ipLocalValido(ruim), String(ruim));
});

test("subredesParaVarrer: só /24 privados, sem loopback, interno ou Tailscale", () => {
  const s = subredesParaVarrer({
    Wi_Fi: [{ family: "IPv4", address: "192.168.1.50", internal: false }, { family: "IPv6", address: "fe80::1", internal: false }],
    lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    Tailscale: [{ family: "IPv4", address: "100.101.1.2", internal: false }],
    Publica: [{ family: "IPv4", address: "177.1.2.3", internal: false }],
  });
  assert.deepEqual(s, [{ prefixo: "192.168.1", proprios: ["192.168.1.50"] }]);
});

test("cache: fica FORA do repositório, guarda por perfil e sobrevive a arquivo quebrado", () => {
  const dir = pasta();
  assert.equal(lerCache(dir, "a15"), null);
  assert.equal(gravarCache(dir, "a15", "192.168.1.170"), true);
  assert.equal(gravarCache(dir, "a13", "192.168.1.127"), true);
  assert.equal(lerCache(dir, "a15"), "192.168.1.170");
  assert.equal(lerCache(dir, "a13"), "192.168.1.127");
  const p = pastaCache({ LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local", XDG_CACHE_HOME: "/home/x/.cache" });
  assert.match(p.replace(/\\/g, "/"), /celular-kit$/);
  assert.ok(!p.includes("celular\\"), "cache dentro do projeto");
  assert.equal(pastaCache({ CELULAR_CACHE_DIR: dir }), dir);
  // arquivo quebrado: lê como vazio e regrava sem lançar
  assert.equal(gravarCache(join(dir, "novo"), "a15", "10.0.0.5"), true);
  assert.ok(existsSync(join(dir, "novo", "achar-aparelho.json")));
  assert.equal(JSON.parse(readFileSync(join(dir, "novo", "achar-aparelho.json"), "utf8")).a15.ip, "10.0.0.5");
});
