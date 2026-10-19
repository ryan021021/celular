// Preflight de compatibilidade (T77, OMNISERVER P2): "dá para instalar o servidor neste aparelho?"
// Só leitura. Usa o detect (server/discovery/detect.mjs) e acrescenta uma leitura curta do que o detect não cobre
// (versão do Android, fonte do Termux, Termux:Boot). Diz GO / AVISO / NO-GO por item, com motivo e como corrigir.
//
//   node tools/install/preflight.mjs --perfil a15        -> aparelho por SSH (profiles/a15.json)
//   node tools/install/preflight.mjs                     -> este computador (serve de teste; fora do Termux dá NO-GO)
//   node tools/install/preflight.mjs --perfil a15 --json -> relatório completo em JSON
// Código de saída: 0 tudo GO · 1 há avisos · 2 há NO-GO (inclui "não consegui ler o aparelho").
// Regra do projeto: dado ausente nunca vira GO. Sem leitura -> aviso (ou NO-GO quando o item é eliminatório e foi provado).
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { SCRIPT_LEITURA, lerSaida, montarCapacidades, montarRelatorio, coletarLocal, UNKNOWN } from "../../server/discovery/detect.mjs";

export const GO = "go", AVISO = "aviso", NOGO = "nogo";

// Limites (iguais para todos os aparelhos; ajuste aqui, não espalhe pelo código)
export const LIMITES = {
  androidMinimoSdk: 24,    // Android 7: abaixo disso o Termux atual não instala
  androidConfortavelSdk: 28, // Android 9+: abaixo disso é aviso (doze e Termux:Boot mais frágeis)
  espacoMinimoMb: 512, espacoConfortavelMb: 2048,
  ramMinimaMb: 1024, ramConfortavelMb: 2500,
  nodeMinimo: 18, nodeConfortavel: 20,
};

// Leitura extra, só de consulta. Mesmo formato do detect (@chave=valor), então vai na mesma ida ao aparelho.
export const SCRIPT_EXTRA = `
echo "@android_release=$(getprop ro.build.version.release 2>/dev/null)"
echo "@android_sdk=$(getprop ro.build.version.sdk 2>/dev/null)"
echo "@termux_fonte=$TERMUX_APK_RELEASE"
echo "@termux_versao=$TERMUX_VERSION"
echo "@boot_script=$([ -f "$HOME/.termux/boot/boot.sh" ] && echo sim || echo nao)"
echo "@boot_app=$(pm list packages com.termux.boot 2>/dev/null | grep -q 'com.termux.boot' && echo sim || { command -v pm >/dev/null 2>&1 && pm list packages 2>/dev/null | grep -q '^package:' && echo nao || echo desconhecido; })"
`;

const NUM = /^\d+$/;
const item = (id, nome, estado, valor, motivo, corrigir = null, fonte = "") => ({ id, nome, estado, valor, motivo, corrigir, fonte });
const cap = (rel, id) => rel?.capacidades?.find(c => c.capability_id === id) ?? null;
const lido = c => !!c && (c.status === "available" || c.status === "limited") && c.value !== UNKNOWN;
const semLeitura = (id, nome, fonte, o = "não consegui ler") => item(id, nome, AVISO, null, `${o}: sem dado, então não dá para dizer GO`, "rode de novo com o aparelho acessível por SSH", fonte);

function avaliarAndroid(rel, ex) {
  const fonte = "getprop ro.build.version.sdk";
  if (!NUM.test(ex.android_sdk ?? "")) {
    // sem getprop: se for Termux de verdade isso é leitura quebrada; se não for, nem é Android
    return lido(cap(rel, "env.termux")) && cap(rel, "env.termux").value === true
      ? semLeitura("android", "Android", fonte, "getprop sem versão")
      : item("android", "Android", NOGO, null, "sem getprop: não parece um Android", "o servidor roda no Termux, em Android 7 ou mais novo", fonte);
  }
  const sdk = Number(ex.android_sdk), versao = `Android ${ex.android_release || "?"} (API ${sdk})`;
  if (sdk < LIMITES.androidMinimoSdk) return item("android", "Android", NOGO, versao, `Android abaixo do 7 (API ${LIMITES.androidMinimoSdk})`, "o Termux atual não instala nesta versão: use outro aparelho", fonte);
  if (sdk < LIMITES.androidConfortavelSdk) return item("android", "Android", AVISO, versao, "Android antigo: poupança de bateria e Termux:Boot são menos confiáveis", "desative a otimização de bateria do Termux e do Termux:Boot e teste um reinício", fonte);
  return item("android", "Android", GO, versao, "versão suportada", null, fonte);
}

