// Ensaio de reconstrução do zero a partir do backup (QA, T20). Roda só no PC; não fala com o A13.
//   node tools/qa/reconstrucao.mjs                     -> último backup em backups/
//   node tools/qa/reconstrucao.mjs --backup <arquivo>  -> um backup específico
//   node tools/qa/reconstrucao.mjs --json <saida.json> --manter
// O que prova:
//   1. sha256 do arquivo confere e o procedimento oficial de restauração (tools/server/backup.sh --restaurar) funciona
//   2. os arquivos essenciais estão lá (a mesma lista que o backup.sh confere) e a fila do AgentOps é JSON válido
//   3. o painel renasce do bundle git do backup (clone do branch celular) no commit registrado em commit.txt
//   4. esse painel SOBE com os dados restaurados (HOME = pasta restaurada; só 127.0.0.1): /health 200, /ready,
//      /api/v1/* 401 sem token e 200 com o painel.token restaurado
//   5. o AgentOps do backup sobe com a fila restaurada (127.0.0.1, sem executar tarefas): /health, /api/state com o
//      token admin restaurado, mesma contagem de tarefas do state.json, 401 com token errado; o painel restaurado o enxerga
// A pasta restaurada tem SEGREDOS (tokens, chaves de host do SSH): fica em %TEMP% e é apagada no fim, mesmo com erro.
// Nenhum segredo é impresso. Não sobe o vigia de alertas (não manda push).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const WIN = process.platform === "win32";
const passos = [];
const passo = (nome, ok, detalhe = "") => { passos.push({ nome, ok, detalhe }); console.log(`${ok ? "ok  " : "FALHA"} ${nome}${detalhe ? ` · ${detalhe}` : ""}`); return ok; };

const backups = readdirSync(join(ROOT, "backups")).filter(f => /^a13-\d{8}-\d{6}\.tar\.gz\.enc$/.test(f)).sort();
const arquivo = resolve(arg("--backup", backups.length ? join(ROOT, "backups", backups.at(-1)) : ""));
const tmp = mkdtempSync(join(tmpdir(), "qa-reconstrucao-"));
const home = join(tmp, "home");
const filhos = [];

const portaLivre = () => new Promise(ok => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const esperar = async (fn, ms = 20_000) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { const r = await fn(); if (r) return r; } catch {} await new Promise(r => setTimeout(r, 300)); } return null; };
const pedir = async (url, token) => { const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: "manual", signal: AbortSignal.timeout(8_000) }); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; };
function subir(cmd, args, env, cwd) {
  const c = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  c.log = ""; c.stdout.on("data", d => { c.log += d; }); c.stderr.on("data", d => { c.log += d; });
  filhos.push(c); return c;
}
function parar(c) { if (c.exitCode !== null) return; if (WIN) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { windowsHide: true }); else c.kill("SIGKILL"); }
const ler = p => readFileSync(join(home, p), "utf8").trim();

