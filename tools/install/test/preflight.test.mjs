import test from "node:test";
import assert from "node:assert/strict";
import { montarCapacidades, montarRelatorio } from "../../../server/discovery/detect.mjs";
import { avaliar, preflight, formatarTexto, coletarAparelho, SCRIPT_EXTRA, relatorioSemLeitura } from "../preflight.mjs";

// Rodar com: node --test tools/install/test/preflight.test.mjs  (relatórios falsos: nada é consultado de verdade)

// Saída do aparelho no formato do SCRIPT_LEITURA + SCRIPT_EXTRA. Os padrões descrevem o A15 real.
function saida(o = {}) {
  const d = {
    uname_m: "aarch64", uname_s: "Linux", uname_r: "5.10.209-android14", abi: "arm64-v8a",
    prefix: "/data/data/com.termux/files/usr", uid: "10304", node: "v26.4.0", cores: "8",
    home_df: "/dev/block/dm-47 110000000 40000000 70785024 37% /data", servicos: "agentops alertas egress server-box sftp sshd crond ",
    bateria: "", ips: "wlan0=192.168.1.164/24 ",
    android_release: "15", android_sdk: "35", termux_fonte: "F_DROID", termux_versao: "0.118.3", boot_script: "sim", boot_app: "sim",
    ...o,
  };
  const mem = o.mem ?? "MemTotal: 3805000 kB\nMemAvailable: 1500000 kB\nSwapTotal: 2097148 kB\nSwapFree: 2000000 kB";
  const linhas = Object.entries(d).map(([k, v]) => `@${k}=${v ?? ""}`);
  return `${linhas.join("\n")}\n@inicio_meminfo\n${mem}\n@fim_meminfo\n`;
}
import { lerSaida } from "../../../server/discovery/detect.mjs";
const montar = (o = {}, alvo = "falso") => {
  const s = saida(o);
  return { relatorio: montarRelatorio({ alvo, caps: montarCapacidades({ saida: s, plataforma: "android" }) }), extras: lerSaida(s).dados };
};
const estado = (rel, id) => rel.itens.find(i => i.id === id)?.estado;
const porId = (rel, id) => rel.itens.find(i => i.id === id);

test("A15 real: tudo GO, código 0", () => {
  const rel = avaliar({ ...montar({}, "a15") });
  assert.equal(rel.codigo, 0, formatarTexto(rel));
  assert.equal(rel.veredito, "GO");
  for (const i of rel.itens) assert.equal(i.estado, "go", i.id);
  assert.equal(porId(rel, "android").valor, "Android 15 (API 35)");
  assert.equal(porId(rel, "arquitetura").valor, "arm64-v8a");
  assert.equal(porId(rel, "node").valor, "v26.4.0");
});

test("todo item traz nome, motivo e fonte; o que não é GO traz como corrigir", () => {
  const rel = avaliar(montar({ android_sdk: "23", boot_app: "nao", node: "" }));
  for (const i of rel.itens) {
    assert.ok(i.nome && i.motivo, i.id);
    assert.ok(i.fonte, `${i.id} sem fonte`);
    if (i.estado !== "go") assert.ok(i.corrigir, `${i.id} sem como corrigir`);
  }
});

test("aparelho velho (Android 6, 32 bits, 1 GB de RAM, 300 MB livres): NO-GO, código 2", () => {
  const rel = avaliar(montar({
    android_release: "6.0", android_sdk: "23", uname_m: "armv7l", abi: "armeabi-v7a", node: "v16.20.0",
    mem: "MemTotal: 900000 kB\nMemAvailable: 300000 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB",
    home_df: "/dev/x 1000000 700000 300000 70% /data", boot_app: "desconhecido",
  }));
  assert.equal(rel.codigo, 2);
  assert.equal(rel.veredito, "NO-GO");
  assert.equal(estado(rel, "android"), "nogo");
  assert.equal(estado(rel, "arquitetura"), "aviso"); // 32 bits roda, mas não é o caminho testado
  assert.equal(estado(rel, "espaco"), "nogo");
  assert.equal(estado(rel, "ram"), "nogo");
  assert.equal(estado(rel, "node"), "nogo");
  assert.match(formatarTexto(rel), /\[NO-GO\] Android: Android 6\.0 \(API 23\)/);
});