function avaliarArquitetura(rel) {
  const u = cap(rel, "cpu.arch_userspace"), k = cap(rel, "cpu.arch_kernel");
  const valor = lido(u) ? u.value : lido(k) ? k.value : null;
  const fonte = lido(u) ? u.source : k?.source ?? "uname -m";
  if (!valor) return semLeitura("arquitetura", "Arquitetura", fonte);
  const v = String(valor).toLowerCase();
  if (/arm64|aarch64/.test(v)) return item("arquitetura", "Arquitetura", GO, valor, "arm64: a que o servidor usa e testa", null, fonte);
  if (/armeabi|armv7|armv8l/.test(v)) return item("arquitetura", "Arquitetura", AVISO, valor, "32 bits: o servidor roda, mas não é o caminho testado", "prefira um aparelho arm64", fonte);
  if (/x86/.test(v)) return item("arquitetura", "Arquitetura", AVISO, valor, "x86: emulador ou aparelho raro, não testado", "use só para teste", fonte);
  return item("arquitetura", "Arquitetura", NOGO, valor, "arquitetura sem suporte conhecido", "use um aparelho arm64", fonte);
}

function avaliarTermux(rel, ex) {
  const t = cap(rel, "env.termux");
  if (!lido(t)) return semLeitura("termux", "Termux", t?.source ?? "variável PREFIX");
  if (t.value !== true) return item("termux", "Termux", NOGO, "ausente", "o PREFIX não é do Termux: o instalador só funciona dentro do Termux", "instale o Termux pelo F-Droid ou GitHub e rode tudo nele", "variável PREFIX");
  const fonte = ex.termux_fonte ? `TERMUX_APK_RELEASE=${ex.termux_fonte}` : "TERMUX_APK_RELEASE";
  const rotulo = ex.termux_versao ? `Termux ${ex.termux_versao}` : "Termux";
  if (/play/i.test(ex.termux_fonte ?? "")) return item("termux", "Termux (fonte)", NOGO, `${rotulo} · Google Play`, "a versão da Play Store é antiga e não recebe os pacotes atuais", "desinstale e instale o Termux (e o Termux:Boot) pelo F-Droid ou GitHub", fonte);
  if (/f.?droid|github/i.test(ex.termux_fonte ?? "")) return item("termux", "Termux (fonte)", GO, `${rotulo} · ${ex.termux_fonte}`, "fonte correta", null, fonte);
  return item("termux", "Termux (fonte)", AVISO, rotulo, "não consegui provar de onde o Termux veio (versão sem TERMUX_APK_RELEASE)", "confirme que veio do F-Droid ou do GitHub, nunca da Play Store", fonte);
}

function avaliarBoot(ex) {
  const fonte = "pm list packages + ~/.termux/boot/boot.sh";
  if (ex.boot_app === "sim") return item("boot", "Termux:Boot", GO, "instalado", ex.boot_script === "sim" ? "app instalado e boot.sh no lugar" : "app instalado; o instalador cria o boot.sh", null, fonte);
  if (ex.boot_app === "nao") return item("boot", "Termux:Boot", NOGO, "ausente", "sem o Termux:Boot o servidor não volta sozinho depois de reiniciar", "instale o Termux:Boot da mesma fonte do Termux e abra-o uma vez", fonte);
  if (ex.boot_app === undefined) return semLeitura("boot", "Termux:Boot", fonte);
  return item("boot", "Termux:Boot", AVISO, ex.boot_script === "sim" ? "boot.sh presente" : "não confirmado", "não consegui perguntar ao Android se o app está instalado (pm indisponível no Termux)", "confira na lista de apps se o Termux:Boot está instalado e abra-o uma vez", fonte);
}

