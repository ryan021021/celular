// Suíte de regressão do projeto celular (QA, T20). Roda no PC, não fala com o A13 e não altera nada do projeto.
//   node tools/qa/regressao.mjs                      -> tudo; saída 0 = verde, 1 = algo falhou
//   node tools/qa/regressao.mjs --json <arquivo>     -> também grava o resultado em JSON
//   node tools/qa/regressao.mjs --relatorio          -> também grava docs/qa/regressao-<data>.md
//   node tools/qa/regressao.mjs --paineis celular,claude/painel-v2   (padrão: celular, o que roda no A13)
//   node tools/qa/regressao.mjs --limite 180         (segundos por suíte; passou disso = "travou" e falha)
// Etapas:
//   1. sintaxe: node --check (.mjs/.js/.cjs), bash -n (.sh), parser do PowerShell (.ps1), de tudo que o git rastreia
//   2. suítes do repositório raiz: cada pasta com *.test.mjs, uma por vez, com tempo limite
//   3. painel: clone limpo do branch pedido (nunca as worktrees das sessões) e node --test test/*.test.mjs
//   4. segredos: chave privada, sk-ant-, token de GitHub, tópico do ntfy, Bearer longo (mostra só arquivo:linha)
//   5. regra do projeto (CLAUDE.md): scripts sem caminho da Desktop nem serial fixo de aparelho
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { DESKTOP } from "./regras.mjs";
import { varrerArquivos } from "./alegacoes.mjs";
import { validarPerfis } from "./perfis.mjs";
import { resumoNodeTest, veredito } from "./veredito.mjs";
import { validarAgentes } from "./agentes.mjs";
import { comShDoGit } from "./sh-do-git.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAINEL = join(ROOT, "server", "panel", "server-box");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIMITE = Number(arg("--limite", "180")) * 1000;
const PAINEIS = arg("--paineis", "celular").split(",").map(s => s.trim()).filter(Boolean);
const WIN = process.platform === "win32";
// rodando do PowerShell não há `sh` no PATH: as suítes de shell recebem o sh do Git
const ENV = comShDoGit(process.env);

const etapas = [];
const registrar = (grupo, nome, ok, detalhe = {}) => { etapas.push({ grupo, nome, ok, ...detalhe }); console.log(`${ok ? "ok  " : "FALHA"} ${grupo} · ${nome}${detalhe.resumo ? ` · ${detalhe.resumo}` : ""}`); };

function git(args, cwd = ROOT) {
  const p = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (p.status !== 0) throw new Error(`git ${args.join(" ")}: ${p.stderr}`);
  return p.stdout;
}