test("Android 8 (API 26) é só aviso, não bloqueia", () => {
  const rel = avaliar(montar({ android_release: "8.0", android_sdk: "26" }));
  assert.equal(estado(rel, "android"), "aviso");
  assert.equal(rel.codigo, 1);
});

test("aparelho sem Termux:Boot (provado pelo pm): NO-GO só nesse item, com como corrigir", () => {
  const rel = avaliar(montar({ boot_app: "nao", boot_script: "nao" }));
  assert.equal(estado(rel, "boot"), "nogo");
  assert.match(porId(rel, "boot").motivo, /não volta sozinho/);
  assert.match(porId(rel, "boot").corrigir, /Termux:Boot/);
  assert.equal(rel.codigo, 2);
  for (const i of rel.itens.filter(i => i.id !== "boot")) assert.equal(i.estado, "go", i.id);
});

test("Termux:Boot que o pm não confirma é aviso (nunca GO por suposição)", () => {
  const rel = avaliar(montar({ boot_app: "desconhecido" }));
  assert.equal(estado(rel, "boot"), "aviso");
  assert.equal(rel.codigo, 1);
});

test("Termux:Boot instalado mas sem boot.sh: GO (o instalador cria o script)", () => {
  const rel = avaliar(montar({ boot_app: "sim", boot_script: "nao" }));
  assert.equal(estado(rel, "boot"), "go");
  assert.match(porId(rel, "boot").motivo, /instalador cria/);
});

test("Termux da Google Play é NO-GO; F-Droid e GitHub são GO; sem a variável é aviso", () => {
  assert.equal(estado(avaliar(montar({ termux_fonte: "GOOGLE_PLAY" })), "termux"), "nogo");
  assert.equal(estado(avaliar(montar({ termux_fonte: "F_DROID" })), "termux"), "go");
  assert.equal(estado(avaliar(montar({ termux_fonte: "GITHUB" })), "termux"), "go");
  const sem = avaliar(montar({ termux_fonte: "", termux_versao: "" }));
  assert.equal(estado(sem, "termux"), "aviso");
  assert.equal(sem.codigo, 1);
});

test("fora do Termux (PREFIX comum): NO-GO no item Termux", () => {
  const rel = avaliar(montar({ prefix: "/usr" }));
  assert.equal(estado(rel, "termux"), "nogo");
});

test("espaço: 512 MB a 2 GB é aviso; abaixo de 512 MB é NO-GO", () => {
  assert.equal(estado(avaliar(montar({ home_df: "/d 9 9 1048576 9% /data" })), "espaco"), "aviso"); // 1024 MB
  assert.equal(estado(avaliar(montar({ home_df: "/d 9 9 262144 9% /data" })), "espaco"), "nogo");   // 256 MB
  assert.equal(porId(avaliar(montar()), "espaco").valor, "67,5 GB (69126 MB)");
});

test("Node ausente é aviso (o instalador instala); Node 18 é aviso; Node 16 é NO-GO", () => {
  assert.equal(estado(avaliar(montar({ node: "" })), "node"), "aviso");
  assert.match(porId(avaliar(montar({ node: "" })), "node").corrigir, /pkg install nodejs/);
  assert.equal(estado(avaliar(montar({ node: "v18.19.0" })), "node"), "aviso");
  assert.equal(estado(avaliar(montar({ node: "v16.20.0" })), "node"), "nogo");
});

