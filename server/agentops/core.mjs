import { randomUUID, randomInt } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, appendFileSync, statSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeRedactor } from "./redact.mjs";

export { makeRedactor }; // compatibilidade: server.mjs e os testes importam daqui

/**
 * AgentOps (projeto celular): fila persistente de tarefas para agentes.
 * - Tarefa = perfil + texto. Nunca um comando: o perfil define o que pode rodar.
 * - Estados: queued -> running -> succeeded | failed | cancelled.
 * - Timeout por tarefa, tentativas limitadas com backoff exponencial + jitter.
 * - Kill switch (pausa global) persistido em disco.
 * - Ao reiniciar, tarefa que estava "running" volta para a fila (conta como tentativa).
 */

export const TASK_STATES = ["queued", "running", "succeeded", "failed", "cancelled"];
const FINAL = new Set(["succeeded", "failed", "cancelled"]);
const MAX_PROMPT = 8_000;
const MAX_OUTPUT = 32 * 1024;
const MAX_HISTORY = 200; // cada save regrava o JSON inteiro: histórico e saídas menores = menos escrita no A13

export function backoffMs(attempt, baseMs = 30_000, maxMs = 30 * 60_000, rand = randomInt) {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + rand(0, Math.max(1, Math.round(exp / 2))));
}

