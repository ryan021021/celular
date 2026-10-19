#!/usr/bin/env node
// T81: guarda de rede. Roda a cada 5 min pelo cron. SÓ LEITURA: nunca muda o Wi-Fi.
// Testa o generate_204 (sem seguir redirecionamento) e o gateway. Se a rede mudou de estado
// (ok / portal cativo / sem internet / sem Wi-Fi) ou de nome, avisa uma vez pelo ntfy do serviço alertas
// (mesmo ~/servidor/alertas.json) e por notificação local do Termux:API. Avisa de novo quando volta ao normal.
// Uma leitura ruim isolada não avisa: a mudança só vale depois de CONFIRMAR leituras seguidas iguais (anti-flood).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HOME_DIR = join(process.env.HOME || homedir(), "servidor");
export const PROBE_URL = "http://connectivitycheck.gstatic.com/generate_204";
export const CONFIRMAR = 2; // leituras seguidas iguais para valer como mudança (2 x 5 min)

const MOTIVOS = {
  ok: "Internet normal",
  portal: "caiu em portal cativo (login do Wi-Fi pendente, ex.: MEO-WiFi)",
  sem_internet: "Wi-Fi conectado, mas sem internet",
  sem_wifi: "sem Wi-Fi (gateway não responde)",
};

/** Classifica a leitura: probe = {tipo:"204"|"redirect"|"outro"|"erro", status?}, gatewayOk = true|false|null (null = gateway desconhecido). */
export function classificar(probe, gatewayOk) {
  if (probe.tipo === "204") return "ok";
  if (probe.tipo === "redirect" || probe.tipo === "outro") return "portal"; // 3xx ou 200 com corpo = portal respondendo no lugar da internet
  if (gatewayOk === false) return "sem_wifi";
  return "sem_internet";
}

export async function lerProbe(fetchImpl = fetch, url = PROBE_URL) {
  try {
    const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(6_000) });
    if (res.status === 204) return { tipo: "204", status: 204 };
    if (res.status >= 300 && res.status < 400) return { tipo: "redirect", status: res.status };
    return { tipo: "outro", status: res.status };
  } catch {
    return { tipo: "erro" };
  }
}

const exec = (cmd, args, ms = 6_000) => new Promise(resolve =>
  execFile(cmd, args, { timeout: ms }, (err, stdout) => resolve(err ? null : String(stdout))));

/** Gateway padrão: `ip route` e, se não der (Android sem permissão), o dhcp do getprop. Falha = null. */
export async function lerGateway(run = exec) {
  const rota = await run("ip", ["route", "show", "default"]);
  const m = rota && rota.match(/default via (\d+\.\d+\.\d+\.\d+)/);
  if (m) return m[1];
  for (const prop of ["dhcp.wlan0.gateway", "dhcp.wlan1.gateway"]) {
    const v = (await run("getprop", [prop]))?.trim();
    if (v) return v;
  }
  return null;
}

export async function pingGateway(ip, run = exec) {
  if (!ip) return null;
  return (await run("ping", ["-c", "1", "-W", "2", ip], 5_000)) !== null;
}

/** Nome da rede só se o termux-api der; senão null (o aviso fala o motivo). */
export async function lerSsid(run = exec) {
  const out = await run("termux-wifi-connectioninfo", []);
  if (!out) return null;
  try {
    const ssid = String(JSON.parse(out).ssid || "").replace(/^"|"$/g, "");
    return ssid && ssid !== "<unknown ssid>" ? ssid : null;
  } catch { return null; }
}

/**
 * Máquina de estados. prev = {estado, ssid, candidato, vezes} (estado = o último anunciado).
 * Devolve {next, aviso}: aviso = null ou {tipo, titulo, mensagem}. Primeira execução só anuncia se não estiver ok.
 */
export function decidir(prev, leitura, agora = Date.now()) {
  const chave = l => `${l.estado}|${l.ssid || ""}`;
  const atual = { estado: leitura.estado, ssid: leitura.ssid || null };
  if (!prev?.estado) {
    const next = { estado: atual.estado, ssid: atual.ssid, candidato: null, vezes: 0, desde: agora };
    return { next, aviso: atual.estado === "ok" ? null : montarAviso(null, atual) };
  }
  if (chave(atual) === chave(prev)) return { next: { ...prev, candidato: null, vezes: 0 }, aviso: null };
  const vezes = prev.candidato === chave(atual) ? (prev.vezes || 0) + 1 : 1;
  if (vezes < CONFIRMAR) return { next: { ...prev, candidato: chave(atual), vezes }, aviso: null };
  // Nome só aparece/desaparece (sem termux-api) sem mudar o estado: não é mudança de rede.
  if (atual.estado === prev.estado && (!atual.ssid || !prev.ssid)) {
    return { next: { ...prev, ssid: atual.ssid || prev.ssid, candidato: null, vezes: 0 }, aviso: null };
  }
  return { next: { estado: atual.estado, ssid: atual.ssid, candidato: null, vezes: 0, desde: agora }, aviso: montarAviso(prev, atual) };
}

