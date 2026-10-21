// tools/qa/aparelho.mjs — T112: testes no aparelho por USB, em um comando.
//   node tools/qa/aparelho.mjs [--perfil a15] [--ryx <pasta>] [--sem-ryx] --autorizado-pelo-ryan
// ATENÇÃO (diretriz de 21/10): o A15 é o celular pessoal do Ryan, só leitura. Esta ferramenta ESCREVE uma pasta
// temporária no Termux, então sem --autorizado-pelo-ryan ela recusa (saída 2) antes de qualquer comando.
// Acha o aparelho pelo serial do perfil, faz o forward da porta do sshd, confere a host key contra
// `network.ssh_hostkey_sha256` (nunca `accept-new`), manda o código para uma pasta temporária do Termux,
// roda `server/termux/test` (um arquivo por vez) e o `ryx`, e devolve JSON PASS/FAIL/BLOCKED.
// Saída 0 = PASS, 1 = FAIL, 2 = BLOCKED. Só apaga a pasta temporária que ele mesmo criou.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPO_COMANDO_MS = 30_000;
const TEMPO_SUITE_MS = 180_000;
const LINHAS_DE_SAIDA_NA_FALHA = 15;
// o único tipo de pasta que esta ferramenta aceita apagar: a que o `mktemp` dela devolveu
const PASTA_TEMPORARIA = /^\/[\w./-]*\/qa-aparelho\.[A-Za-z0-9]{6}$/;
// o que os testes de server/termux leem fora da própria pasta (boot/setup/watchdog usam o sh-do-git; post-receive lê o deploy.ps1)
const ENVIO_TERMUX = ["server/termux", "tools/qa/sh-do-git.mjs", "tools/server/deploy.ps1"];
const PLANO_DE_ESCRITA = [
  "adb forward tcp:0 tcp:<ssh_port> (só encaminha a porta, no PC)",
  "ssh: mktemp -d $TMPDIR/qa-aparelho.XXXXXX (cria pasta no Termux)",
  "tar | ssh tar -xf - (grava server/termux e o ryx nessa pasta)",
  "ssh: node --test / python -m unittest dentro da pasta",
  "ssh: rm -rf <só a pasta criada acima>",
];
const CAMPOS_DO_PERFIL = [
  ["serial", (p) => p.serial],
  ["network.ssh_port", (p) => p.network?.ssh_port],
  ["network.ssh_user", (p) => p.network?.ssh_user],
  ["network.ssh_key", (p) => p.network?.ssh_key],
  ["network.ssh_hostkey_sha256", (p) => p.network?.ssh_hostkey_sha256],
];

/** SHA256 da chave pública no formato do ssh: "SHA256:" + base64 sem "=". */
export function impressaoDigital(blobBase64) {
  const resumo = createHash("sha256").update(Buffer.from(blobBase64, "base64")).digest("base64");
  return `SHA256:${resumo.replace(/=+$/, "")}`;
}

