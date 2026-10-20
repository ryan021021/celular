import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";

/**
 * Adaptadores do AgentOps. Cada um declara o que sabe fazer e onde roda.
 * Nenhum aceita comando livre: só o texto da tarefa, dentro do perfil.
 */

const HOME = homedir();
export const AGENTS_ROOT = join(HOME, "agentes");

// Regras de bloqueio do próprio Claude Code em cada pasta de perfil (isolamento lógico, não sandbox de kernel)
// Read vale também para Grep/Glob. ~/servidor inteiro fica de fora (tokens, workers, fila e saídas de outras tarefas).
export const DENY_RULES = [
  "Read(**/.env)", "Read(**/.env.*)", "Read(~/.ssh/**)", "Read(~/.claude/**)", "Read(~/servidor/**)",
  "Read(~/shared/**)", "Read(~/opt/**)", "Read(~/.termux/**)", "Read(**/*.pem)", "Read(**/*.key)", "Read(**/*.token)",
  "Edit(~/servidor/**)", "Write(~/servidor/**)",
  "Bash(curl:*)", "Bash(wget:*)", "Bash(ssh:*)", "Bash(scp:*)", "Bash(rm -rf:*)", "Bash(git push:*)",
];

export function profileDir(name, root = AGENTS_ROOT) {
  if (!/^[a-z0-9-]{1,32}$/.test(name)) throw new Error("nome de perfil inválido");
  const dir = resolve(root, name);
  // portátil (Windows usa "\"): o caminho relativo não pode subir nem ser absoluto (achado R3 da QA)
  const rel = relative(resolve(root), dir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("perfil fora de ~/agentes");
  return dir;
}

export function prepareWorkdir(name, profile, root = AGENTS_ROOT) {
  const dir = profileDir(name, root);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  const settings = { permissions: { allow: profile.allowedTools || [], deny: DENY_RULES }, env: { DISABLE_AUTOUPDATER: "1" } };
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify(settings, null, 2));
  return dir;
}

function runProcess(cmd, args, { cwd, env, signal, input = null, maxBytes = 256 * 1024 }) {
  return new Promise(resolvePromise => {
    const child = spawn(cmd, args, { cwd, env, detached: true, stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"] });
    if (input != null) { child.stdin.on("error", () => {}); child.stdin.end(input); }
    let out = "", err = "";
    let truncated = false;
    const take = (buf, chunk) => { if (buf.length < maxBytes) return buf + chunk.toString("utf8"); truncated = true; return buf; };
    child.stdout.on("data", c => { out = take(out, c); });
    child.stderr.on("data", c => { err = take(err, c); });
    const kill = () => {
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
      setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 5_000).unref();
    };
    if (signal.aborted) kill(); else signal.addEventListener("abort", kill, { once: true });
    child.on("error", e => resolvePromise({ code: -1, out, err: `${err}\n${e.message}` }));
    child.on("close", code => resolvePromise({ code, out, err, truncated }));
  });
}

// Ferramentas que a sessão TEM (lista fechada). Sem isso ela carrega SendMessage, RemoteTrigger, Cron*,
// PushNotification e os conectores da conta (Gmail, Agenda…): o dontAsk só nega o que pede permissão (achado Q7).
export const BASE_TOOLS = ["Read", "Grep", "Glob"];

/**
 * Argumentos do Claude Code para uma tarefa (sem o binário). O TEXTO DA TAREFA NÃO ENTRA AQUI: vai pelo stdin.
 * Como argumento, um texto começando com "-" virava opção do CLI (achado R8 da QA: "-c", "--version"…).
 */
export function claudeArgs(profile, cwd) {
  const tools = profile.tools?.length ? profile.tools : BASE_TOOLS;
  const args = ["-p", "--output-format", "json",
    // dontAsk: nega tudo que não está em allowedTools (o padrão novo do Claude Code é "auto", que aprova sozinho)
    "--permission-mode", "dontAsk",
    // --restricted ignora o settings da pasta: por isso o --settings explícito (provado pela QA no worker)
    "--tools", tools.join(","), "--restricted", "--settings", join(cwd, ".claude", "settings.json"),
    "--strict-mcp-config", "--max-turns", String(profile.maxTurns ?? 10)];
  if (profile.allowedTools?.length) args.push("--allowedTools", profile.allowedTools.join(","));
  return args;
}

/** Claude Code oficial no próprio A13 (via carregador musl; ver docs/AGENT_RUNTIME_MATRIX.md). */
export function claudeLocal({ ccDir = join(HOME, "opt", "claude-code", "current") } = {}) {
  const loader = join(ccDir, "ld-musl-aarch64.so.1");
  const bin = join(ccDir, "claude");
  return {
    local: true,
    capabilities: ["ler e editar arquivos na pasta do perfil", "ferramentas limitadas por perfil", "sem acesso à rede por Bash"],
    limits: ["isolamento lógico (regras do Claude Code), não sandbox de kernel", "1 tarefa por vez (3,6 GB de RAM)", "precisa de login feito pelo dono"],
    available: () => existsSync(loader) && existsSync(bin),
    async run({ task, profile, signal }) {
      if (!existsSync(bin)) return { ok: false, retryable: false, error: "Claude Code não instalado" };
      const cwd = prepareWorkdir(task.profile, profile);
      const args = [bin, ...claudeArgs(profile, cwd)];
      const env = {
        HOME, PATH: process.env.PATH, LANG: "C.UTF-8", TMPDIR: process.env.TMPDIR || join(HOME, "..", "usr", "tmp"),
        USE_BUILTIN_RIPGREP: "0", DISABLE_AUTOUPDATER: "1", SHELL: process.env.SHELL || "/data/data/com.termux/files/usr/bin/bash",
        // musl não acha DNS no Android: sai pelo proxy local (só domínios da Anthropic)
        HTTPS_PROXY: "http://127.0.0.1:8091", HTTP_PROXY: "http://127.0.0.1:8091", NO_PROXY: "127.0.0.1,localhost",
      };
      const r = await runProcess(loader, args, { cwd, env, signal, input: task.prompt });
      let parsed = null;
      try { parsed = JSON.parse(r.out); } catch {}
      if (/Not logged in|Please run \/login|Invalid API key/i.test(r.out + r.err)) {
        return { ok: false, retryable: false, error: "Claude Code sem login no A13 (rode `claude` e /login)" };
      }
      // saída acima de 256 KB cortada com código 0: o JSON não fecha, mas a tarefa terminou (achado G5)
      if (r.code === 0 && !parsed && r.truncated) return { ok: true, output: `${r.out}
[saída cortada em 256 KB]` };
      if (r.code === 0 && parsed && !parsed.is_error) return { ok: true, output: parsed.result ?? r.out };
      return { ok: false, output: parsed?.result ?? r.out, error: (parsed?.subtype || r.err || `código ${r.code}`).toString() };
    },
  };
}

/** Worker remoto (PC): não roda nada aqui; a tarefa espera o worker buscar. */
export function remoteWorker(description) {
  return { local: false, capabilities: [description], limits: ["depende do worker estar ligado e com heartbeat"], available: () => true, async run() { return { ok: false, error: "tarefa remota não roda localmente" }; } };
}
