// Diagnóstico do servidor (T69, OMNISERVER §20.3). Só leitura: não mexe no aparelho.
//   node tools/diag/diag.mjs [--perfil a15] [--json]
// Lê /health, /ready e /api/v1/capabilities do painel, e por SSH os serviços (runit), o disco,
// a bateria (só termux-battery-status; sem ele, N/D com motivo) e o último backup. Cada item traz valor,
// unidade (disco em MB, bateria em %), fonte e estado (ok | aviso | falha | unknown).
// Nada sai sem fonte. Código de saída: 0 ok · 1 aviso (inclui o que não deu para medir) · 2 falha.
// Endpoints que ainda não existem (ready, capabilities da T62) ficam unknown e não mudam o código.
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { resolverPerfil, descreverAchado } from "../lib/achar-aparelho.mjs";

const ESTADOS = ["ok", "aviso", "falha", "unknown"];
const LIMITE_DISCO_MB = { aviso: 1024, falha: 256 };
const LIMITE_BATERIA = 20;
const IDADE_MAX_BACKUP_H = 48;

// Roda no aparelho com `sh -s`, pelo stdin (sem quoting no ssh). Só comandos de leitura.
export const SCRIPT_DIAG = `
export SVDIR="$PREFIX/var/service"
for s in $(ls "$PREFIX/var/service" 2>/dev/null); do echo "SERVICO $s $(sv status "$s" 2>&1 | head -n 1)"; done
df -Pk "$HOME" 2>/dev/null | tail -n 1 | awk '{print "DISCO " $4}'
if command -v termux-battery-status >/dev/null 2>&1; then
  B=$(termux-battery-status 2>/dev/null | tr -d '\\n')
  if [ -n "$B" ]; then echo "BATERIA_TERMUX $B"; else echo "BATERIA_TERMUX_ERRO"; fi
else
  echo "BATERIA_TERMUX_AUSENTE"
fi
echo "BACKUP $(cat "$HOME/servidor/backup-ultimo.json" 2>/dev/null)"
`;

const item = (id, valor, estado, fonte, motivo = null, obrigatorio = false, unidade = null) => ({ id, valor, estado, fonte, motivo, obrigatorio, unidade });
const naoMedido = (id, fonte, motivo, obrigatorio = false) => item(id, null, "unknown", fonte, motivo, obrigatorio);

/** Lê o JSON do termux-battery-status. Sem campo percentage numérico, não há valor: vira motivo. */
function lerBateriaTermux(json) {
  try {
    const p = Number(JSON.parse(json).percentage);
    return Number.isFinite(p) ? { valor: p, motivo: null } : { valor: null, motivo: "termux-battery-status sem campo percentage" };
  } catch {
    return { valor: null, motivo: "termux-battery-status devolveu saída ilegível" };
  }
}

/** Interpreta a saída do SCRIPT_DIAG. Função pura: testável sem aparelho. */
export function interpretarSaidaSsh(saida) {
  const r = { servicos: [], disco: null, bateria: null, bateriaMotivo: "sem leitura de bateria no aparelho", backup: null };
  for (const l of String(saida || "").split("\n")) {
    let m;
    if ((m = l.match(/^SERVICO (\S+) ?(.*)$/))) r.servicos.push({ nome: m[1], status: m[2].trim() });
    else if ((m = l.match(/^DISCO (\d+)$/))) r.disco = Number(m[1]) / 1024;
    else if (l.startsWith("BATERIA_TERMUX ")) { const b = lerBateriaTermux(l.slice(15)); r.bateria = b.valor; r.bateriaMotivo = b.motivo; }
    else if (l === "BATERIA_TERMUX_AUSENTE") r.bateriaMotivo = "termux-battery-status não existe no aparelho (precisa do pacote termux-api e do app Termux:API)";
    else if (l === "BATERIA_TERMUX_ERRO") r.bateriaMotivo = "termux-battery-status existe mas não devolveu leitura";
    else if (l.startsWith("BACKUP ")) r.backup = l.slice(7).trim() || null;
  }
  return r;
}