export function montarAviso(prev, atual) {
  const onde = atual.ssid ? ` (${atual.ssid})` : "";
  if (prev && prev.estado === "ok" && atual.estado === "ok") {
    return { tipo: "outra_rede", titulo: "Outra rede Wi-Fi", mensagem: `O aparelho trocou de rede: ${prev.ssid || "?"} → ${atual.ssid || "?"}.` };
  }
  if (atual.estado === "ok") {
    return { tipo: "voltou", titulo: "Rede normal de novo", mensagem: `A internet voltou${onde}.` };
  }
  return { tipo: atual.estado, titulo: "Rede com problema", mensagem: `${MOTIVOS[atual.estado][0].toUpperCase()}${MOTIVOS[atual.estado].slice(1)}${onde}.` };
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function enviarNtfy(cfg, aviso, fetchImpl = fetch) {
  const res = await fetchImpl(cfg.ntfyServer, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: cfg.ntfyTopic, title: aviso.titulo, message: aviso.mensagem,
      priority: aviso.tipo === "voltou" ? 3 : 4, tags: [aviso.tipo === "voltou" ? "white_check_mark" : "warning"],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ntfy respondeu ${res.status}`);
}

export async function notificarLocal(aviso, run = exec) {
  await run("termux-notification", ["--id", "netguard", "--title", aviso.titulo, "--content", aviso.mensagem]);
}

/** Uma rodada. Dependências injetáveis para teste. Devolve {leitura, aviso, enviado}. */
export async function rodar({
  dir = HOME_DIR, agora = Date.now(), fetchImpl = fetch, probeFetch = fetchImpl, run = exec, log = () => {},
} = {}) {
  const arquivo = join(dir, "netguard.json");
  const prev = await readJson(arquivo, null);
  const probe = await lerProbe(probeFetch);
  const gw = await lerGateway(run);
  const gatewayOk = probe.tipo === "204" ? true : await pingGateway(gw, run);
  const leitura = { estado: classificar(probe, gatewayOk), ssid: await lerSsid(run), gateway: gw };
  const { next, aviso } = decidir(prev, leitura, agora);
  let enviado = false;
  if (aviso) {
    const cfg = await readJson(join(dir, "alertas.json"), {});
    // o aviso local não depende da internet; o ntfy depende, e falha dele não perde o aviso (fica pendente)
    await notificarLocal(aviso, run).catch(() => {});
    if (cfg.ntfy_topic) {
      try {
        await enviarNtfy({ ntfyTopic: cfg.ntfy_topic, ntfyServer: cfg.ntfy_server || "https://ntfy.sh" }, aviso, fetchImpl);
        enviado = true;
      } catch (e) { log(`ntfy falhou: ${e.message}`); }
    }
    // sem internet o ntfy não sai: guarda o aviso para mandar quando a rede voltar (uma vez, sem repetir)
    next.pendente = enviado ? null : aviso;
  } else if (prev?.pendente && leitura.estado === "ok") {
    const cfg = await readJson(join(dir, "alertas.json"), {});
    if (cfg.ntfy_topic) {
      try {
        await enviarNtfy({ ntfyTopic: cfg.ntfy_topic, ntfyServer: cfg.ntfy_server || "https://ntfy.sh" },
          { ...prev.pendente, mensagem: `${prev.pendente.mensagem} (aviso atrasado: ficou sem internet)` }, fetchImpl);
        enviado = true; next.pendente = null;
      } catch { next.pendente = prev.pendente; }
    } else next.pendente = null;
  } else if (prev?.pendente) next.pendente = prev.pendente;
  await mkdir(dir, { recursive: true });
  await writeFile(arquivo, JSON.stringify(next));
  return { leitura, aviso, enviado };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  rodar({ log: m => console.error(`[netguard] ${m}`) })
    .then(r => console.log(`[netguard] ${r.leitura.estado}${r.leitura.ssid ? ` (${r.leitura.ssid})` : ""}${r.aviso ? ` · aviso: ${r.aviso.tipo}${r.enviado ? " enviado" : ""}` : ""}`))
    .catch(e => { console.error(`[netguard] erro: ${e.message}`); process.exit(0); });
}
