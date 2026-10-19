#!/usr/bin/env node
/**
 * Coletor ADB do PC (projeto celular, T27). Lê o aparelho pelo CABO USB com uma lista fixa
 * de comandos só de leitura e produz um snapshot por linha (JSON) no esquema do receptor
 * do painel (server-box/adb-recebe.mjs): {cpuPct, temps:{cpu,gpu,skin,battery}, topApps:[{name,cpuPct}]}.
 *
 *   node tools/server/adb-coletor.mjs --teste [--vezes 3] [--perfil a13]
 *       só lê e imprime aqui; não envia nada e não precisa de chave.
 *   node tools/server/adb-coletor.mjs [--perfil a13]
 *       envia ao A13 por UMA conexão ssh com a chave restrita ~/.ssh/a13_adb_coletor
 *       (no A13: command="node ~/servidor/panel/server-box/adb-recebe.mjs",restrict,from="<IP do PC>").
 *       Este script NUNCA cria chave: sem a chave, ele explica e sai.
 *
 * Nada do aparelho é alterado. Dos processos sai só o nome do executável/script, nunca os
 * argumentos (podem conter texto de tarefas). O painel trata a falta destes dados como
 * "sem dados do ADB", nunca como erro ou alerta.
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVERY_MS = 5_000;
const KEY_FILE = join(homedir(), ".ssh", "a13_adb_coletor");
// tipos do Android (android.os.Temperature): 0 CPU, 1 GPU, 2 BATERIA, 3 PELE
const THERMAL_TYPES = { 0: "cpu", 1: "gpu", 2: "battery", 3: "skin" };

/* ------------------------------------------------------------ parsers (puros, testados) ---- */

/** Último quadro do `top -b -n 2`: CPU do aparelho inteiro (0–100) e os processos que mais gastam. */
export function parseTop(text, { max = 10 } = {}) {
  const lines = String(text || "").split(/\r?\n/);
  let headerAt = -1;
  let cpuPct = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /(\d+)%cpu\b.*?\s(\d+)%idle/.exec(lines[i]);
    if (m) {
      const total = Number(m[1]);
      const idle = Number(m[2]);
      cpuPct = total > 0 ? Math.round(Math.max(0, Math.min(100, ((total - idle) / total) * 100)) * 10) / 10 : null;
      headerAt = i; // fica com o último quadro (o primeiro do top mede desde o boot)
    }
  }
  const apps = [];
  if (headerAt !== -1) {
    for (const line of lines.slice(headerAt + 2)) {
      const m = /^\s*\d+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S\s+([\d.]+)\s+[\d.]+\s+\S+\s+(.+)$/.exec(line);
      if (!m) continue;
      const cpu = Number(m[1]);
      const name = processName(m[2]);
      if (!name || name === "top" || !(cpu > 0)) continue; // o próprio top não conta
      apps.push({ name, cpuPct: Math.round(cpu * 10) / 10 });
    }
  }
  apps.sort((a, b) => b.cpuPct - a.cpuPct);
  return { cpuPct, topApps: apps.slice(0, max) };
}

/** Só o nome: "[kworker/u16:5]" fica; "node /…/server.js --x" vira "node server.js"; pacote fica. */
export function processName(args) {
  const parts = String(args || "").trim().split(/\s+/);
  if (!parts[0]) return null;
  if (parts[0].startsWith("[")) return parts[0].slice(0, 64);
  const exe = basename(parts[0]);
  if (/^(node|python3?|sh|bash)$/.test(exe) && parts[1] && !parts[1].startsWith("-")) return `${exe} ${basename(parts[1])}`.slice(0, 64);
  return exe.slice(0, 64);
}

/** Bloco "Current temperatures from HAL" do `dumpsys thermalservice`: maior valor por tipo; 0,0 = sensor ausente. */
export function parseThermal(text) {
  const lines = String(text || "").split(/\r?\n/);
  const start = lines.findIndex(l => l.startsWith("Current temperatures from HAL"));
  const temps = {};
  if (start === -1) return temps;
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    const m = /mValue=(-?[\d.]+|NaN), mType=(\d+)/.exec(line);
    if (!m) continue;
    const key = THERMAL_TYPES[m[2]];
    const v = Number(m[1]);
    if (!key || !Number.isFinite(v) || v === 0 || v < -30 || v > 130) continue;
    temps[key] = Math.max(temps[key] ?? -Infinity, Math.round(v * 10) / 10);
  }
  return temps;
}

/* ------------------------------------------------------------------- adb ---- */

export function findAdb(env = process.env) {
  if (env.ADB && existsSync(env.ADB)) return env.ADB;
  for (const dir of String(env.PATH || "").split(process.platform === "win32" ? ";" : ":")) {
    for (const name of ["adb.exe", "adb"]) if (dir && existsSync(join(dir, name))) return join(dir, name);
  }
  const local = env.LOCALAPPDATA || "";
  for (const sdk of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, local && join(local, "Android", "Sdk")]) {
    if (sdk && existsSync(join(sdk, "platform-tools", "adb.exe"))) return join(sdk, "platform-tools", "adb.exe");
  }
  // scrcpy do WinGet traz o próprio adb: pega a pasta mais nova
  const winget = local && join(local, "Microsoft", "WinGet", "Packages");
  if (winget && existsSync(winget)) {
    const found = [];
    for (const pkg of readdirSync(winget).filter(n => /scrcpy/i.test(n))) {
      const base = join(winget, pkg);
      for (const sub of readdirSync(base)) {
        const exe = join(base, sub, "adb.exe");
        if (existsSync(exe)) found.push({ exe, t: statSync(exe).mtimeMs });
      }
    }
    found.sort((a, b) => b.t - a.t);
    if (found[0]) return found[0].exe;
  }
  return null;
}