test("arquitetura: arm64 GO, 32 bits e x86 aviso, desconhecida NO-GO", () => {
  assert.equal(estado(avaliar(montar({ abi: "x86_64", uname_m: "x86_64" })), "arquitetura"), "aviso");
  assert.equal(estado(avaliar(montar({ abi: "mips", uname_m: "mips" })), "arquitetura"), "nogo");
});

test("dado ausente nunca vira GO: relatório vazio dá avisos/NO-GO, jamais código 0", () => {
  const vazio = montarRelatorio({ alvo: "x", caps: montarCapacidades({ saida: "", plataforma: "android", erroShell: "sem sh" }) });
  const rel = avaliar({ relatorio: vazio, extras: {} });
  assert.notEqual(rel.codigo, 0);
  for (const i of rel.itens) assert.notEqual(i.estado, "go", i.id);
});

test("sem getprop e sem Termux (um PC): item Android é NO-GO", () => {
  const rel = avaliar(montar({ android_sdk: "", android_release: "", prefix: "" }));
  assert.equal(estado(rel, "android"), "nogo");
});

test("preflight: aparelho que não responde vira NO-GO com motivo, sem lançar", async () => {
  const rel = await preflight({ perfil: { id: "a15" }, coletaAparelho: async () => { throw new Error("tempo esgotado"); } });
  assert.equal(rel.codigo, 2);
  assert.equal(rel.itens[0].id, "leitura");
  assert.match(rel.itens[0].motivo, /tempo esgotado/);
  assert.deepEqual(relatorioSemLeitura("a15", "x").itens.length, 1);
});

test("preflight com leitura falsa do A15: código 0 e alvo = id do perfil", async () => {
  const rel = await preflight({ perfil: { id: "a15" }, coletaAparelho: async () => montar({}, "a15") });
  assert.equal(rel.codigo, 0);
  assert.equal(rel.alvo, "a15");
});

test("coletarAparelho: uma ida só ao aparelho, com o script do detect e o extra; só leitura", async () => {
  const chamadas = [];
  const executor = async (cmd, args, entrada) => { chamadas.push({ cmd, args, entrada }); return { ok: true, saida: saida() }; };
  const perfil = { id: "a15", network: { ip: "192.0.2.15", ssh_port: 8022, ssh_user: "u0_a999", ssh_key: "~/.ssh/id_ed25519" } };
  const { relatorio, extras } = await coletarAparelho(perfil, { executor });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].cmd, "ssh");
  assert.ok(chamadas[0].args.includes("BatchMode=yes"));
  assert.ok(chamadas[0].entrada.includes("uname -m") && chamadas[0].entrada.includes("getprop ro.build.version.sdk"));
  assert.equal(extras.android_sdk, "35");
  assert.equal(relatorio.alvo, "a15");
  // o script extra não escreve, apaga nem instala nada
  assert.doesNotMatch(SCRIPT_EXTRA, /\brm\b|>>?\s*(?!\/dev\/null)[^&\s]|\bmv\b|\bcp\b|pkg install|\bsv (up|down|start|stop|restart)/);
});

test("coletarAparelho: SSH sem resposta lança (o preflight não inventa leitura)", async () => {
  await assert.rejects(() => coletarAparelho({ id: "a15", network: { ip: "192.0.2.15", ssh_user: "u" } }, { executor: async () => ({ ok: false, erro: "saída 255" }) }), /saída 255/);
});

test("saída em texto: itens, como corrigir só quando não é GO, e resultado final", () => {
  const rel = avaliar(montar({ boot_app: "nao" }));
  const t = formatarTexto(rel);
  assert.match(t, /\[GO\] Android: Android 15 \(API 35\)/);
  assert.match(t, /\[NO-GO\] Termux:Boot/);
  assert.match(t, /como corrigir: instale o Termux:Boot/);
  assert.match(t, /Resultado: NO-GO \(código 2\)/);
  assert.doesNotMatch(formatarTexto(avaliar(montar())), /como corrigir/);
});