/** Resumo do `node --test` (reporter tap "# tests 5" ou spec "ℹ tests 5"); null se não há resumo. */
export function resumoNodeTest(texto) {
  const n = {};
  for (const m of texto.matchAll(/^(?:ℹ|#)\s+(tests|pass|fail|skipped)\s+(\d+)/gm)) n[m[1]] = Number(m[2]);
  if (n.tests === undefined) return null;
  return { testes: n.tests, passaram: n.pass ?? 0, falharam: n.fail ?? 0, pulados: n.skipped ?? 0 };
}

/** Resumo do `python -m unittest` ("Ran N tests", "FAILED (failures=1, errors=1)", "skipped=2"). */
export function resumoUnittest(texto) {
  const ran = texto.match(/Ran (\d+) tests?/);
  if (!ran) return null;
  const pega = (nome) => Number(texto.match(new RegExp(`${nome}=(\\d+)`))?.[1] ?? 0);
  const testes = Number(ran[1]);
  const falharam = pega("failures") + pega("errors");
  const pulados = pega("skipped");
  return { testes, passaram: testes - falharam - pulados, falharam, pulados };
}

/** Executa um comando sem shell. Nunca rejeita: erro ao abrir vira { code: null }. */
export function executar(cmd, args, { input, cwd, timeoutMs = TEMPO_COMANDO_MS, binary = false } = {}) {
  return new Promise((terminar) => {
    const filho = spawn(cmd, args, { cwd, windowsHide: true });
    const saida = [];
    const erro = [];
    let estourou = false;
    const prazo = setTimeout(() => { estourou = true; filho.kill(); }, timeoutMs);
    filho.stdout.on("data", (d) => saida.push(d));
    filho.stderr.on("data", (d) => erro.push(d));
    filho.on("error", (e) => { clearTimeout(prazo); terminar({ code: null, stdout: "", stderr: e.message, timedOut: false }); });
    filho.on("close", (code) => {
      clearTimeout(prazo);
      const bruto = Buffer.concat(saida);
      terminar({ code, stdout: binary ? bruto : bruto.toString("utf8"), stderr: Buffer.concat(erro).toString("utf8"), timedOut: estourou });
    });
    filho.stdin.on("error", () => {});
    filho.stdin.end(input);
  });
}

const falhou = (r) => r.code !== 0 || r.timedOut;
const cauda = (texto) => texto.trim().split("\n").slice(-LINHAS_DE_SAIDA_NA_FALHA).join("\n");

function situacaoDoSerial(saidaDevices, serial) {
  const linha = saidaDevices.split("\n").map((l) => l.trim().split(/\s+/)).find((p) => p[0] === serial);
  return linha ? linha[1] : null;
}

function lerChave(saidaKeyscan) {
  for (const l of saidaKeyscan.split("\n")) {
    const campos = l.trim().split(/\s+/);
    if (campos.length >= 3 && !l.startsWith("#") && campos[1].startsWith("ssh-")) return { tipo: campos[1], blob: campos[2] };
  }
  return null;
}

function veredito(suites) {
  if (suites.some((s) => s.status === "FAIL")) return "FAIL";
  if (suites.length === 0 || suites.some((s) => s.status === "BLOCKED")) return "BLOCKED";
  return "PASS";
}

function statusDaSuite(res, resumo) {
  if (res.timedOut) return { status: "FAIL", detalhe: "tempo esgotado" };
  if (res.code === null) return { status: "BLOCKED", detalhe: `não abriu: ${res.stderr}` };
  if (!resumo) return { status: "FAIL", detalhe: "saída sem resumo de testes" };
  if (res.code !== 0 || resumo.falharam > 0 || resumo.testes === 0) return { status: "FAIL", detalhe: `código ${res.code}` };
  return { status: "PASS", detalhe: "" };
}

/**
 * Roda a rodada inteira. `perfil` é o JSON de profiles/<id>.json; `run` troca o processo real por um falso.
 * Devolve { perfil, serial, resultado, motivo, passos[], suites[] }.
 */
export async function testarAparelho(perfil, { raiz = RAIZ, ryxDir = null, run = executar, autorizado = false } = {}) {
  const r = { perfil: perfil.id, serial: perfil.serial ?? null, resultado: "BLOCKED", motivo: null, passos: [], suites: [] };
  const passo = (nome, status, detalhe = "") => r.passos.push({ nome, status, detalhe });
  const bloquear = (motivo) => { r.motivo = motivo; r.resultado = "BLOCKED"; return r; };

  // O A15 é o celular pessoal do Ryan: esta rodada ESCREVE nele (pasta temporária no Termux), então só com a ordem dele.
  if (!autorizado) {
    r.recusado = true;
    r.planejado = PLANO_DE_ESCRITA;
    return bloquear("recusado: esta rodada escreve uma pasta temporária no Termux do aparelho; só roda com --autorizado-pelo-ryan, dado pelo Ryan naquele momento");
  }

  const faltando = CAMPOS_DO_PERFIL.filter(([, ler]) => !ler(perfil)).map(([nome]) => nome);
  if (faltando.length) return bloquear(`perfil sem ${faltando.join(", ")}`);
  const { ssh_port: portaRemota, ssh_user: usuario, ssh_key: chave, ssh_hostkey_sha256: esperada } = perfil.network;

  const devices = await run("adb", ["devices"]);
  if (falhou(devices)) return bloquear(`adb devices falhou: ${cauda(devices.stderr)}`);
  const estado = situacaoDoSerial(devices.stdout, perfil.serial);
  if (estado === null) return bloquear(`aparelho ausente: serial ${perfil.serial} não aparece no adb devices`);
  if (estado !== "device") return bloquear(`aparelho em estado ${estado} (precisa de "device"; autorize a depuração USB)`);
  passo("adb", "PASS", estado);

  let portaLocal = null;
  let pastaSegredos = null;
  let pastaRemota = null;
  const ssh = (comando, { input, timeoutMs } = {}) => run("ssh", [
    "-p", String(portaLocal), "-i", chave.replace(/^~/, homedir()),
    "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10",
    "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${join(pastaSegredos, "known_hosts")}`,
    `${usuario}@127.0.0.1`, comando,
  ], { input, timeoutMs });

  try {
    const forward = await run("adb", ["-s", perfil.serial, "forward", "tcp:0", `tcp:${portaRemota}`]);
    portaLocal = Number.parseInt(forward.stdout, 10);
    if (falhou(forward) || !Number.isInteger(portaLocal)) { portaLocal = null; return bloquear("adb forward não devolveu a porta local"); }
    passo("forward", "PASS", `127.0.0.1:${portaLocal} -> ${portaRemota}`);

    const scan = await run("ssh-keyscan", ["-p", String(portaLocal), "-t", "ed25519", "127.0.0.1"]);
    const achada = falhou(scan) ? null : lerChave(scan.stdout);
    if (!achada) return bloquear("host key: o aparelho não respondeu ao ssh-keyscan");
    const medida = impressaoDigital(achada.blob);
    if (medida !== esperada) return bloquear(`host key do aparelho (${medida}) difere do perfil (${esperada}); nada foi conectado`);
    passo("host key", "PASS", medida);

    pastaSegredos = mkdtempSync(join(tmpdir(), "qa-aparelho-"));
    writeFileSync(join(pastaSegredos, "known_hosts"), `[127.0.0.1]:${portaLocal} ${achada.tipo} ${achada.blob}\n`);

    const criada = await ssh('d="${TMPDIR:-$PREFIX/tmp}"; mktemp -d "$d/qa-aparelho.XXXXXX"');
    const candidata = criada.stdout.trim();
    if (falhou(criada) || !PASTA_TEMPORARIA.test(candidata) || candidata.includes("..")) return bloquear(`pasta temporária inesperada: "${candidata}"`);
    pastaRemota = candidata;
    passo("pasta temporária", "PASS", pastaRemota);

    const ferramentas = (await ssh("for t in node python; do command -v $t >/dev/null && echo $t; done")).stdout.split("\n").map((s) => s.trim());
    await rodarSuites({ r, passo, ssh, run, raiz, ryxDir, pastaRemota, ferramentas });
    r.resultado = veredito(r.suites);
    if (r.resultado !== "PASS") r.motivo = r.suites.find((s) => s.status === r.resultado)?.detalhe || r.resultado;
    return r;
  } catch (e) {
    return bloquear(`erro na rodada: ${e.message}`);
  } finally {
    await limpar({ r, passo, ssh, run, perfil, portaLocal, pastaRemota, pastaSegredos });
  }
}

async function enviar({ run, ssh, raiz, pasta, caminhos, destino }) {
  const tar = await run("tar", ["-cf", "-", "--exclude=.git", "--exclude=__pycache__", ...caminhos], { cwd: raiz, binary: true });
  if (falhou(tar)) return `tar local falhou: ${cauda(String(tar.stderr))}`;
  const volta = await ssh(`mkdir -p '${destino}' && tar -xf - -C '${destino}'`, { input: tar.stdout });
  return falhou(volta) ? `envio falhou: ${cauda(volta.stderr)}` : null;
}

async function rodarSuites({ r, passo, ssh, run, raiz, ryxDir, pastaRemota, ferramentas }) {
  const adicionar = (nome, res, resumo) => {
    const { status, detalhe } = statusDaSuite(res, resumo);
    r.suites.push({ nome, status, detalhe, ...(resumo ?? {}), ...(status === "FAIL" ? { saida: cauda(res.stdout + res.stderr) } : {}) });
  };

  const erroNode = ferramentas.includes("node") ? await enviar({ run, ssh, raiz, caminhos: ENVIO_TERMUX, destino: pastaRemota }) : "node não está instalado no aparelho";
  if (erroNode) r.suites.push({ nome: "server/termux", status: "BLOCKED", detalhe: erroNode });
  else {
    passo("envio server/termux", "PASS");
    const lista = await ssh(`ls '${pastaRemota}/server/termux/test'`);
    const arquivos = lista.stdout.split("\n").map((s) => s.trim()).filter((s) => /^[\w.-]+\.test\.mjs$/.test(s));
    if (falhou(lista) || arquivos.length === 0) r.suites.push({ nome: "server/termux", status: "BLOCKED", detalhe: "sem arquivos de teste no aparelho" });
    for (const arquivo of arquivos) {
      const res = await ssh(`cd '${pastaRemota}' && node --test 'server/termux/test/${arquivo}' 2>&1`, { timeoutMs: TEMPO_SUITE_MS });
      adicionar(`server/termux/test/${arquivo}`, res, resumoNodeTest(res.stdout + res.stderr));
    }
  }

  const motivoRyx = !ferramentas.includes("python") ? "python não está instalado no aparelho"
    : !ryxDir ? "repositório ryx não informado"
    : await enviar({ run, ssh, raiz: ryxDir, caminhos: ["."], destino: `${pastaRemota}/ryx` });
  if (motivoRyx) { r.suites.push({ nome: "ryx", status: "BLOCKED", detalhe: motivoRyx }); return; }
  passo("envio ryx", "PASS");
  const res = await ssh(`cd '${pastaRemota}/ryx' && PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -t . 2>&1`, { timeoutMs: TEMPO_SUITE_MS });
  adicionar("ryx", res, resumoUnittest(res.stdout + res.stderr));
}

// Só desfaz o que esta rodada criou: a pasta do `mktemp` (se bate com o padrão), o forward e a pasta de segredos local.
async function limpar({ r, passo, ssh, run, perfil, portaLocal, pastaRemota, pastaSegredos }) {
  if (pastaRemota && PASTA_TEMPORARIA.test(pastaRemota)) {
    try {
      const res = await ssh(`rm -rf '${pastaRemota}'`);
      passo("limpeza", falhou(res) ? "FAIL" : "PASS", pastaRemota);
    } catch (e) {
      passo("limpeza", "FAIL", e.message);
    }
  }
  if (portaLocal) await run("adb", ["-s", perfil.serial, "forward", "--remove", `tcp:${portaLocal}`]).catch(() => {});
  if (pastaSegredos) {
    try { rmSync(pastaSegredos, { recursive: true, force: true }); } catch (e) { passo("limpeza local", "FAIL", e.message); }
  }
}

function lerArgumentos(argv) {
  const a = { perfil: "a15", ryx: join(RAIZ, "..", "ryx-termux-toolkit"), semRyx: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--perfil") a.perfil = argv[++i];
    else if (argv[i] === "--ryx") a.ryx = argv[++i];
    else if (argv[i] === "--sem-ryx") a.semRyx = true;
    else if (argv[i] === "--autorizado-pelo-ryan") a.autorizado = true;
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (!/^[a-z0-9_-]+$/.test(a.perfil ?? "")) throw new Error("--perfil inválido");
  return a;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const CODIGOS = { PASS: 0, FAIL: 1, BLOCKED: 2 };
  let saida;
  try {
    const args = lerArgumentos(process.argv.slice(2));
    const perfil = JSON.parse(readFileSync(join(RAIZ, "profiles", `${args.perfil}.json`), "utf8"));
    saida = await testarAparelho(perfil, { ryxDir: args.semRyx ? null : args.ryx, autorizado: args.autorizado });
  } catch (e) {
    saida = { resultado: "BLOCKED", motivo: e.message, passos: [], suites: [] };
  }
  console.log(JSON.stringify(saida, null, 2));
  process.exitCode = CODIGOS[saida.resultado];
}