function run(file, args, timeout = 10_000) {
  return new Promise(resolve => {
    execFile(file, args, { timeout, maxBuffer: 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ""), err: err ? String(stderr || err.message).trim().slice(0, 200) : "" });
    });
  });
}

// Lista FIXA de comandos, só leitura. Nada vindo de fora entra aqui.
const READS = {
  top: ["shell", "top", "-b", "-n", "2", "-d", "1", "-m", "15"],
  thermal: ["shell", "dumpsys", "thermalservice"],
};

export async function snapshot(adb, serial) {
  const [top, thermal] = await Promise.all([
    run(adb, ["-s", serial, ...READS.top]),
    run(adb, ["-s", serial, ...READS.thermal]),
  ]);
  const t = top.ok ? parseTop(top.out) : { cpuPct: null, topApps: [] };
  const temps = thermal.ok ? parseThermal(thermal.out) : {};
  return { cpuPct: t.cpuPct, temps, topApps: t.topApps, _erros: [top.ok ? null : `top: ${top.err}`, thermal.ok ? null : `thermalservice: ${thermal.err}`].filter(Boolean) };
}

/* ------------------------------------------------------------------ principal ---- */

function parseArgs(argv) {
  const o = { teste: false, vezes: 3, perfil: "a13" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--teste") o.teste = true;
    else if (argv[i] === "--vezes") o.vezes = Math.max(1, Math.min(100, Number.parseInt(argv[++i], 10) || 3));
    else if (argv[i] === "--perfil") o.perfil = String(argv[++i] || "");
    else throw new Error(`opção desconhecida: ${argv[i]}`);
  }
  if (!/^[a-z0-9_-]{1,32}$/.test(o.perfil)) throw new Error("perfil inválido");
  return o;
}

function loadProfile(id) {
  const p = JSON.parse(readFileSync(join(ROOT, "profiles", `${id}.json`), "utf8"));
  if (!p.serial || !p.network?.ip) throw new Error(`perfil ${id} sem serial ou IP`);
  return p;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const prof = loadProfile(opt.perfil);
  const adb = findAdb();
  if (!adb) { console.error("[coletor] adb não encontrado (defina ADB=caminho do adb.exe)"); process.exit(1); }
  const devices = await run(adb, ["devices"]);
  if (!new RegExp(`^${prof.serial}\\s+device$`, "m").test(devices.out)) {
    console.error(`[coletor] ${prof.name} (${prof.serial}) não está conectado pelo cabo USB (adb devices).`);
    process.exit(1);
  }

  if (opt.teste) {
    for (let i = 0; i < opt.vezes; i++) {
      const s = await snapshot(adb, prof.serial);
      const { _erros, ...linha } = s;
      console.log(JSON.stringify(linha) + (_erros.length ? `   # avisos: ${_erros.join("; ")}` : ""));
      if (i < opt.vezes - 1) await new Promise(r => setTimeout(r, EVERY_MS));
    }
    console.error(`[coletor] modo teste: ${opt.vezes} leitura(s), nada foi enviado.`);
    return;
  }

  if (!existsSync(KEY_FILE)) {
    console.error(`[coletor] falta a chave restrita ${KEY_FILE}. Ela só é criada com o OK explícito do Ryan (T27).`);
    console.error("[coletor] Para ver os dados sem enviar: node tools/server/adb-coletor.mjs --teste");
    process.exit(2);
  }
  // envio: UMA sessão ssh; o command= do A13 ignora o que pedimos e só lê o stdin
  let tries = 0;
  for (;;) {
    const ssh = spawn("ssh", ["-i", KEY_FILE, "-p", String(prof.network.ssh_port || 8022), "-o", "BatchMode=yes", "-o", "ServerAliveInterval=15",
      "-o", "IdentitiesOnly=yes", "-T", `${prof.network.ssh_user}@${prof.network.ip}`], { stdio: ["pipe", "ignore", "inherit"], windowsHide: true });
    let open = true;
    ssh.on("exit", () => { open = false; });
    ssh.stdin.on("error", () => { open = false; });
    console.error(`[coletor] enviando para ${prof.network.ip} a cada ${EVERY_MS / 1000} s`);
    while (open) {
      const { _erros, ...linha } = await snapshot(adb, prof.serial);
      if (open && (linha.cpuPct !== null || Object.keys(linha.temps).length)) { ssh.stdin.write(JSON.stringify(linha) + "\n"); tries = 0; }
      await new Promise(r => setTimeout(r, EVERY_MS));
    }
    tries += 1;
    const wait = Math.min(60_000, 5_000 * 2 ** Math.min(tries - 1, 4));
    console.error(`[coletor] conexão caiu; nova tentativa em ${wait / 1000} s`);
    await new Promise(r => setTimeout(r, wait));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(`[coletor] ${err.message}`); process.exit(1); });
}