try {
  // 1. integridade e restauração oficial
  if (!passo("backup encontrado", existsSync(arquivo), arquivo.replace(ROOT, "."))) throw new Error("sem backup");
  const idade = (Date.now() - statSync(arquivo).mtimeMs) / 3_600_000;
  passo("idade do backup", idade < 8 * 24, `${idade.toFixed(1)} h (o vigia avisa com mais de 8 dias)`);
  const esperado = readFileSync(`${arquivo}.sha256`, "utf8").split(/\s+/)[0];
  const real = createHash("sha256").update(readFileSync(arquivo)).digest("hex");
  passo("sha256 confere", esperado === real, real.slice(0, 16));
  const r = spawnSync("bash", [join(ROOT, "tools", "server", "backup.sh"), "--restaurar", arquivo, home], { encoding: "utf8", windowsHide: true });
  if (!passo("backup.sh --restaurar", r.status === 0, (r.stdout + r.stderr).trim().split("\n").pop().replace(tmp, "%TEMP%\\qa-reconstrucao-*"))) throw new Error("restauração falhou");

  // 2. essenciais (mesma lista do backup.sh) + fila
  const essenciais = ["servidor/alertas.json", "servidor/painel.token", "servidor/start-services.sh", "servidor/watchdog.sh",
    "servidor/panel/server-box/server.js", "servidor/.inventario/crontab.txt", "servidor/.inventario/server-box.bundle",
    ".termux/boot/boot.sh", ".ssh/authorized_keys", "etc/ssh/ssh_host_ed25519_key", "var/service/server-box/run", "var/service/alertas/run",
    "servidor/agentops/server.mjs", "servidor/agentops.token", "servidor/agentops-workers.json", "servidor/agentops-data/state.json",
    "servidor/sftp/host_ed25519", "servidor/sftp_authorized_keys", "var/service/agentops/run", "var/service/sftp/run"];
  const faltando = essenciais.filter(f => !existsSync(join(home, f)) || statSync(join(home, f)).size === 0);
  passo("arquivos essenciais", faltando.length === 0, faltando.length ? `faltando: ${faltando.join(", ")}` : `${essenciais.length}/${essenciais.length}`);
  // Aviso, não falha: o DISASTER_RECOVERY manda rodar o deploy.ps1 depois de restaurar, e ele recria os serviços runit
  // a partir do repositório. Mas a lista do backup.sh deveria acompanhar os serviços (achado Q6).
  const semOpc = ["var/service/egress/run", "servidor/termux/egress-proxy.mjs"].filter(f => !existsSync(join(home, f)));
  passo("backup acompanha os serviços novos (egress)", true, semOpc.length ? `AVISO: ausentes ${semOpc.join(", ")}; o deploy.ps1 recria` : "presentes");
  let estado = null;
  try { estado = JSON.parse(ler("servidor/agentops-data/state.json")); } catch {}
  passo("fila do AgentOps é JSON válido", !!estado && Array.isArray(estado.tasks), estado ? `${estado.tasks.length} tarefa(s), pausado=${!!estado.paused}` : "ilegível");

  // 3. painel a partir do bundle
  const painel = join(tmp, "painel");
  const clone = spawnSync("git", ["clone", "-q", "-b", "celular", join(home, "servidor", ".inventario", "server-box.bundle"), painel], { encoding: "utf8", windowsHide: true });
  const commitBundle = clone.status === 0 ? spawnSync("git", ["-C", painel, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim() : "";
  const commitTxt = ler("servidor/.inventario/commit.txt").split(" ")[0];
  passo("painel clonado do bundle no commit de produção", !!commitBundle && commitBundle === commitTxt, `${commitBundle.slice(0, 7) || "falhou"} (commit.txt ${commitTxt.slice(0, 7)})`);

  // 5 (antes do 4, para o painel enxergar o AgentOps). AgentOps do backup com a fila restaurada, só 127.0.0.1 e sem tick
  const portaAo = await portaLivre();
  const driver = join(tmp, "agentops-driver.mjs");
  writeFileSync(driver, [
    `import { createServer } from "node:http";`,
    `import { readFileSync } from "node:fs";`,
    `import { join } from "node:path";`,
    `import { pathToFileURL } from "node:url";`,
    `const S = ${JSON.stringify(join(home, "servidor"))};`,
    `const { createApp } = await import(pathToFileURL(join(S, "agentops", "server.mjs")).href);`,
    `const { remoteWorker } = await import(pathToFileURL(join(S, "agentops", "adapters.mjs")).href);`,
    `const rj = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };`,
    `const app = createApp({ dir: join(S, "agentops-data"), profiles: rj(join(S, "agentops", "profiles.json"), {}),`,
    `  adapters: { "claude-local": remoteWorker("desligado no ensaio"), "worker-pc": remoteWorker("desligado no ensaio") },`,
    `  adminToken: readFileSync(join(S, "agentops.token"), "utf8").trim(), workers: rj(join(S, "agentops-workers.json"), {}) });`,
    `createServer(app.handler).listen(${portaAo}, "127.0.0.1", () => console.log("agentops restaurado ouvindo"));`,
  ].join("\n"));
  const ao = subir(process.execPath, [driver], {}, tmp);
  const saude = await esperar(async () => (await pedir(`http://127.0.0.1:${portaAo}/health`)).status === 200);
  passo("AgentOps restaurado sobe (/health 200)", !!saude, saude ? "" : ao.log.slice(-300));
  const admin = ler("servidor/agentops.token");
  const st = await pedir(`http://127.0.0.1:${portaAo}/api/state`, admin).catch(() => ({ status: 0 }));
  const contagem = st.body?.counts ? Object.values(st.body.counts).reduce((a, b) => a + b, 0) : NaN;
  passo("token admin restaurado abre /api/state", st.status === 200, `HTTP ${st.status}`);
  passo("fila restaurada = state.json", estado && contagem === estado.tasks.length, `API ${contagem} · arquivo ${estado?.tasks.length}`);
  passo("token errado é recusado", (await pedir(`http://127.0.0.1:${portaAo}/api/state`, "x".repeat(40))).status === 401);

  // 4. painel do bundle com os dados restaurados
  const portaPainel = await portaLivre();
  const pn = subir(process.execPath, [join(painel, "server.js")], {
    USERPROFILE: home, HOME: home, HOST: "127.0.0.1", PORT: String(portaPainel), AGENTOPS_URL: `http://127.0.0.1:${portaAo}`,
  }, painel);
  const base = `http://127.0.0.1:${portaPainel}`;
  const vivo = await esperar(async () => (await pedir(`${base}/health`)).status === 200);
  passo("painel do bundle sobe (/health 200)", !!vivo, vivo ? "" : pn.log.slice(-400));
  const pronto = await pedir(`${base}/ready`).catch(() => ({ status: 0 }));
  passo("/ready responde", pronto.status === 200 || pronto.status === 503, `HTTP ${pronto.status} ${JSON.stringify(pronto.body)}`);
  passo("/api/v1/overview sem token = 401", (await pedir(`${base}/api/v1/overview`)).status === 401);
  const tokPainel = ler("servidor/painel.token");
  const ov = await pedir(`${base}/api/v1/overview`, tokPainel).catch(e => ({ status: 0, body: { e: e.message } }));
  passo("painel.token restaurado abre /api/v1/overview", ov.status === 200, `HTTP ${ov.status}`);
  const txt = JSON.stringify(ov.body || {});
  passo("resposta não contém os tokens restaurados", !txt.includes(tokPainel) && !txt.includes(admin));
  const ag = await pedir(`${base}/api/v1/agents`, tokPainel).catch(() => ({ status: 0 }));
  passo("painel restaurado enxerga o AgentOps restaurado", ag.status === 200 && JSON.stringify(ag.body).includes("pc-claude"), `HTTP ${ag.status}`);
} catch (e) {
  passo("ensaio interrompido", false, e.message);
} finally {
  filhos.forEach(parar);
  await new Promise(r => setTimeout(r, 500));
  if (process.argv.includes("--manter")) console.log(`mantido (TEM SEGREDOS, apague depois): ${tmp}`);
  else { rmSync(tmp, { recursive: true, force: true }); passo("pasta restaurada apagada (tinha segredos)", !existsSync(tmp)); }
}

const ok = passos.every(p => p.ok);
console.log(`\n${ok ? "RECONSTRUÇÃO OK" : "RECONSTRUÇÃO COM FALHAS"} · ${passos.filter(p => p.ok).length}/${passos.length} passos`);
if (arg("--json", "")) writeFileSync(arg("--json"), JSON.stringify({ quando: new Date().toISOString(), backup: arquivo.replace(ROOT, "."), ok, passos }, null, 2));
process.exitCode = ok ? 0 : 1;