/** Disco em MB com a unidade para humanos: GB a partir de 1 GB. Só formata; o valor do JSON continua em MB. */
export function formatarMB(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} GB (${mb} MB)` : `${mb} MB`;
}

function itensSsh(saida, erro, agora) {
  const fonteSsh = "SSH no aparelho (sh -s): sv status, df -Pk, termux-battery-status, backup-ultimo.json";
  const fonteBat = "termux-battery-status (Termux:API) no aparelho";
  if (erro) {
    return [
      naoMedido("servicos", fonteSsh, `não medido: ${erro}`, true),
      naoMedido("disco", fonteSsh, `não medido: ${erro}`, true),
      naoMedido("bateria", fonteSsh, `não medido: ${erro}`),
      naoMedido("backup", fonteSsh, `não medido: ${erro}`, true),
    ];
  }
  const d = interpretarSaidaSsh(saida);
  const out = [];

  // serviços: tudo "run:" é ok; qualquer outro estado ou ausência de lista é aviso
  if (d.servicos.length === 0) out.push(naoMedido("servicos", fonteSsh, "nenhum serviço listado em $PREFIX/var/service", true));
  else {
    const fora = d.servicos.filter(s => !s.status.startsWith("run:"));
    const lista = d.servicos.map(s => `${s.nome}=${s.status.startsWith("run:") ? "run" : (s.status.split(":")[0] || "?")}`).join(", ");
    if (fora.length === 0) out.push(item("servicos", lista, "ok", fonteSsh));
    else out.push(item("servicos", lista, "aviso", fonteSsh, `fora de run: ${fora.map(s => s.nome).join(", ")}`, true));
  }

  // disco: em MB livres
  if (d.disco === null) out.push(naoMedido("disco", fonteSsh, "df não devolveu espaço livre", true));
  else {
    const mb = Math.round(d.disco);
    const estado = mb < LIMITE_DISCO_MB.falha ? "falha" : mb < LIMITE_DISCO_MB.aviso ? "aviso" : "ok";
    out.push(item("disco", mb, estado, fonteSsh, estado === "ok" ? null : `espaço livre abaixo de ${LIMITE_DISCO_MB[estado]} MB`, true, "MB"));
  }

  // bateria: em % vinda só do termux-battery-status; sem ele é não medida (não é aviso)
  if (d.bateria === null) out.push(naoMedido("bateria", fonteBat, `não medida: ${d.bateriaMotivo}`));
  else out.push(item("bateria", d.bateria, d.bateria < LIMITE_BATERIA ? "aviso" : "ok", fonteBat, d.bateria < LIMITE_BATERIA ? `abaixo de ${LIMITE_BATERIA}%` : null, false, "%"));

  // último backup: idade pelo marcador que o tools/server/backup.sh grava
  if (!d.backup) out.push(item("backup", null, "aviso", fonteSsh, "nenhum backup registrado (backup-ultimo.json ausente)", true));
  else {
    let info = null;
    try { info = JSON.parse(d.backup); } catch {}
    if (!info || typeof info.at !== "number") out.push(item("backup", null, "aviso", fonteSsh, "backup-ultimo.json ilegível", true));
    else {
      const horas = (agora() - info.at) / 3_600_000;
      const estado = horas > IDADE_MAX_BACKUP_H ? "aviso" : "ok";
      out.push(item("backup", { arquivo: info.file, horas: Math.round(horas) }, estado, fonteSsh,
        estado === "ok" ? null : `último backup com ${Math.round(horas)} h (limite ${IDADE_MAX_BACKUP_H} h)`, true));
    }
  }
  return out;
}

async function itensHttp(base, fetchFn) {
  const consulta = async (caminho) => {
    try {
      const res = await fetchFn(base + caminho, { signal: AbortSignal.timeout(4000) });
      return { status: res.status };
    } catch (e) {
      return { erro: e.name === "TimeoutError" ? "tempo esgotado" : "sem resposta" };
    }
  };
  const out = [];

  const h = await consulta("/health");
  const fonteH = `HTTP GET ${base}/health`;
  if (h.erro) out.push(item("health", null, "falha", fonteH, `painel ${h.erro}`, true));
  else out.push(item("health", h.status, h.status === 200 ? "ok" : "falha", fonteH, h.status === 200 ? null : `HTTP ${h.status}`, true));

  const r = await consulta("/ready");
  const fonteR = `HTTP GET ${base}/ready`;
  if (r.erro) out.push(naoMedido("ready", fonteR, `não medido: ${r.erro}`));
  else if (r.status === 404) out.push(naoMedido("ready", fonteR, "endpoint ausente (T62 ainda não entregue)"));
  else out.push(item("ready", r.status, r.status === 200 ? "ok" : r.status === 503 ? "falha" : "aviso", fonteR, r.status === 200 ? null : `HTTP ${r.status}`));

  const c = await consulta("/api/v1/capabilities");
  const fonteC = `HTTP GET ${base}/api/v1/capabilities (sem token)`;
  if (c.erro) out.push(naoMedido("capabilities", fonteC, `não medido: ${c.erro}`));
  else if (c.status === 404) out.push(naoMedido("capabilities", fonteC, "endpoint ausente (T62 ainda não entregue)"));
  else if (c.status === 401) out.push(naoMedido("capabilities", fonteC, "precisa de token: leitura com token ainda não feita"));
  else out.push(item("capabilities", c.status, c.status === 200 ? "ok" : "aviso", fonteC, c.status === 200 ? null : `HTTP ${c.status}`));
  return out;
}

/** Junta tudo e calcula o código. Função pura para os testes: recebe fetchFn, sshFn e relógio. */
export async function diagnosticar({ perfil = null, fetchFn = fetch, sshFn = executarSsh, agora = Date.now } = {}) {
  const host = perfil?.network?.ip || "127.0.0.1";
  const base = `http://${host}:8080`;
  const itens = await itensHttp(base, fetchFn);
  if (!perfil) {
    const motivo = "sem --perfil: sem SSH não há como medir serviços, disco ou backup";
    itens.push(naoMedido("servicos", "SSH no aparelho", motivo, true), naoMedido("disco", "SSH no aparelho", motivo, true),
      naoMedido("bateria", "SSH no aparelho", motivo), naoMedido("backup", "SSH no aparelho", motivo, true));
  } else {
    const r = await sshFn(perfil);
    itens.push(...itensSsh(r.ok ? r.saida : "", r.ok ? null : r.erro, agora));
  }
  const codigo = itens.some(i => i.estado === "falha") ? 2
    : itens.some(i => i.estado === "aviso" || (i.estado === "unknown" && i.obrigatorio)) ? 1 : 0;
  return { alvo: perfil?.id || "local", gerado_em: new Date(agora()).toISOString(), codigo, itens };
}