export function truncate(text, max = MAX_OUTPUT) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max)}\n[... saída cortada em ${max} caracteres]` : s;
}

export function validateSubmission(body, profiles) {
  if (!body || typeof body !== "object") return "corpo inválido";
  if (typeof body.profile !== "string" || !Object.hasOwn(profiles, body.profile)) return "perfil desconhecido";
  if (typeof body.prompt !== "string" || !body.prompt.trim()) return "prompt vazio";
  if (body.prompt.length > MAX_PROMPT) return `prompt maior que ${MAX_PROMPT} caracteres`;
  if (body.priority !== undefined && (!Number.isInteger(body.priority) || body.priority < 0 || body.priority > 9)) return "prioridade deve ser inteiro de 0 a 9";
  const extra = Object.keys(body).filter(k => !["profile", "prompt", "priority"].includes(k));
  if (extra.length) return `campos não aceitos: ${extra.join(", ")}`;
  return null;
}

export const SCHEMA_VERSION = 1;

/**
 * Leva o conteúdo lido do state.json até a versão atual. Pura: não toca em disco.
 * - v0 (sem `schema_version`, arquivos de antes da T73) -> v1: só marca a versão e garante paused/tasks/agents.
 * - já na versão atual: devolve igual (idempotente).
 * - versão desconhecida/futura ou formato impossível: lança erro (o chamador guarda o arquivo e não o reescreve).
 */
export function migrateState(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("state.json não é um objeto");
  const from = parsed.schema_version === undefined ? 0 : parsed.schema_version;
  if (!Number.isInteger(from) || from < 0) throw new Error(`schema_version inválida (${JSON.stringify(parsed.schema_version)})`);
  if (from > SCHEMA_VERSION) throw new Error(`state.json é de uma versão mais nova (v${from}; este código entende até v${SCHEMA_VERSION})`);
  if (parsed.tasks !== undefined && !Array.isArray(parsed.tasks)) throw new Error("state.json: tasks não é uma lista");
  if (parsed.agents !== undefined && (typeof parsed.agents !== "object" || parsed.agents === null || Array.isArray(parsed.agents))) throw new Error("state.json: agents não é um objeto");
  const state = { ...parsed, schema_version: SCHEMA_VERSION };
  if (from === 0) {
    state.paused = parsed.paused === true;
    state.tasks = parsed.tasks ?? [];
    state.agents = parsed.agents ?? {};
  }
  return { from, state };
}

export function createStore(dir, { now = Date.now, maxEventBytes = 1024 * 1024, log = console.error } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "state.json");
  const eventsFile = join(dir, "events.jsonl");
  let state = { schema_version: SCHEMA_VERSION, paused: false, tasks: [], agents: {} };
  let corrupted = null;
  let migrated = null;
  let migrationBackup = null; // cópia do arquivo antigo, gravada antes de qualquer reescrita
  if (existsSync(file)) {
    let raw = null, loaded = null;
    try {
      raw = readFileSync(file, "utf8");
      loaded = migrateState(JSON.parse(raw));
    } catch (err) {
      // não sobrescreve em silêncio: guarda o arquivo ruim (ou de versão futura) e avisa
      corrupted = `${file}.corrompido-${now()}`;
      renameSync(file, corrupted);
      log(`[agentops] state.json ilegível (${err.message}); guardado em ${corrupted}; fila começa vazia`);
    }
    if (loaded) {
      if (loaded.from !== SCHEMA_VERSION) {
        // guarda o original ANTES de reescrever; se não der para guardar, a falha sobe e o arquivo fica como está
        migrationBackup = `${file}.v${loaded.from}-${now()}.bak`;
        writeFileSync(migrationBackup, raw, { mode: 0o600, flag: "wx" });
        migrated = { from: loaded.from, to: SCHEMA_VERSION, backup: migrationBackup };
      }
      state = { ...state, ...loaded.state };
    }
  }

  const save = () => {
    const tmp = `${file}.tmp`;
    const fd = openSync(tmp, "w", 0o600);
    try { writeSync(fd, JSON.stringify(state)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, file); // escrita atômica + fsync: queda de energia não deixa state.json vazio
  };
  const event = (type, data = {}) => {
    try {
      if (statSync(eventsFile).size > maxEventBytes) renameSync(eventsFile, `${eventsFile}.1`);
    } catch {}
    appendFileSync(eventsFile, `${JSON.stringify({ at: new Date(now()).toISOString(), type, ...data })}\n`, { mode: 0o600 });
  };
  const prune = () => {
    const finals = state.tasks.filter(t => FINAL.has(t.status));
    if (finals.length > MAX_HISTORY) {
      const drop = new Set(finals.sort((a, b) => a.finishedAt - b.finishedAt).slice(0, finals.length - MAX_HISTORY).map(t => t.id));
      state.tasks = state.tasks.filter(t => !drop.has(t.id));
    }
  };

  if (corrupted) appendFileSync(eventsFile, `${JSON.stringify({ at: new Date(now()).toISOString(), type: "state.corrupted", file: corrupted })}\n`, { mode: 0o600 });
  if (migrated) {
    save();
    event("state.migrated", migrated);
    log(`[agentops] state.json migrado v${migrated.from} -> v${migrated.to}; original guardado em ${migrated.backup}`);
  }

  return {
    get state() { return state; },
    corrupted, migrated,
    save, event,
    add(profileName, profile, prompt, priority = 5) {
      const task = {
        id: randomUUID(), profile: profileName, prompt, priority, status: "queued",
        attempts: 0, maxAttempts: profile.maxAttempts ?? 3, timeoutMs: profile.timeoutMs ?? 10 * 60_000,
        idempotent: profile.idempotent !== false,
        createdAt: now(), notBefore: 0, startedAt: null, finishedAt: null, output: "", error: "",
      };
      state.tasks.push(task); prune(); save();
      event("task.queued", { id: task.id, profile: profileName });
      return task;
    },
    get(id) { return state.tasks.find(t => t.id === id) || null; },
    recoverInterrupted() {
      let n = 0;
      for (const t of state.tasks) if (t.status === "running") {
        // remota com prazo válido: o worker ainda pode estar trabalhando; quem cuida é o expireLeases()
        if (t.claimedBy && t.leaseUntil > now()) continue;
        n++;
        if (t.idempotent === false) { t.status = "failed"; t.error = "interrompida por reinício; não é segura para repetir sozinha (repita manualmente)"; t.finishedAt = now(); }
        else if (t.attempts >= t.maxAttempts) { t.status = "failed"; t.error = "interrompida por reinício e sem tentativas restantes"; t.finishedAt = now(); }
        else { t.status = "queued"; t.error = "interrompida por reinício"; t.notBefore = 0; }
        event("task.recovered", { id: t.id, status: t.status });
      }
      if (n) save();
      return n;
    },
  };
}

/**
 * Executor: pega a próxima tarefa e roda no adaptador do perfil.
 * adapters: { nome: { run({ task, profile, signal }) -> Promise<{ ok, output, error }> } }
 */
export function createRunner({ store, profiles, adapters, redact = s => s, concurrency = 1, now = Date.now, rand = randomInt, log = () => {} }) {
  const running = new Map(); // id -> AbortController

  const finish = (task, patch, type) => {
    Object.assign(task, patch, { finishedAt: now() });
    store.save(); store.event(type, { id: task.id, attempts: task.attempts, error: task.error ? task.error.slice(0, 200) : undefined });
  };

  async function runOne(task) {
    const profile = profiles[task.profile];
    const adapter = adapters[profile.adapter];
    const ctrl = new AbortController();
    running.set(task.id, ctrl);
    task.status = "running"; task.attempts += 1; task.startedAt = now(); task.error = "";
    store.save(); store.event("task.started", { id: task.id, attempt: task.attempts });
    const timer = setTimeout(() => ctrl.abort("timeout"), task.timeoutMs);
    let res;
    try {
      res = await adapter.run({ task, profile, signal: ctrl.signal });
    } catch (err) {
      res = { ok: false, error: String(err?.message || err) };
    } finally {
      clearTimeout(timer);
      running.delete(task.id);
    }
    const output = truncate(redact(res.output || ""));
    const error = truncate(redact(res.error || ""), 4000);
    if (task.status === "cancelled") return; // cancelada durante a execução: não muda mais
    if (res.ok) return finish(task, { status: "succeeded", output, error: "" }, "task.succeeded");
    const reason = ctrl.signal.aborted ? `tempo esgotado (${Math.round(task.timeoutMs / 1000)} s)` : error || "falhou sem mensagem";
    if (task.attempts < task.maxAttempts && res.retryable !== false) {
      task.status = "queued"; task.output = output; task.error = reason;
      task.notBefore = now() + backoffMs(task.attempts, profile.backoffMs, undefined, rand);
      store.save(); store.event("task.retry", { id: task.id, attempt: task.attempts, inMs: task.notBefore - now() });
    } else {
      finish(task, { status: "failed", output, error: reason }, "task.failed");
    }
  }

  return {
    get busy() { return running.size; },
    tick() {
      if (store.state.paused) return 0;
      const localAdapters = Object.entries(profiles).filter(([, p]) => adapters[p.adapter]?.local).map(([n]) => n);
      let started = 0;
      while (running.size < concurrency) {
        const task = store.state.tasks
          .filter(t => t.status === "queued" && t.notBefore <= now() && localAdapters.includes(t.profile) && !running.has(t.id))
          .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
        if (!task) break;
        started++;
        runOne(task).catch(err => log(`[agentops] erro inesperado: ${err.message}`));
      }
      return started;
    },
    cancel(id) {
      const task = store.get(id);
      if (!task || FINAL.has(task.status)) return false;
      task.status = "cancelled"; task.finishedAt = now(); task.error = "cancelada";
      running.get(id)?.abort("cancel");
      store.save(); store.event("task.cancelled", { id });
      return true;
    },
    retry(id) {
      const task = store.get(id);
      if (!task || !["failed", "cancelled"].includes(task.status)) return false;
      Object.assign(task, { status: "queued", attempts: 0, notBefore: 0, error: "", finishedAt: null });
      store.save(); store.event("task.requeued", { id });
      return true;
    },
    // Workers remotos (PC): buscam tarefa, recebem um prazo e devolvem o resultado.
    claim(workerId, allowedProfiles) {
      if (store.state.paused) return null;
      const task = store.state.tasks
        .filter(t => t.status === "queued" && t.notBefore <= now() && allowedProfiles.includes(t.profile)
          && profiles[t.profile] && !adapters[profiles[t.profile].adapter]?.local)
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
      if (!task) return null;
      Object.assign(task, { status: "running", attempts: task.attempts + 1, startedAt: now(), claimedBy: workerId, leaseId: randomUUID(), leaseUntil: now() + task.timeoutMs, error: "" });
      store.save(); store.event("task.claimed", { id: task.id, worker: workerId, attempt: task.attempts });
      return task;
    },
    // leaseId: resposta atrasada de uma tentativa antiga não fecha a tentativa nova
    report(id, workerId, leaseId, res) {
      const task = store.get(id);
      if (!task || task.status !== "running" || task.claimedBy !== workerId || task.leaseId !== leaseId) return false;
      const output = truncate(redact(res.output || ""));
      const error = truncate(redact(res.error || ""), 4000);
      if (res.ok) finish(task, { status: "succeeded", output, error: "" }, "task.succeeded");
      else if (task.attempts < task.maxAttempts) {
        Object.assign(task, { status: "queued", claimedBy: null, leaseId: null, leaseUntil: null, output, error: error || "worker relatou falha", notBefore: now() + backoffMs(task.attempts, profiles[task.profile]?.backoffMs, undefined, rand) });
        store.save(); store.event("task.retry", { id, attempt: task.attempts });
      } else finish(task, { status: "failed", output, error: error || "worker relatou falha" }, "task.failed");
      return true;
    },
    expireLeases() {
      let n = 0;
      for (const t of store.state.tasks) if (t.status === "running" && t.leaseUntil && t.leaseUntil < now()) {
        n++;
        if (t.attempts < t.maxAttempts) Object.assign(t, { status: "queued", claimedBy: null, leaseId: null, leaseUntil: null, error: "worker não respondeu no prazo", notBefore: now() + backoffMs(t.attempts, profiles[t.profile]?.backoffMs, undefined, rand) });
        else Object.assign(t, { status: "failed", error: "worker não respondeu no prazo", finishedAt: now() });
        store.event("task.lease_expired", { id: t.id });
      }
      if (n) store.save();
      return n;
    },
    // tarefas deste worker que foram canceladas enquanto ele trabalhava (o heartbeat avisa para abortar)
    cancelledFor(workerId) {
      return store.state.tasks.filter(t => t.status === "cancelled" && t.claimedBy === workerId && t.finishedAt && now() - t.finishedAt < 10 * 60_000).map(t => t.leaseId).filter(Boolean);
    },
    setPaused(paused) {
      store.state.paused = paused; store.save(); store.event(paused ? "killswitch.on" : "killswitch.off");
    },
    abortAll() { for (const c of running.values()) c.abort("shutdown"); },
  };
}
