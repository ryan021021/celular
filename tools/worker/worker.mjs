// Worker do PC para o AgentOps do A13 (projeto celular).
// Busca tarefas dos perfis remotos, roda no PC e devolve o resultado.
// O PC não abre porta: ele é quem chama o A13. Nunca usa --yolo nem pula permissões.
//
// FRONTEIRA DE CONFIANÇA: a tarefa vem do A13, que é o lado MENOS confiável. Então o agente
// no PC só pode LER a própria pasta: nada de Bash/PowerShell, edição, web, MCP ou pastas
// sensíveis (achado Q1 da QA, 19/10: sem --permission-mode o padrão "auto" rodava Bash e lia
// arquivos fora da pasta). pc-hermes fica desligado até um teste provar que é seguro (Q2).
//
// Config (fora do git): %USERPROFILE%\.servidor-a13\worker.json (ou o caminho em WORKER_CONFIG)
//   {"url": "http://192.168.1.127:8090", "token": "<token do worker>", "workdir": "C:/Users/<voce>/agentes-pc"}
// Uso:
//   node tools/worker/worker.mjs            -> fica rodando (heartbeat 30 s, busca a cada 10 s)
//   node tools/worker/worker.mjs --once     -> um ciclo só
//   node tools/worker/worker.mjs --dry-run  -> busca e devolve "dry-run" sem executar nada (teste do protocolo)
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = "worker-pc 1.2";

// Ferramentas que nunca rodam no PC por tarefa vinda da fila
export const DISALLOWED = ["Bash", "PowerShell", "Edit", "Write", "MultiEdit", "NotebookEdit", "WebFetch", "WebSearch", "Agent", "Task"];
// Pastas e arquivos que o agente não lê, nem dentro nem fora da pasta do perfil
export const SENSITIVE = [
  "~/.ssh/**", "~/.servidor-a13/**", "~/.claude/**", "~/.gemini/**", "~/Desktop/**", "~/Documents/**", "~/AppData/**",
  "**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.token", "**/id_ed25519*", "**/id_rsa*",
];

export function claudeSettings() {
  return {
    permissions: {
      allow: ["Read(./**)"],
      deny: [...SENSITIVE.map(p => `Read(${p})`), ...DISALLOWED],
      defaultMode: "dontAsk",
    },
  };
}

/** Comando de cada perfil. Só o texto da tarefa entra, pelo stdin; nunca vira argumento de shell. */
export function buildRunner(profile, dir) {
  if (profile === "pc-claude") {
    return {
      cmd: "claude",
      // --tools + --restricted: a sessão só TEM Read/Grep/Glob (sem ListAgents/SendMessage/Cron… — achado Q3:
      // senão a tarefa podia mandar mensagem para sessões em bypass). --restricted ignora o settings da pasta,
      // então o --settings apontando para ele é obrigatório (provado pela QA: sem ele o .env da pasta vazava).
      args: ["-p", "--output-format", "json", "--permission-mode", "dontAsk",
        "--tools", "Read,Grep,Glob", "--restricted", "--settings", join(dir || ".", ".claude", "settings.json"),
        "--allowedTools", "Read(./**)", "--disallowedTools", DISALLOWED.join(","),
        "--strict-mcp-config", "--max-turns", "10"],
      cwd: dir,
    };
  }
  if (profile === "pc-hermes") {
    return { disabled: "pc-hermes desligado até prova de segurança: não há toolset só de leitura comprovado sem TTY (achado Q2 da QA)" };
  }
  return null;
}

/** Workdir dentro de uma pasta bloqueada = agente não lê nem a própria pasta (achado R1 da QA). */
// O AgentOps recusa corpo > 32 KB, medido em BYTES (server.mjs:26): corta error e output até o JSON caber em 28 KB
export const MAX_BODY = 28 * 1024;
const bytes = o => Buffer.byteLength(JSON.stringify(o));
function cortar(texto, n) { // n caracteres, sem partir um par substituto (emoji)
  if (n > 0 && n < texto.length) { const c = texto.charCodeAt(n - 1); if (c >= 0xd800 && c <= 0xdbff) n--; }
  return texto.slice(0, n);
}
export function fitResult(res, max = MAX_BODY) {
  const r = { ...res };
  // error primeiro e pequeno: o output é o que importa
  for (const k of ["error", "output"]) {
    if (typeof r[k] !== "string" || bytes(r) <= max) continue;
    const orig = r[k];
    const monta = n => cortar(orig, n) + `
[... cortado pelo worker em ${n} caracteres]`;
    let lo = 0, hi = orig.length; // maior n em que o corpo ainda cabe
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; bytes({ ...r, [k]: monta(mid) }) <= max ? lo = mid : hi = mid - 1; }
    r[k] = monta(lo);
  }
  return r;
}

