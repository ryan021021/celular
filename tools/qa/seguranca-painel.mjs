// Teste de segurança caixa-preta do painel (QA). Roda só no PC, contra o server.js REAL de um clone limpo do branch
// pedido (padrão: celular, o que está no A13), em 127.0.0.1, com uma home falsa (token de TESTE gerado aqui) e um
// AgentOps simulado que registra cada chamada. Ação recusada = 403/401 E nenhuma chamada no AgentOps.
//   node tools/qa/seguranca-painel.mjs [--branch celular] [--json <saida.json>]
// Nunca fala com o A13 e não usa token real. Saída 0 = tudo passou.
import { spawn, spawnSync } from "node:child_process";
import { createServer, request } from "node:http";
import { createServer as netServer } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BRANCH = arg("--branch", "celular");
const WIN = process.platform === "win32";
const tmp = mkdtempSync(join(tmpdir(), "qa-seg-painel-"));
const home = join(tmp, "home");
const TOKEN = randomBytes(36).toString("base64url");      // token de teste (48 caracteres)
const ADMIN = randomBytes(36).toString("base64url");      // token do AgentOps simulado
const UUID = "0b7d8a52-6a1e-4f43-9d3e-2f0a8c1b9e77";
// segredos FALSOS para o teste de mascaramento: gerados na hora, para não aparecerem no código (a varredura da regressão os acusaria)
const FALSO_BEARER = randomBytes(24).toString("hex");
const FALSO_SKANT = randomBytes(16).toString("hex").toUpperCase();
const provas = [];
const prova = (grupo, nome, ok, detalhe = "") => { provas.push({ grupo, nome, ok, detalhe }); console.log(`${ok ? "ok  " : "FALHA"} ${grupo} · ${nome}${detalhe ? ` · ${detalhe}` : ""}`); };
const respostas = []; // tudo o que o painel devolveu, para procurar o token no fim

// ---------- ambiente ----------
mkdirSync(join(home, "servidor", "logs"), { recursive: true });
writeFileSync(join(home, "servidor", "painel.token"), `${TOKEN}\n`);
writeFileSync(join(home, "servidor", "agentops.token"), `${ADMIN}\n`);
writeFileSync(join(home, "servidor", "logs", "watchdog.log"), [
  "2026-10-19 07:00 watchdog ok",
  `2026-10-19 07:01 token=${TOKEN}`,
  `2026-10-19 07:02 Authorization: Bearer ${FALSO_BEARER}`,
  `2026-10-19 07:03 chave sk-ant-api03-${FALSO_SKANT}`,
].join("\n") + "\n");

const chamadas = [];
const agentops = createServer((req, res) => {
  let b = ""; req.on("data", c => { b += c; }); req.on("end", () => {
    chamadas.push(`${req.method} ${req.url}`);
    const send = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== `Bearer ${ADMIN}`) return send(401, { ok: false });
    if (req.url === "/health") return send(200, { ok: true });
    if (req.url.startsWith("/api/state")) return send(200, { ok: true, paused: false, counts: {}, agents: {}, workers: {}, profiles: { leitura: {} } });
    if (req.url.startsWith("/api/tasks")) return send(200, { ok: true, tasks: [], task: null });
    send(200, { ok: true });
  });
});
const portaLivre = () => new Promise(ok => { const s = netServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

function http(method, path, { headers = {}, body = null, port } = {}) {
  return new Promise(ok => {
    const r = request({ host: "127.0.0.1", port, method, path, headers: { ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}), ...headers } }, res => {
      let data = "";
      if ((res.headers["content-type"] || "").includes("event-stream")) { res.once("data", c => { data = String(c); r.destroy(); ok({ status: res.statusCode, headers: res.headers, body: data }); }); return; }
      res.on("data", c => { data += c; });
      res.on("end", () => { respostas.push(`${JSON.stringify(res.headers)}\n${data}`); ok({ status: res.statusCode, headers: res.headers, body: data }); });
    });
    r.on("error", e => ok({ status: 0, headers: {}, body: "", erro: e.code || e.message }));
    r.setTimeout(10_000, () => r.destroy(new Error("timeout")));
    if (body) r.write(body);
    r.end();
  });
}