/** Roda um comando com tempo limite; no Windows mata a árvore inteira (o node --test abre um processo por arquivo). */
function rodar(cmd, args, { cwd, limite = LIMITE, env } = {}) {
  return new Promise(ok => {
    const t0 = Date.now();
    const child = spawn(cmd, args, { cwd, env: env || ENV, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", c => { out += c; });
    child.stderr.on("data", c => { out += c; });
    let travou = false;
    const timer = setTimeout(() => {
      travou = true;
      if (WIN) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      else child.kill("SIGKILL");
    }, limite);
    child.on("error", e => { clearTimeout(timer); ok({ code: -1, out: `${out}\n${e.message}`, travou, ms: Date.now() - t0 }); });
    child.on("close", code => { clearTimeout(timer); ok({ code, out, travou, ms: Date.now() - t0 }); });
  });
}

async function suite(grupo, nome, cwd, arquivos) {
  const r = await rodar(process.execPath, ["--test", ...arquivos], { cwd });
  let s;
  try { s = resumoNodeTest(r.out); } catch (e) {
    registrar(grupo, nome, false, { resumo: `${e.message} · código de saída ${r.code}`, travou: r.travou, ms: r.ms, saida: r.out.slice(-3000) });
    return;
  }
  const { ok, motivo } = veredito(r, s, grupo === "painel" ? "painel" : nome);
  const resumo = r.travou ? `TRAVOU (> ${LIMITE / 1000} s)` : `${s.passou}/${s.testes} ok${s.pulados ? `, ${s.pulados} pulado(s)` : ""}${s.falhou ? `, ${s.falhou} falha(s)` : ""} em ${(r.ms / 1000).toFixed(1)} s`;
  registrar(grupo, nome, ok, { resumo: ok ? resumo : `${resumo}${motivo ? ` · ${motivo}` : ""}`, ...s, travou: r.travou, ms: r.ms, saida: ok ? undefined : r.out.slice(-3000) });
}

const rastreados = git(["ls-files"]).split("\n").filter(Boolean);
const ext = f => extname(f).toLowerCase();

// 1. sintaxe
{
  const js = rastreados.filter(f => [".mjs", ".js", ".cjs"].includes(ext(f)));
  const ruins = js.filter(f => spawnSync(process.execPath, ["--check", f], { cwd: ROOT, windowsHide: true }).status !== 0);
  registrar("sintaxe", "node --check", ruins.length === 0, { resumo: `${js.length - ruins.length}/${js.length} arquivos`, ruins });

  const sh = rastreados.filter(f => ext(f) === ".sh" || /git-hooks\/[^.]+$|\/sv\/[^/]+\/(run|log\/run)$/.test(f));
  const shRuins = sh.filter(f => spawnSync("bash", ["-n", f], { cwd: ROOT, env: ENV, windowsHide: true }).status !== 0);
  registrar("sintaxe", "bash -n", shRuins.length === 0, { resumo: `${sh.length - shRuins.length}/${sh.length} arquivos`, ruins: shRuins });

  const ps = rastreados.filter(f => ext(f) === ".ps1");
  if (WIN && ps.length) {
    const lista = ps.map(f => `'${join(ROOT, f).replace(/'/g, "''")}'`).join(",");
    const cmd = `$r=@(); foreach($f in @(${lista})){ $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($f,[ref]$null,[ref]$e); if($e.Count){ $r+=($f+': '+$e[0].Message+' (linha '+$e[0].Extent.StartLineNumber+')') } }; $r -join [char]10`;
    const p = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { encoding: "utf8", windowsHide: true });
    const psRuins = String(p.stdout || "").split("\n").map(s => s.trim()).filter(Boolean).map(s => relative(ROOT, s.split(": ")[0]) + ": " + s.split(": ").slice(1).join(": "));
    registrar("sintaxe", "PowerShell (parser)", p.status === 0 && psRuins.length === 0, { resumo: `${ps.length - psRuins.length}/${ps.length} arquivos`, ruins: psRuins });
  }
}

// 2. suítes do repositório raiz (uma pasta = uma suíte; tempo limite por suíte)
{
  const testes = rastreados.filter(f => f.endsWith(".test.mjs"));
  const porPasta = {};
  for (const f of testes) (porPasta[dirname(f)] ||= []).push(f);
  for (const [pasta, arquivos] of Object.entries(porPasta).sort()) await suite("suítes", pasta, ROOT, arquivos);
}

// 3. painel: clone limpo de cada branch pedido (o hook do A13 roda exatamente test/*.test.mjs)
for (const branch of PAINEIS) {
  if (!existsSync(join(PAINEL, ".git"))) { registrar("painel", branch, false, { resumo: "server/panel/server-box não é um repositório git" }); continue; }
  const tmp = mkdtempSync(join(tmpdir(), "qa-painel-"));
  try {
    git(["clone", "--quiet", "--no-hardlinks", "--branch", branch, "--single-branch", PAINEL, tmp]);
    const commit = git(["log", "-1", "--format=%h %s"], tmp).trim();
    const arquivos = readdirSync(join(tmp, "test")).filter(f => f.endsWith(".test.mjs")).map(f => join("test", f));
    await suite("painel", `${branch} @ ${commit.slice(0, 60)}`, tmp, arquivos);
    // segredos também no painel (vai para o A13 e tem remote do autor)
    etapas.at(-1).commit = commit;
    varrerSegredos(`painel ${branch}`, git(["ls-files"], tmp).split("\n").filter(Boolean), tmp);
  } catch (e) {
    registrar("painel", branch, false, { resumo: e.message.slice(0, 300) });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// 4. segredos
function varrerSegredos(grupo, arquivos, base) {
  const padroes = [
    ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ["chave da Anthropic", /sk-ant-[A-Za-z0-9_-]{40,}/], // chave real tem ~100 caracteres; testes usam falsas curtas
    ["token do GitHub", /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
    ["tópico do ntfy", /ntfy\.sh\/(?!<|\$|\{|example|seu|topico)[A-Za-z0-9_-]{12,}/],
    ["Bearer longo", /Bearer [A-Za-z0-9._-]{32,}/],
    ["token em JSON", /"(token|adminToken|secret|password)"\s*:\s*"[A-Za-z0-9+/=_-]{24,}"/],
  ];
  const achados = [];
  for (const f of arquivos) {
    if (/\.(apk|png|jpe?g|gif|zip|gz|enc|exe|bin|bundle)$/i.test(f)) continue;
    let txt;
    try { txt = readFileSync(join(base, f), "utf8"); } catch { continue; }
    txt.split("\n").forEach((linha, i) => {
      for (const [nome, re] of padroes) if (re.test(linha)) achados.push(`${f}:${i + 1} (${nome})`);
    });
  }
  registrar("segredos", grupo, achados.length === 0, { resumo: `${arquivos.length} arquivos, ${achados.length} suspeito(s)`, achados });
}
varrerSegredos("repositório raiz", rastreados, ROOT);

// 5. regra do CLAUDE.md: scripts sem caminho da Desktop nem serial fixo (expressão e casos em tools/qa/regras.mjs)
{
  // testes ficam de fora: usam caminhos de exemplo de propósito (ex.: C:/Users/x/Desktop para provar o bloqueio)
  const scripts = rastreados.filter(f => [".ps1", ".bat", ".cmd", ".sh", ".mjs", ".js", ".cjs", ".py"].includes(ext(f)) && !f.startsWith("tools/qa/") && !f.endsWith(".test.mjs"));
  // seriais vêm dos perfis (o único lugar onde podem ficar)
  const seriais = [...new Set(rastreados.filter(f => /^profiles\/.+\.json$/.test(f)).flatMap(f => {
    try { const s = JSON.parse(readFileSync(join(ROOT, f), "utf8")).serial; return s ? [String(s)] : []; } catch { return []; }
  }))];
  const achados = [];
  for (const f of scripts) {
    const txt = readFileSync(join(ROOT, f), "utf8");
    txt.split("\n").forEach((l, i) => {
      if (DESKTOP.test(l) && !/^\s*(\/\/|#|::|rem )/i.test(l)) achados.push(`${f}:${i + 1} (caminho da Desktop)`);
      for (const s of seriais) if (l.includes(s)) achados.push(`${f}:${i + 1} (serial ${s})`);
    });
  }
  registrar("regras", "sem caminho da Desktop nem serial fixo", achados.length === 0, { resumo: `${scripts.length} scripts, ${achados.length} ocorrência(s)`, achados });
}

// 6. alegações sem evidência (P0 R5 / T68): varredura em docs/ e UI (aviso, não quebra a suíte)
{
  const docsEUI = rastreados.filter(f => {
    const e = ext(f);
    return (f.startsWith("docs/") && e === ".md") || f === "README.md" || (f.includes("public/") && (e === ".html" || e === ".js"));
  });
  const achados = varrerArquivos(docsEUI, ROOT).map(a => `${a.arquivo}:${a.linha} (${a.padrao})`);
  registrar("alegações", "varredura de evidências (P0 R5)", true, { resumo: `${achados.length} aviso(s)`, achados });
}

// 7. perfis: profiles/*.json contra profiles/schema.json (T70, P1 R7)
{
  const perfis = validarPerfis();
  const achados = perfis.flatMap(p => p.erros.map(e => `${p.arquivo}: ${e}`));
  registrar("perfis", "profiles/*.json contra schema.json", achados.length === 0, { resumo: `${perfis.length} perfil(is), ${achados.length} erro(s)`, achados });
}

// 8. agentes: .claude/agents/*.md contra docs/AGENTES.md (T90)
{
  const agentes = validarAgentes();
  const achados = agentes.flatMap(a => a.erros.map(e => `${a.arquivo}: ${e}`));
  registrar("agentes", ".claude/agents/*.md contra docs/AGENTES.md", achados.length === 0, { resumo: `${agentes.length} item(ns), ${achados.length} erro(s)`, achados });
}

// resumo
const falhas = etapas.filter(e => !e.ok);
const quando = new Date();
const resultado = { quando: quando.toISOString(), commitRaiz: git(["log", "-1", "--format=%h"]).trim(), sujo: git(["status", "--porcelain"]).trim().split("\n").filter(Boolean).length, verde: falhas.length === 0, etapas };
console.log(`\n${resultado.verde ? "VERDE" : `VERMELHO: ${falhas.length} etapa(s) com falha`} · raiz ${resultado.commitRaiz}${resultado.sujo ? ` (+${resultado.sujo} arquivo(s) sem commit)` : ""}`);
for (const f of falhas) {
  for (const k of ["ruins", "achados", "falhas"]) if (f[k]?.length) console.log(`  ${f.grupo} · ${f.nome}: ${f[k].slice(0, 10).join(" | ")}`);
}
if (arg("--json", "")) writeFileSync(arg("--json"), JSON.stringify(resultado, null, 2));
if (process.argv.includes("--relatorio")) {
  const p = n => String(n).padStart(2, "0");
  const nome = `regressao-${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}-${p(quando.getHours())}${p(quando.getMinutes())}.md`;
  const linhas = [
    `# Regressão ${quando.toLocaleString("pt-BR")}`, "",
    `Gerado por \`node tools/qa/regressao.mjs --relatorio\` no PC. Raiz em \`${resultado.commitRaiz}\`${resultado.sujo ? ` com ${resultado.sujo} arquivo(s) sem commit (de outras sessões ou desta)` : ""}. **${resultado.verde ? "VERDE" : "VERMELHO"}**.`,
    "Não cobre: nada roda no A13 (o hook de deploy roda as suítes do painel lá); testes de navegador; teste de carga.", "",
    "| Grupo | Etapa | Resultado | Detalhe |", "|---|---|---|---|",
    ...etapas.map(e => `| ${e.grupo} | ${e.nome.replace(/\|/g, "/")} | ${e.ok ? "ok" : "**FALHA**"} | ${(e.resumo || "").replace(/\|/g, "/")}${!e.ok ? ` · ${[...(e.ruins || []), ...(e.achados || []), ...(e.falhas || [])].slice(0, 8).join("; ").replace(/\|/g, "/")}` : ""} |`),
  ];
  writeFileSync(join(ROOT, "docs", "qa", nome), linhas.join("\n") + "\n");
  console.log(`relatório: docs/qa/${nome}`);
}
process.exitCode = resultado.verde ? 0 : 1;