export function blockedWorkdir(workdir, home = homedir()) {
  const norm = p => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const w = norm(workdir), h = norm(home);
  for (const d of [".ssh", ".servidor-a13", ".claude", ".gemini", "Desktop", "Documents", "AppData"]) {
    const b = `${h}/${d.toLowerCase()}`;
    if (w === b || w.startsWith(`${b}/`)) return `~/${d}`;
  }
  return null;
}

/** Pasta do perfil com as regras do Claude Code (isolamento lógico, não sandbox do sistema). */
export function prepareDir(root, profile) {
  if (!/^[a-z0-9-]{1,32}$/.test(profile)) throw new Error("nome de perfil inválido");
  const dir = join(root, profile);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify(claudeSettings(), null, 2));
  return dir;
}

function makeApi(cfg) {
  return async (path, body) => {
    const res = await fetch(cfg.url + path, {
      method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(15_000),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

function run(api, { cmd, args, cwd }, prompt, timeoutMs, leaseId) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // enquanto roda: heartbeat a cada 30 s; se o A13 cancelou esta tarefa, para o processo
    let cancelled = false;
    const beat = setInterval(async () => {
      try {
        const hb = await api("/api/worker/heartbeat", { adapters: ["worker-pc"], version: VERSION });
        if ((hb.body.cancel || []).includes(leaseId)) { cancelled = true; child.kill(); console.log("[worker] cancelada no A13: processo encerrado"); }
      } catch {}
    }, 30_000);
    let out = "", err = "";
    const cap = 256 * 1024;
    child.stdout.on("data", c => { if (out.length < cap) out += c; });
    child.stderr.on("data", c => { if (err.length < cap) err += c; });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", e => { clearTimeout(timer); clearInterval(beat); resolve({ ok: false, error: e.message }); });
    child.on("close", code => {
      clearTimeout(timer); clearInterval(beat);
      if (cancelled) return resolve({ ok: false, error: "cancelada" });
      let text = out;
      try { const j = JSON.parse(out); text = j.result ?? out; if (j.is_error) return resolve({ ok: false, output: text, error: j.subtype || "erro" }); } catch {}
      resolve(code === 0 ? { ok: true, output: text } : { ok: false, output: text, error: err.slice(-2000) || `código ${code}` });
    });
    child.stdin.end(prompt);
  });
}

async function cycle(cfg, api, dry) {
  const hb = await api("/api/worker/heartbeat", { adapters: ["worker-pc"], version: VERSION });
  if (hb.status !== 200) throw new Error(`heartbeat recusado (${hb.status})`);
  if (hb.body.paused) return console.log("[worker] kill switch ligado no A13: nada a fazer");
  const c = await api("/api/worker/claim");
  const task = c.body.task;
  if (!task) return;
  console.log(`[worker] tarefa ${task.id} (${task.profile})`);
  let res;
  const runner = buildRunner(task.profile, null);
  if (!runner) res = { ok: false, error: `perfil ${task.profile} não suportado neste worker` };
  else if (runner.disabled) res = { ok: false, error: runner.disabled };
  else if (dry) res = { ok: true, output: `dry-run: recebido no PC (${task.profile}), nada executado` };
  else {
    const dir = prepareDir(cfg.workdir, task.profile);
    res = await run(api, buildRunner(task.profile, dir), task.prompt, Math.max(60_000, task.timeoutMs - 30_000), task.leaseId);
  }
  const r = await api("/api/worker/result", { id: task.id, leaseId: task.leaseId, ...fitResult(res) });
  console.log(`[worker] resultado ${res.ok ? "ok" : "falha"} entregue (${r.status})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // WORKER_CONFIG permite apontar para outra config (ex.: teste de aceitação contra um AgentOps simulado)
  const cfgPath = process.env.WORKER_CONFIG || join(homedir(), ".servidor-a13", "worker.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const bad = blockedWorkdir(cfg.workdir);
  if (bad) { console.error(`[worker] workdir ${cfg.workdir} fica dentro de ${bad}, que as regras bloqueiam: o agente não leria nem a própria pasta. Use, por exemplo, ~/agentes-pc.`); process.exit(2); }
  const api = makeApi(cfg);
  const once = process.argv.includes("--once"), dry = process.argv.includes("--dry-run");
  if (once || dry) await cycle(cfg, api, dry).catch(e => { console.error(`[worker] ${e.message}`); process.exitCode = 1; });
  else {
    console.log(`[worker] ${VERSION} ligado em ${cfg.url}`);
    for (;;) { await cycle(cfg, api, false).catch(e => console.error(`[worker] ${e.message}`)); await new Promise(r => setTimeout(r, 10_000)); }
  }
}