function avaliarEspaco(rel) {
  const c = cap(rel, "storage.home_free_mb");
  if (!lido(c)) return semLeitura("espaco", "Espaço livre", c?.source ?? "df -Pk $HOME");
  const mb = c.value, valor = mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} GB (${mb} MB)` : `${mb} MB`;
  if (mb < LIMITES.espacoMinimoMb) return item("espaco", "Espaço livre", NOGO, valor, `menos de ${LIMITES.espacoMinimoMb} MB livres: não cabem pacotes, painel e backups`, "libere espaço no aparelho", c.source);
  if (mb < LIMITES.espacoConfortavelMb) return item("espaco", "Espaço livre", AVISO, valor, `menos de ${LIMITES.espacoConfortavelMb} MB livres: apertado para logs e backups`, "libere espaço ou apague arquivos grandes", c.source);
  return item("espaco", "Espaço livre", GO, valor, "espaço suficiente", null, c.source);
}

function avaliarRam(rel) {
  const c = cap(rel, "memory.ram_physical_mb");
  if (!lido(c)) return semLeitura("ram", "RAM", c?.source ?? "/proc/meminfo");
  const mb = c.value;
  if (mb < LIMITES.ramMinimaMb) return item("ram", "RAM", NOGO, `${mb} MB`, `menos de ${LIMITES.ramMinimaMb} MB: o painel e o AgentOps não cabem`, "use um aparelho com mais memória", c.source);
  if (mb < LIMITES.ramConfortavelMb) return item("ram", "RAM", AVISO, `${mb} MB`, "pouca memória: o Android pode matar serviços em segundo plano", "rode só os serviços essenciais", c.source);
  return item("ram", "RAM", GO, `${mb} MB`, "memória suficiente", null, c.source);
}

function avaliarNode(rel) {
  const c = cap(rel, "runtime.node");
  if (c && c.status === "unavailable") return item("node", "Node.js", AVISO, "ausente", "Node ainda não está instalado", "o instalador roda `pkg install nodejs`; ou instale na mão", c.source);
  if (!lido(c)) return semLeitura("node", "Node.js", c?.source ?? "node --version");
  const m = String(c.value).match(/^v?(\d+)\./);
  if (!m) return semLeitura("node", "Node.js", c.source, `versão ilegível (${c.value})`);
  const maior = Number(m[1]);
  if (maior < LIMITES.nodeMinimo) return item("node", "Node.js", NOGO, c.value, `Node ${LIMITES.nodeMinimo} é o mínimo (usamos node:test e fetch)`, "atualize: `pkg upgrade nodejs`", c.source);
  if (maior < LIMITES.nodeConfortavel) return item("node", "Node.js", AVISO, c.value, `Node abaixo do ${LIMITES.nodeConfortavel}: pode faltar recurso que o servidor usa`, "atualize: `pkg upgrade nodejs`", c.source);
  return item("node", "Node.js", GO, c.value, "versão suportada", null, c.source);
}

/** Avalia um relatório do detect + as chaves extras (@android_sdk etc.). Puro: não toca em rede nem disco. */
export function avaliar({ relatorio, extras = {}, alvo = null }) {
  const itens = [
    avaliarAndroid(relatorio, extras), avaliarArquitetura(relatorio), avaliarTermux(relatorio, extras),
    avaliarBoot(extras), avaliarEspaco(relatorio), avaliarRam(relatorio), avaliarNode(relatorio),
  ];
  const codigo = itens.some(i => i.estado === NOGO) ? 2 : itens.some(i => i.estado === AVISO) ? 1 : 0;
  return { alvo: alvo ?? relatorio?.alvo ?? "?", veredito: codigo === 2 ? "NO-GO" : codigo === 1 ? "GO com avisos" : "GO", codigo, itens };
}

/** Relatório de falha: sem leitura do aparelho não existe GO. */
export function relatorioSemLeitura(alvo, erro) {
  return { alvo, veredito: "NO-GO", codigo: 2, itens: [item("leitura", "Leitura do aparelho", NOGO, null, `não consegui ler o aparelho (${erro})`, "confira Wi-Fi, SSH e o IP do perfil, e rode de novo", "ssh")] };
}

const ROTULO = { [GO]: "GO", [AVISO]: "AVISO", [NOGO]: "NO-GO" };
export function formatarTexto(rel) {
  const linhas = [`Preflight · alvo ${rel.alvo}`];
  for (const i of rel.itens) {
    linhas.push(`[${ROTULO[i.estado]}] ${i.nome}: ${i.valor ?? "—"} — ${i.motivo}`);
    if (i.corrigir && i.estado !== GO) linhas.push(`      como corrigir: ${i.corrigir}`);
    if (i.fonte) linhas.push(`      fonte: ${i.fonte}`);
  }
  linhas.push(`Resultado: ${rel.veredito} (código ${rel.codigo})`);
  return linhas.join("\n");
}

// ----- coleta -----
function executar(cmd, args, entrada, timeoutMs) {
  return new Promise(resolver => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "";
    const t = setTimeout(() => { p.kill(); resolver({ ok: false, erro: "tempo esgotado" }); }, timeoutMs);
    p.stdout.on("data", c => { if (out.length < 65536) out += c; });
    p.on("error", e => { clearTimeout(t); resolver({ ok: false, erro: e.code === "ENOENT" ? "comando não encontrado" : "erro ao executar" }); });
    p.on("close", code => { clearTimeout(t); resolver(code === 0 ? { ok: true, saida: out } : { ok: false, erro: `saída ${code}` }); });
    p.stdin.end(entrada);
  });
}

function argsSsh(perfil) {
  const n = perfil.network || {};
  if (!n.ip || !n.ssh_user) throw new Error("perfil sem network.ip / network.ssh_user");
  const chave = String(n.ssh_key || "").replace(/^~/, os.homedir());
  return ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new",
    "-i", chave, "-p", String(n.ssh_port || 8022), `${n.ssh_user}@${n.ip}`, "sh -s"];
}

/** Uma ida ao aparelho: script do detect + script extra. Devolve { relatorio, extras }. Lança se não houver resposta. */
export async function coletarAparelho(perfil, { executor = executar } = {}) {
  const r = await executor("ssh", argsSsh(perfil), `${SCRIPT_LEITURA}\n${SCRIPT_EXTRA}`, 25000);
  if (!r.ok) throw new Error(r.erro);
  const relatorio = montarRelatorio({ alvo: perfil.id || "remoto", caps: montarCapacidades({ saida: r.saida, plataforma: "android" }) });
  return { relatorio, extras: lerSaida(r.saida).dados };
}

/** Este computador (teste/diagnóstico): detect local + a parte extra, se houver sh. */
export async function coletarEsteComputador({ executor = executar } = {}) {
  const relatorio = await coletarLocal();
  const r = await executor("sh", ["-s"], SCRIPT_EXTRA, 10000);
  return { relatorio, extras: r.ok ? lerSaida(r.saida).dados : {} };
}

export async function preflight({ perfil = null, coletaAparelho = coletarAparelho, coletaLocal = coletarEsteComputador } = {}) {
  try {
    const { relatorio, extras } = perfil ? await coletaAparelho(perfil) : await coletaLocal();
    return avaliar({ relatorio, extras, alvo: perfil?.id ?? "local" });
  } catch (e) {
    return relatorioSemLeitura(perfil?.id ?? "local", e.message);
  }
}

// ----- CLI -----
const ehCli = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ehCli) {
  const args = process.argv.slice(2);
  const valorDe = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const lockPath = join(raiz, ".collab", "locks", "a15-discovery.lock");
  const idPerfil = valorDe("--perfil");
  (async () => {
    let perfil = null;
    if (idPerfil) {
      const pf = join(raiz, "profiles", `${idPerfil}.json`);
      if (!/^[a-z0-9_]+$/.test(idPerfil) || !existsSync(pf)) { console.error(`[preflight] perfil não encontrado: ${idPerfil}`); return 2; }
      perfil = JSON.parse(readFileSync(pf, "utf8"));
      // mesma trava da leitura do detect: uma consulta por vez no aparelho
      try { mkdirSync(dirname(lockPath), { recursive: true }); writeFileSync(lockPath, `claude-orq | T77 | ${new Date().toISOString()} | preflight (só leitura)\n`, { flag: "wx" }); }
      catch { console.error("[preflight] a15-discovery.lock já existe: outra leitura em curso"); return 2; }
    }
    try {
      const rel = await preflight({ perfil });
      console.log(args.includes("--json") ? JSON.stringify(rel, null, 2) : formatarTexto(rel));
      return rel.codigo;
    } finally { if (idPerfil) try { unlinkSync(lockPath); } catch {} }
  })().then(c => { process.exitCode = c; }).catch(e => { console.error(`[preflight] falhou: ${e.message}`); process.exitCode = 2; });
}
