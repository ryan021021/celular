import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createStore, createRunner, makeRedactor, validateSubmission } from "./core.mjs";
import { claudeLocal, remoteWorker } from "./adapters.mjs";

/**
 * API do AgentOps (porta 8090). Dois níveis de acesso:
 * - admin  (~/servidor/agentops.token): ver tudo, criar/cancelar/repetir tarefas, kill switch.
 * - worker (~/servidor/agentops-workers.json): só heartbeat, buscar tarefa dos seus perfis e devolver resultado.
 * Não existe rota que execute comando: tarefas só escolhem um perfil de profiles.json.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SEC = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };
const JSONH = { "Content-Type": "application/json; charset=utf-8", ...SEC };

const sha = s => createHash("sha256").update(String(s)).digest();
const same = (a, b) => timingSafeEqual(sha(a), sha(b));
const readJson = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const readText = p => { try { return readFileSync(p, "utf8").trim(); } catch { return ""; } };

function body(req, limit = 32 * 1024) {
  return new Promise((ok, fail) => {
    let size = 0; const parts = [];
    req.on("data", c => { size += c.length; if (size > limit) { fail(new Error("corpo grande demais")); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {}); } catch { fail(new Error("JSON inválido")); } });
    req.on("error", fail);
  });
}

export function publicTask(t, { full = false } = {}) {
  const base = { id: t.id, profile: t.profile, status: t.status, priority: t.priority, attempts: t.attempts, maxAttempts: t.maxAttempts,
    createdAt: t.createdAt, startedAt: t.startedAt, finishedAt: t.finishedAt, error: t.error, claimedBy: t.claimedBy };
  return full ? { ...base, prompt: t.prompt, output: t.output } : base;
}

export function createApp({ dir, profiles, adapters, adminToken, workers = {}, now = Date.now, rand, secrets = [] }) {
  const redact = makeRedactor([adminToken, ...Object.values(workers).map(w => w.token), ...secrets]);
  // todo log do AgentOps passa pela máscara (T65): a fila e o runner também escrevem erros
  const log = m => console.error(redact(m));
  const store = createStore(dir, { now, log });
  const runner = createRunner({ store, profiles, adapters, redact, now, rand, log });
  const heartbeats = {};
  store.recoverInterrupted();

  const who = req => {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return null;
    const t = h.slice(7).trim();
    if (adminToken && same(t, adminToken)) return { role: "admin" };
    for (const [id, w] of Object.entries(workers)) if (w.token && same(t, w.token)) return { role: "worker", id, profiles: w.profiles || [] };
    return null;
  };

  const agentState = () => Object.fromEntries(Object.entries(adapters).map(([name, a]) => {
    let state = a.available() ? "idle" : "offline";
    if (a.local && runner.busy) state = "running";
    if (!a.local) {
      const beats = Object.entries(heartbeats).filter(([, h]) => (h.adapters || []).includes(name));
      const fresh = beats.some(([, h]) => now() - h.at < 120_000);
      state = fresh ? "idle" : beats.length ? "degraded" : "offline";
    }
    return [name, { state, local: !!a.local, capabilities: a.capabilities, limits: a.limits }];
  }));

  const handler = async (req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, obj) => { res.writeHead(code, JSONH); res.end(JSON.stringify(obj)); };
    try {
      if (url.pathname === "/health") return send(200, { ok: true, service: "agentops" });
      const me = who(req);
      if (!me) return send(401, { ok: false, error: "não autorizado" });

      // ---- worker ----
      if (me.role === "worker") {
        const m = url.pathname.match(/^\/api\/worker\/(heartbeat|claim|result)$/);
        if (!m || req.method !== "POST") return send(403, { ok: false, error: "rota não permitida para worker" });
        const b = await body(req);
        if (m[1] === "heartbeat") {
          const adaptersDeclared = Array.isArray(b.adapters) ? b.adapters.filter(x => typeof x === "string").slice(0, 10) : [];
          heartbeats[me.id] = { at: now(), adapters: adaptersDeclared, version: String(b.version || "").slice(0, 60) };
          return send(200, { ok: true, paused: store.state.paused, cancel: runner.cancelledFor(me.id) });
        }
        if (m[1] === "claim") {
          const t = runner.claim(me.id, me.profiles);
          return send(200, { ok: true, task: t ? { id: t.id, leaseId: t.leaseId, profile: t.profile, prompt: t.prompt, timeoutMs: t.timeoutMs } : null });
        }
        if (typeof b.id !== "string" || typeof b.leaseId !== "string" || typeof b.ok !== "boolean") return send(400, { ok: false, error: "esperado {id, leaseId, ok, output?, error?}" });
        const accepted = runner.report(b.id, me.id, b.leaseId, { ok: b.ok, output: String(b.output || ""), error: String(b.error || "") });
        return send(accepted ? 200 : 409, { ok: accepted });
      }

      // ---- admin ----
      if (req.method === "GET" && url.pathname === "/api/state") {
        const counts = Object.fromEntries(["queued", "running", "succeeded", "failed", "cancelled"].map(s => [s, store.state.tasks.filter(t => t.status === s).length]));
        return send(200, { ok: true, paused: store.state.paused, counts, agents: agentState(), workers: Object.fromEntries(Object.entries(heartbeats).map(([id, h]) => [id, { lastSeen: h.at, adapters: h.adapters, version: h.version }])), profiles: Object.fromEntries(Object.entries(profiles).map(([n, p]) => [n, { adapter: p.adapter, description: p.description }])) });
      }
      if (req.method === "GET" && url.pathname === "/api/tasks") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
        const status = url.searchParams.get("status");
        const list = store.state.tasks.filter(t => !status || t.status === status).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
        return send(200, { ok: true, tasks: list.map(t => publicTask(t)) });
      }
      const one = url.pathname.match(/^\/api\/tasks\/([0-9a-f-]{36})(?:\/(cancel|retry))?$/);
      if (one) {
        const t = store.get(one[1]);
        if (!t) return send(404, { ok: false, error: "tarefa não encontrada" });
        if (!one[2] && req.method === "GET") return send(200, { ok: true, task: publicTask(t, { full: true }) });
        if (one[2] && req.method === "POST") {
          const done = one[2] === "cancel" ? runner.cancel(t.id) : runner.retry(t.id);
          return send(done ? 200 : 409, { ok: done, task: publicTask(t) });
        }
      }
      if (req.method === "POST" && url.pathname === "/api/tasks") {
        const b = await body(req);
        const err = validateSubmission(b, profiles);
        if (err) return send(400, { ok: false, error: err });
        const t = store.add(b.profile, profiles[b.profile], b.prompt, b.priority ?? 5);
        setImmediate(() => runner.tick());
        return send(201, { ok: true, task: publicTask(t) });
      }
      if (req.method === "POST" && (url.pathname === "/api/pause" || url.pathname === "/api/resume")) {
        runner.setPaused(url.pathname === "/api/pause");
        return send(200, { ok: true, paused: store.state.paused });
      }
      return send(404, { ok: false, error: "rota não encontrada" });
    } catch (err) {
      if (err.message === "JSON inválido" || err.message === "corpo grande demais") return send(400, { ok: false, error: err.message });
      console.error(`[agentops] erro interno em ${req.method} ${url.pathname}: ${redact(err.stack || err.message)}`);
      return send(500, { ok: false, error: "erro interno" }); // ex.: disco cheio; detalhes só no log
    }
  };

  return { handler, store, runner, tick: () => { runner.expireLeases(); return runner.tick(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const S = join(homedir(), "servidor");
  const adminToken = readText(join(S, "agentops.token"));
  if (adminToken.length < 24) { console.error("[agentops] falta ~/servidor/agentops.token (24+ caracteres)"); setTimeout(() => process.exit(1), 60_000); }
  else {
    const profiles = readJson(join(HERE, "profiles.json"), {});
    const workers = readJson(join(S, "agentops-workers.json"), {});
    const adapters = { "claude-local": claudeLocal(), "worker-pc": remoteWorker("worker no PC (Claude Code ou Hermes)") };
    const secrets = [readText(join(S, "painel.token")), readJson(join(S, "alertas.json"), {}).ntfy_topic].filter(Boolean);
    const app = createApp({ dir: join(S, "agentops-data"), profiles, adapters, adminToken, workers, secrets });
    const port = Number(process.env.AGENTOPS_PORT) || 8090;
    const server = createServer(app.handler).listen(port, "0.0.0.0", () => console.log(`[agentops] ouvindo em :${port}; perfis: ${Object.keys(profiles).join(", ")}; workers: ${Object.keys(workers).length}; pausado: ${app.store.state.paused}`));
    const timer = setInterval(app.tick, 5_000);
    const stop = () => { clearInterval(timer); app.runner.abortAll(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 6_000).unref(); };
    process.on("SIGTERM", stop); process.on("SIGINT", stop);
  }
}