/** Executa um comando SSH de leitura (BatchMode: nunca pede senha). */
export function executarSsh(perfil, { timeoutMs = 20000 } = {}) {
  return new Promise(resolver => {
    const n = perfil.network || {};
    if (!n.ip || !n.ssh_user) return resolver({ ok: false, erro: "perfil sem network.ip / ssh_user" });
    const chave = String(n.ssh_key || "").replace(/^~/, os.homedir());
    const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new",
      "-i", chave, "-p", String(n.ssh_port || 8022), `${n.ssh_user}@${n.ip}`, "sh -s"];
    const p = spawn("ssh", args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "";
    const t = setTimeout(() => { p.kill(); resolver({ ok: false, erro: "tempo esgotado no SSH" }); }, timeoutMs);
    p.stdout.on("data", c => { if (out.length < 65536) out += c; });
    p.on("error", () => { clearTimeout(t); resolver({ ok: false, erro: "ssh não encontrado" }); });
    p.on("close", code => { clearTimeout(t); resolver(code === 0 ? { ok: true, saida: out } : { ok: false, erro: `ssh saiu com código ${code}` }); });
    p.stdin.end(SCRIPT_DIAG);
  });
}

const ROTULO = { ok: "OK", aviso: "AVISO", falha: "FALHA", unknown: "N/D" }; // N/D = não medido

/** Saída em texto: uma linha por item, com valor, fonte e motivo. */
export function formatarTexto(rel) {
  const linhas = [`Diagnóstico de ${rel.alvo} em ${rel.gerado_em}`];
  for (const i of rel.itens) {
    const valor = i.valor === null ? "—"
      : typeof i.valor === "object" ? JSON.stringify(i.valor)
      : i.unidade === "MB" ? formatarMB(i.valor)
      : i.unidade ? `${i.valor}${i.unidade}` : String(i.valor);
    linhas.push(`[${ROTULO[i.estado]}] ${i.id}: ${valor}`);
    linhas.push(`      fonte: ${i.fonte}${i.motivo ? ` · ${i.motivo}` : ""}`);
  }
  const resumo = rel.codigo === 0 ? "ok" : rel.codigo === 1 ? "aviso" : "falha";
  linhas.push(`Resultado: ${resumo} (código ${rel.codigo})`);
  return linhas.join("\n");
}

// ----- CLI -----
const ehCli = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ehCli) {
  const args = process.argv.slice(2);
  const idPerfil = args.includes("--perfil") ? args[args.indexOf("--perfil") + 1] : null;
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  (async () => {
    let perfil = null;
    if (idPerfil) {
      const pf = join(raiz, "profiles", `${idPerfil}.json`);
      if (!existsSync(pf)) { console.error(`[diag] perfil não encontrado: ${idPerfil}`); return 1; }
      perfil = JSON.parse(readFileSync(pf, "utf8"));
      perfil.id = perfil.id || idPerfil;
      // T80: network.ip é só uma dica; o achador confere a chave de host e acha o aparelho se o IP mudou
      const r = await resolverPerfil(perfil);
      perfil = r.perfil;
      console.error(`[diag] ${descreverAchado(r.achado)}`);
    }
    const rel = await diagnosticar({ perfil });
    console.log(args.includes("--json") ? JSON.stringify(rel, null, 2) : formatarTexto(rel));
    return rel.codigo;
  })()
    .then(code => { process.exitCode = code; })
    .catch(e => { console.error(`[diag] falhou: ${e.message}`); process.exitCode = 2; });
}