let painel;
const bearer = { Authorization: `Bearer ${TOKEN}` };
try {
  // clone limpo do branch (nunca as worktrees das sessões)
  const clone = join(tmp, "painel");
  const c = spawnSync("git", ["clone", "-q", "--no-hardlinks", "-b", BRANCH, "--single-branch", join(ROOT, "server", "panel", "server-box"), clone], { encoding: "utf8" });
  if (c.status !== 0) throw new Error(`clone: ${c.stderr}`);
  const commit = spawnSync("git", ["-C", clone, "log", "-1", "--format=%h"], { encoding: "utf8" }).stdout.trim();
  const portaAo = await portaLivre();
  await new Promise(ok => agentops.listen(portaAo, "127.0.0.1", ok));
  const P = await portaLivre();
  painel = spawn(process.execPath, [join(clone, "server.js")], {
    cwd: clone, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, USERPROFILE: home, HOME: home, HOST: "127.0.0.1", PORT: String(P), AGENTOPS_URL: `http://127.0.0.1:${portaAo}` },
  });
  let log = ""; painel.stdout.on("data", d => { log += d; }); painel.stderr.on("data", d => { log += d; });
  const g = (m, p, o = {}) => http(m, p, { ...o, port: P });
  for (let i = 0; i < 60 && (await g("GET", "/health")).status !== 200; i++) await new Promise(r => setTimeout(r, 250));
  console.log(`painel ${BRANCH}@${commit} em 127.0.0.1:${P} (AgentOps simulado :${portaAo})`);
  const semChamadaNova = async (fn) => { const antes = chamadas.length; const r = await fn(); return { r, novas: chamadas.slice(antes) }; };

  // A. superfície sem autenticação
  const h = await g("GET", "/health");
  prova("público", "/health 200 e mínimo", h.status === 200 && JSON.stringify(Object.keys(JSON.parse(h.body)).sort()) === '["ok","service"]', h.body);
  const rd = await g("GET", "/ready");
  prova("público", "/ready só {ok}", [200, 503].includes(rd.status) && JSON.stringify(Object.keys(JSON.parse(rd.body))) === '["ok"]', `${rd.status} ${rd.body}`);
  const rotas = ["overview", "ready", "services", "agents", "tasks", `tasks/${UUID}`, "android", "adb", "live", "history?metric=mem&range=1h", "processes", "storage", "network", "logs", "logs/read?source=file:watchdog", "audit"].map(r => `/api/v1/${r}`).concat("/api/monitor", "/api/digest-stats");
  const abertas = [];
  for (const r of rotas) { const x = await g("GET", r); if (x.status !== 401) abertas.push(`${r}=${x.status}`); }
  prova("sem login", `${rotas.length} rotas de API dão 401`, abertas.length === 0, abertas.join(", "));
  const estaticos = ["/", "/console", "/status.html", "/console.js", "/console.css", "/console-lib.js"];
  const vazados = [];
  for (const s of estaticos) { const x = await g("GET", s); if (!(x.status === 303 && x.headers.location === "/login")) vazados.push(`${s}=${x.status}`); }
  prova("sem login", "páginas e scripts redirecionam para /login", vazados.length === 0, vazados.join(", "));

  // B. credenciais erradas ou no lugar errado
  prova("credencial", "Bearer errado = 401", (await g("GET", "/api/v1/overview", { headers: { Authorization: `Bearer ${"x".repeat(48)}` } })).status === 401);
  prova("credencial", "token na query string não autentica", (await g("GET", `/api/v1/overview?token=${TOKEN}`)).status === 401);
  prova("credencial", "token cru no cookie não autentica", (await g("GET", "/api/v1/overview", { headers: { Cookie: `sb_sessao=${TOKEN}` } })).status === 401);
  prova("credencial", "Bearer certo = 200", (await g("GET", "/api/v1/overview", { headers: bearer })).status === 200);

  // C. login e cookie
  const form = t => `token=${encodeURIComponent(t)}`;
  const lf = await g("POST", "/login", { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form("errado-errado-errado-errado") });
  prova("login", "token errado = 401 sem cookie", lf.status === 401 && !lf.headers["set-cookie"]);
  const lo = await g("POST", "/login", { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(TOKEN) });
  const ck = String(lo.headers["set-cookie"] || "");
  prova("login", "token certo = 303 + cookie HttpOnly; SameSite=Strict; Path=/", lo.status === 303 && /HttpOnly/.test(ck) && /SameSite=Strict/.test(ck) && /Path=\//.test(ck), ck.replace(/=[^;]+;/, "=<valor>;").slice(0, 120));
  const cookie = ck.split(";")[0];
  prova("login", "cookie não contém o token", !cookie.includes(TOKEN));
  prova("login", "cookie abre a API", (await g("GET", "/api/v1/overview", { headers: { Cookie: cookie } })).status === 200);
  const grande = await g("POST", "/login", { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "token=" + "a".repeat(5000) });
  prova("login", "corpo de 5 KB recusado (413 ou conexão cortada)", grande.status === 413 || grande.status === 0, `${grande.status || grande.erro}`);

  // D. CSRF e regras das ações (AgentOps simulado prova se a ação passou)
  const acao = "/api/v1/agents/pause";
  let t = await semChamadaNova(() => g("POST", acao, { headers: bearer }));
  prova("ações", "sem X-Painel-Acao = 403 e nada chega ao AgentOps", t.r.status === 403 && t.novas.length === 0, `${t.r.status} ${t.novas}`);
  t = await semChamadaNova(() => g("POST", acao, { headers: { ...bearer, "X-Painel-Acao": "1", Origin: "http://evil.example" } }));
  prova("ações", "Origin de outro site = 403 e nada chega", t.r.status === 403 && t.novas.length === 0, `${t.r.status}`);
  t = await semChamadaNova(() => g("POST", acao, { headers: { ...bearer, "X-Painel-Acao": "1", Origin: "null" } }));
  prova("ações", "Origin null = 403 e nada chega", t.r.status === 403 && t.novas.length === 0, `${t.r.status}`);
  t = await semChamadaNova(() => g("POST", acao, { headers: { Cookie: cookie } }));
  prova("ações", "cookie sem X-Painel-Acao = 403 e nada chega", t.r.status === 403 && t.novas.length === 0, `${t.r.status}`);
  t = await semChamadaNova(() => g("POST", acao, { headers: { "X-Painel-Acao": "1" } }));
  prova("ações", "sem login = 401 e nada chega", t.r.status === 401 && t.novas.length === 0, `${t.r.status}`);
  t = await semChamadaNova(() => g("GET", acao, { headers: bearer }));
  prova("ações", "GET na rota de ação não executa", t.r.status !== 200 && !t.novas.some(n => n.includes("/api/pause")), `${t.r.status}`);
  t = await semChamadaNova(() => g("POST", acao, { headers: { ...bearer, "X-Painel-Acao": "1", Origin: `http://127.0.0.1:${P}`, Host: `127.0.0.1:${P}` } }));
  prova("ações", "mesma origem + cabeçalho = executa (1 chamada)", t.r.status === 200 && t.novas.length === 1 && t.novas[0] === "POST /api/pause", `${t.r.status} ${t.novas}`);

  // E. ids e corpos
  t = await semChamadaNova(() => g("POST", "/api/v1/tasks/..%2f..%2fapi%2fpause/cancel", { headers: { ...bearer, "X-Painel-Acao": "1" } }));
  prova("entrada", "id de tarefa com ../ codificado é recusado e nada chega", [400, 404].includes(t.r.status) && t.novas.length === 0, `${t.r.status} ${t.novas}`);
  t = await semChamadaNova(() => g("GET", "/api/v1/tasks/..%2f..%2fapi%2fstate", { headers: bearer }));
  prova("entrada", "GET de tarefa com ../ não alcança outra rota do AgentOps", !t.novas.some(n => /^GET \/api\/state/.test(n)), `${t.r.status} ${t.novas}`);
  t = await semChamadaNova(() => g("POST", "/api/v1/tasks", { headers: { ...bearer, "X-Painel-Acao": "1", "Content-Type": "application/json" }, body: JSON.stringify({ profile: "leitura", prompt: "a".repeat(20_000) }) }));
  prova("entrada", "corpo de 20 KB na criação de tarefa recusado e nada chega", (t.r.status === 413 || t.r.status === 0) && t.novas.length === 0, `${t.r.status || t.r.erro}`);
  t = await semChamadaNova(() => g("POST", "/api/v1/tasks", { headers: { ...bearer, "X-Painel-Acao": "1", "Content-Type": "application/json" }, body: "{nao-e-json" }));
  prova("entrada", "JSON inválido = 400 (não 500) e nada chega", t.r.status === 400 && t.novas.length === 0, `${t.r.status}`);

  // F. logs: travessia e segredos
  const fontes = ["file:../../servidor/painel.token", "file:__proto__", "file:constructor", "file:watchdog/../../painel.token", "sv:../../servidor", "../../servidor/painel.token", "/etc/passwd", "C:/Windows/win.ini"];
  const aceitas = [];
  for (const f of fontes) { const x = await g("GET", `/api/v1/logs/read?source=${encodeURIComponent(f)}`, { headers: bearer }); if (x.status === 200 || x.body.includes(TOKEN)) aceitas.push(`${f}=${x.status}`); }
  prova("logs", `${fontes.length} fontes forjadas recusadas`, aceitas.length === 0, aceitas.join(", "));
  const lg = await g("GET", "/api/v1/logs/read?source=file:watchdog", { headers: bearer });
  prova("logs", "fonte válida lê (200)", lg.status === 200, `${lg.status}`);
  prova("logs", "token do painel mascarado no log", lg.status === 200 && !lg.body.includes(TOKEN));
  prova("logs", "Bearer e sk-ant mascarados no log", lg.status === 200 && !lg.body.includes(FALSO_BEARER) && !lg.body.includes(FALSO_SKANT));

  // G. arquivos estáticos: travessia (logado)
  const trav = ["/..%2fserver.js", "/%2e%2e/server.js", "/..%5cserver.js", "/%2e%2e%2fpackage.json", "//server.js", "/console/../../server.js", "/.%2e/server.js"];
  const sairam = [];
  for (const s of trav) { const x = await g("GET", s, { headers: bearer }); if (/startServer|"name": "server-box"/.test(x.body)) sairam.push(`${s}=${x.status}`); }
  prova("estáticos", `${trav.length} tentativas de sair de public/ falham`, sairam.length === 0, sairam.join(", "));

  // H. cabeçalhos
  const ch = await g("GET", "/console", { headers: bearer });
  const csp = String(ch.headers["content-security-policy"] || "");
  const scriptSrc = (csp.match(/script-src ([^;]+)/) || [])[1] || "";
  prova("cabeçalhos", "console com CSP sem script inline", ch.status === 200 && scriptSrc.includes("'self'") && !scriptSrc.includes("unsafe"), scriptSrc);
  prova("cabeçalhos", "console: X-Frame-Options DENY e nosniff", ch.headers["x-frame-options"] === "DENY" && ch.headers["x-content-type-options"] === "nosniff");
  const jj = await g("GET", "/api/v1/overview", { headers: bearer });
  prova("cabeçalhos", "JSON: nosniff e no-store", jj.headers["x-content-type-options"] === "nosniff" && /no-store/.test(jj.headers["cache-control"] || ""));
  const ri = await g("GET", "/health", { headers: { "X-Request-Id": "<script>alert(1)</script>" } });
  prova("cabeçalhos", "X-Request-Id malicioso não é refletido", !String(ri.headers["x-request-id"]).includes("<"), String(ri.headers["x-request-id"]));

  // I. ao vivo
  prova("ao vivo", "/api/v1/live sem login = 401", (await g("GET", "/api/v1/live")).status === 401);
  const lv = await g("GET", "/api/v1/live", { headers: bearer });
  prova("ao vivo", "/api/v1/live logado abre o stream", lv.status === 200 && /event-stream/.test(lv.headers["content-type"] || ""), `${lv.status} ${lv.headers["content-type"]}`);

  // J. sair de todos
  const sessaoAntes = readFileSync(join(home, "servidor", "painel.session"), "utf8");
  const rv = await g("POST", "/api/v1/session/revoke-all", { headers: { ...bearer, "X-Painel-Acao": "1" } });
  prova("sessão", "revoke-all = 200 e troca o salt", rv.status === 200 && readFileSync(join(home, "servidor", "painel.session"), "utf8") !== sessaoAntes, `${rv.status}`);
  prova("sessão", "cookie antigo deixa de valer", (await g("GET", "/api/v1/overview", { headers: { Cookie: cookie } })).status === 401);
  prova("sessão", "Bearer continua valendo (scripts e vigia)", (await g("GET", "/api/v1/overview", { headers: bearer })).status === 200);

  // K. limite de ações (30/min por IP; 2 ações já gastas acima)
  let c429 = 0; const antes = chamadas.length;
  for (let i = 0; i < 32; i++) { const x = await g("POST", "/api/v1/agents/resume", { headers: { ...bearer, "X-Painel-Acao": "1" } }); if (x.status === 429) c429++; }
  const passaram = chamadas.slice(antes).filter(n => n === "POST /api/resume").length;
  prova("limite", "mais de 30 ações por minuto dão 429", c429 > 0 && passaram <= 30, `${passaram} passaram, ${c429} com 429`);

  // L. força bruta no login (por último: bloqueia o 127.0.0.1 desta instância por 10 min)
  for (let i = 0; i < 10; i++) await g("POST", "/login", { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(`errado-${i}-xxxxxxxxxxxxxxxxxxxx`) });
  const bloq = await g("POST", "/login", { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(TOKEN) });
  prova("força bruta", "depois de 10 erros, até o token certo dá 429", bloq.status === 429 && !bloq.headers["set-cookie"], `${bloq.status}`);

  // M. o token nunca sai em resposta nenhuma
  const comToken = respostas.filter(r => r.includes(TOKEN));
  prova("segredos", `token ausente de ${respostas.length} respostas`, comToken.length === 0, comToken.length ? comToken[0].slice(0, 120) : "");
  if (provas.some(p => !p.ok)) console.log(`--- log do painel ---\n${log.slice(-1500)}`);
} catch (e) {
  prova("execução", "harness", false, e.message);
} finally {
  if (painel && painel.exitCode === null) { if (WIN) spawnSync("taskkill", ["/pid", String(painel.pid), "/T", "/F"], { windowsHide: true }); else painel.kill("SIGKILL"); }
  agentops.close();
  await new Promise(r => setTimeout(r, 300));
  rmSync(tmp, { recursive: true, force: true });
}

const ok = provas.every(p => p.ok);
console.log(`\n${ok ? "SEGURANÇA DO PAINEL OK" : "SEGURANÇA DO PAINEL COM FALHAS"} · ${provas.filter(p => p.ok).length}/${provas.length} provas · branch ${BRANCH}`);
if (arg("--json", "")) writeFileSync(arg("--json"), JSON.stringify({ quando: new Date().toISOString(), branch: BRANCH, ok, provas }, null, 2));
process.exitCode = ok ? 0 : 1;
