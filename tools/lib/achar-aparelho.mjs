// Achador do aparelho (T80): o celular é de uso diário, troca de rede e o IP muda. Em vez de depender de um IP fixo no perfil,
// procura o aparelho nesta ordem e para no primeiro que PROVA ser ele:
//   1. o último IP que funcionou (cache FORA do repositório, em %LOCALAPPDATA%\celular-kit);
//   2. o IP do perfil (network.ip, agora só uma dica);
//   3. o IP pelo adb (`cmd wifi status`), se o cabo estiver ligado;
//   4. a varredura do /24 de cada interface local, na porta SSH (8022), conferindo a chave de host.
// "Provar": a impressão digital SHA256 da chave de host ed25519 (PÚBLICA) tem de ser igual a network.ssh_hostkey_sha256 do perfil.
// Um aparelho estranho na mesma porta é RECUSADO e nunca devolvido. Sem impressão digital no perfil não há como provar:
// os passos 1-3 seguem como antes (verificado: false) e a varredura (4) é pulada.
// Só leitura: abre conexão TCP e faz o handshake do ssh-keyscan; não autentica nem escreve no aparelho. Nenhum IP vai para o git.
//
//   node tools/lib/achar-aparelho.mjs --perfil a15              -> imprime só o IP (para scripts); motivos em stderr
//   node tools/lib/achar-aparelho.mjs --perfil a15 --json       -> resultado completo
//   node tools/lib/achar-aparelho.mjs --perfil a15 --sem-varredura
// Código de saída: 0 achou · 1 não achou · 2 uso errado.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

export const PORTA_PADRAO = 8022;
const MAX_SUBREDES = 4;

// ----- funções puras -----

/** "SHA256:abc=" / "abc=" / "abc" -> "abc" (formato do ssh-keygen -l, sem o '=' final). */
export function normalizarImpressao(valor) {
  return String(valor ?? "").trim().replace(/^SHA256:/i, "").replace(/=+$/, "");
}

/** Impressão digital SHA256 de uma chave pública em base64 (a parte AAAA... da linha do ssh-keyscan). */
export function impressaoDeChave(base64) {
  return createHash("sha256").update(Buffer.from(base64, "base64")).digest("base64").replace(/=+$/, "");
}

/** Lê a saída do `ssh-keyscan -t ed25519` e devolve a impressão digital, ou null. Ignora linhas de comentário (#). */
export function lerKeyscan(texto) {
  for (const linha of String(texto ?? "").split(/\r?\n/)) {
    if (!linha || linha.startsWith("#")) continue;
    const m = linha.match(/\bssh-ed25519\s+([A-Za-z0-9+/]+={0,2})\s*$/);
    if (m) return impressaoDeChave(m[1]);
  }
  return null;
}

/** IPv4 de rede local: 10/8, 172.16/12, 192.168/16, ou 100.64/10 (Tailscale). Nada público, nada de loopback. */
export function ipLocalValido(ip) {
  const m = String(ip ?? "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  const [a, b] = o;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Lê o IP do Wi-Fi na saída de `adb shell cmd wifi status` (WifiInfo ... IP: /192.168.1.170) ou de `ip addr` (inet ...). */
export function lerIpDoAdb(texto) {
  const t = String(texto ?? "");
  const m = t.match(/\bIP:\s*\/?(\d{1,3}(?:\.\d{1,3}){3})/) || t.match(/\binet\s+(\d{1,3}(?:\.\d{1,3}){3})\//);
  return m && ipLocalValido(m[1]) ? m[1] : null;
}

/** Prefixos /24 a varrer, a partir de os.networkInterfaces(). Só redes privadas comuns (não varre Tailscale nem internet). */
export function subredesParaVarrer(interfaces = os.networkInterfaces()) {
  const prefixos = new Map(); // "192.168.1" -> IPs próprios nessa sub-rede
  for (const lista of Object.values(interfaces ?? {})) {
    for (const i of lista ?? []) {
      if (i.family !== "IPv4" || i.internal || !ipLocalValido(i.address) || i.address.startsWith("100.")) continue;
      const prefixo = i.address.split(".").slice(0, 3).join(".");
      prefixos.set(prefixo, [...(prefixos.get(prefixo) ?? []), i.address]);
    }
  }
  return [...prefixos].slice(0, MAX_SUBREDES).map(([prefixo, proprios]) => ({ prefixo, proprios }));
}

// ----- cache fora do repositório -----
export function pastaCache(env = process.env) {
  if (env.CELULAR_CACHE_DIR) return env.CELULAR_CACHE_DIR;
  const base = process.platform === "win32"
    ? (env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local"))
    : (env.XDG_CACHE_HOME || join(os.homedir(), ".cache"));
  return join(base, "celular-kit");
}
const arquivoCache = pasta => join(pasta, "achar-aparelho.json");

export function lerCache(pasta, id) {
  try {
    const ip = JSON.parse(readFileSync(arquivoCache(pasta), "utf8"))?.[id]?.ip;
    return ipLocalValido(ip) ? ip : null;
  } catch { return null; }
}

export function gravarCache(pasta, id, ip, agora = Date.now()) {
  try {
    mkdirSync(pasta, { recursive: true });
    const arq = arquivoCache(pasta);
    let atual = {};
    try { atual = JSON.parse(readFileSync(arq, "utf8")) || {}; } catch {}
    atual[id] = { ip, visto_em: new Date(agora).toISOString() };
    const tmp = `${arq}.tmp`;
    writeFileSync(tmp, JSON.stringify(atual, null, 2), { mode: 0o600 });
    renameSync(tmp, arq);
    return true;
  } catch { return false; } // cache é conveniência: falhar não atrapalha
}

// ----- rede e adb de verdade (trocados por falsos nos testes) -----
export function portaAberta(ip, porta, timeoutMs = 1500) {
  return new Promise(resolver => {
    const s = createConnection({ host: ip, port: porta });
    const fim = ok => { s.destroy(); resolver(ok); };
    s.setTimeout(timeoutMs, () => fim(false));
    s.once("connect", () => fim(true));
    s.once("error", () => fim(false));
  });
}

export function executar(cmd, args, timeoutMs) {
  return new Promise(resolver => {
    let p;
    try { p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); } catch { return resolver({ ok: false, erro: "não executou" }); }
    let out = "";
    const t = setTimeout(() => { p.kill(); resolver({ ok: false, erro: "tempo esgotado" }); }, timeoutMs);
    p.stdout.on("data", c => { if (out.length < 65536) out += c; });
    p.on("error", e => { clearTimeout(t); resolver({ ok: false, erro: e.code === "ENOENT" ? `${cmd} não encontrado` : "erro ao executar" }); });
    p.on("close", code => { clearTimeout(t); resolver(code === 0 ? { ok: true, saida: out } : { ok: false, erro: `saída ${code}`, saida: out }); });
  });
}

/** Impressão digital da chave de host ed25519 do que responde em ip:porta (handshake do ssh-keyscan, sem autenticar). */
export async function impressaoPadrao(ip, porta) {
  const r = await executar("ssh-keyscan", ["-T", "4", "-t", "ed25519", "-p", String(porta), ip], 8000);
  if (!r.ok && !r.saida) return { erro: r.erro };
  const imp = lerKeyscan(r.saida);
  return imp ? { impressao: imp } : { erro: "não ofereceu chave ed25519" };
}

export async function ipPeloAdbPadrao(serial) {
  const argsAdb = [...(serial ? ["-s", serial] : []), "shell", "cmd", "wifi", "status"];
  const r = await executar("adb", argsAdb, 6000);
  if (!r.ok) return { erro: /device|offline|no devices|não encontrado/i.test(`${r.erro} ${r.saida ?? ""}`) ? "adb sem aparelho (cabo desligado?)" : `adb: ${r.erro}` };
  const ip = lerIpDoAdb(r.saida);
  return ip ? { ip } : { erro: "adb não mostrou IP do Wi-Fi" };
}

export const REDE_PADRAO = { portaAberta, impressao: impressaoPadrao, ipPeloAdb: ipPeloAdbPadrao, interfaces: () => os.networkInterfaces() };

// ----- o achador -----
/**
 * @returns {{ok:boolean, ip?:string, porta:number, via?:string, verificado?:boolean, tentativas:Array, erro?:string}}
 * tentativas: [{via, ip, resultado: 'achado'|'sem resposta'|'recusado: ...'|..., ...}] (inclui os estranhos recusados)
 */
export async function achar(perfil, { rede = REDE_PADRAO, cacheDir = pastaCache(), varrer = true, concorrencia = 48, agora = Date.now } = {}) {
  const net = perfil?.network ?? {};
  const id = perfil?.id ?? "aparelho";
  const porta = Number.isInteger(net.ssh_port) ? net.ssh_port : PORTA_PADRAO;
  const esperada = normalizarImpressao(net.ssh_hostkey_sha256);
  const tentativas = [];
  const jaTestados = new Set();

  // Confere um IP. Devolve true quando é o aparelho (ou, sem impressão no perfil, quando a porta responde).
  async function conferir(via, ip) {
    if (!ipLocalValido(ip)) { tentativas.push({ via, ip: ip ?? null, resultado: "ignorado: não é IP de rede local" }); return null; }
    if (!(await rede.portaAberta(ip, porta, via === "varredura" ? 400 : 1500))) {
      if (via !== "varredura") tentativas.push({ via, ip, resultado: "sem resposta" }); // na varredura só entra o que respondeu na porta
      return null;
    }
    if (!esperada) { tentativas.push({ via, ip, resultado: "achado (sem impressão digital no perfil: identidade não provada)" }); return { ip, via, verificado: false }; }
    const r = await rede.impressao(ip, porta);
    if (r.erro) { tentativas.push({ via, ip, resultado: `recusado: não consegui ler a chave de host (${r.erro})` }); return null; }
    if (normalizarImpressao(r.impressao) !== esperada) { tentativas.push({ via, ip, resultado: "recusado: impressão digital diferente (aparelho estranho na mesma porta)" }); return null; }
    tentativas.push({ via, ip, resultado: "achado" });
    return { ip, via, verificado: true };
  }
  const tentar = async (via, ip) => {
    if (!ip || jaTestados.has(ip)) return null;
    jaTestados.add(ip);
    return conferir(via, ip);
  };
  const achou = r => {
    gravarCache(cacheDir, id, r.ip, agora());
    return { ok: true, ip: r.ip, porta, via: r.via, verificado: r.verificado, tentativas };
  };

  // 1. último IP que funcionou
  let r = await tentar("cache", lerCache(cacheDir, id));
  if (r) return achou(r);
  // 2. IP do perfil
  r = await tentar("perfil", net.ip);
  if (r) return achou(r);
  // 3. IP pelo adb
  const adb = await rede.ipPeloAdb(perfil?.serial ?? null);
  if (adb.erro) tentativas.push({ via: "adb", ip: null, resultado: `pulado: ${adb.erro}` });
  else { r = await tentar("adb", adb.ip); if (r) return achou(r); }
  // 4. varredura (só com impressão digital: sem ela qualquer SSH da rede passaria por ser o aparelho)
  if (!varrer) tentativas.push({ via: "varredura", ip: null, resultado: "desligada (--sem-varredura)" });
  else if (!esperada) tentativas.push({ via: "varredura", ip: null, resultado: "pulada: o perfil não tem network.ssh_hostkey_sha256, então não há como provar qual SSH é o aparelho" });
  else {
    const alvos = [];
    for (const { prefixo, proprios } of subredesParaVarrer(rede.interfaces())) {
      for (let n = 1; n <= 254; n++) { const ip = `${prefixo}.${n}`; if (!proprios.includes(ip) && !jaTestados.has(ip)) alvos.push(ip); }
    }
    if (!alvos.length) tentativas.push({ via: "varredura", ip: null, resultado: "pulada: nenhuma rede local privada ativa neste computador" });
    let achado = null, i = 0;
    const trabalhador = async () => {
      while (!achado && i < alvos.length) {
        const ip = alvos[i++];
        jaTestados.add(ip);
        const res = await conferir("varredura", ip);
        if (res && !achado) achado = res;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concorrencia, alvos.length) }, trabalhador));
    if (achado) return achou(achado);
  }

  const recusados = tentativas.filter(t => t.resultado.startsWith("recusado")).length;
  return { ok: false, porta, tentativas, erro: `aparelho "${id}" não encontrado${recusados ? ` (${recusados} aparelho(s) recusado(s) por impressão digital diferente)` : ""}` };
}

/** Devolve uma CÓPIA do perfil com network.ip trocado pelo IP achado. Se não achar, devolve o perfil como está (o chamador mostra o erro). */
export async function resolverPerfil(perfil, opcoes = {}) {
  const achado = await achar(perfil, opcoes);
  if (!achado.ok) return { perfil, achado };
  return { perfil: { ...perfil, network: { ...perfil.network, ip: achado.ip } }, achado };
}

/** Uma linha para o log do chamador: "IP 192.168.1.170 (via varredura, identidade provada)". */
export function descreverAchado(achado) {
  if (!achado.ok) return achado.erro;
  return `IP ${achado.ip} (via ${achado.via}, ${achado.verificado ? "identidade provada" : "identidade não provada: perfil sem impressão digital"})`;
}

// ----- CLI -----
const ehCli = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ehCli) {
  const args = process.argv.slice(2);
  const idPerfil = args.includes("--perfil") ? args[args.indexOf("--perfil") + 1] : null;
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  (async () => {
    if (!idPerfil || !/^[a-z0-9_]+$/.test(idPerfil)) { console.error("uso: node tools/lib/achar-aparelho.mjs --perfil <id> [--json] [--sem-varredura]"); return 2; }
    const pf = join(raiz, "profiles", `${idPerfil}.json`);
    if (!existsSync(pf)) { console.error(`[achar] perfil não encontrado: ${idPerfil}`); return 2; }
    const perfil = JSON.parse(readFileSync(pf, "utf8"));
    perfil.id = perfil.id || idPerfil;
    const achado = await achar(perfil, { varrer: !args.includes("--sem-varredura") });
    if (args.includes("--json")) console.log(JSON.stringify(achado, null, 2));
    else if (achado.ok) { console.error(`[achar] ${descreverAchado(achado)}`); console.log(achado.ip); }
    else { for (const t of achado.tentativas) console.error(`[achar] ${t.via}${t.ip ? ` ${t.ip}` : ""}: ${t.resultado}`); console.error(`[achar] ${achado.erro}`); }
    return achado.ok ? 0 : 1;
  })().then(c => { process.exitCode = c; }).catch(e => { console.error(`[achar] falhou: ${e.message}`); process.exitCode = 2; });
}
