// T112 — tools/qa/aparelho.mjs com adb, ssh, ssh-keyscan e tar FALSOS (nada toca o aparelho nem a rede).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { testarAparelho, impressaoDigital, resumoNodeTest, resumoUnittest } from "../aparelho.mjs";

const BLOB = Buffer.from("chave-publica-de-teste").toString("base64");
const IMPRESSAO = impressaoDigital(BLOB);
const OUTRA = Buffer.from("outra-chave").toString("base64");
const SERIAL = "SERIAL123";
const DIR = "/data/data/com.termux/files/usr/tmp/qa-aparelho.AbC123";
const PERFIL = {
  id: "a15", serial: SERIAL,
  network: { ssh_port: 8022, ssh_user: "u0_a304", ssh_key: "~/.ssh/id_ed25519", ssh_hostkey_sha256: IMPRESSAO },
};
const TAP_OK = "# tests 5\n# pass 5\n# fail 0\n# skipped 0\n";
const SPEC_FALHA = "ℹ tests 4\nℹ pass 3\nℹ fail 1\nℹ skipped 0\n";
const UNIT_OK = "Ran 7 tests in 0.1s\n\nOK (skipped=2)\n";

// Roteiro padrão = caminho feliz; `sobrescreve(cmd, args)` devolve uma resposta ou undefined para cair no padrão.
function falso({ sobrescreve = () => undefined, ryx = true } = {}) {
  const chamadas = [];
  const ok = (stdout = "") => ({ code: 0, stdout, stderr: "", timedOut: false });
  const run = async (cmd, args, opts = {}) => {
    chamadas.push({ cmd, args, opts });
    const custom = sobrescreve(cmd, args, opts);
    if (custom !== undefined) return custom;
    const remoto = args[args.length - 1];
    if (cmd === "adb") {
      if (args[0] === "devices") return ok(`List of devices attached\n${SERIAL}\tdevice\n\n`);
      if (args.includes("forward") && !args.includes("--remove")) return ok("34567\n");
      return ok();
    }
    if (cmd === "ssh-keyscan") return ok(`[127.0.0.1]:34567 ssh-ed25519 ${BLOB}\n`);
    if (cmd === "tar") return ok("TARBYTES");
    if (cmd === "ssh") {
      if (remoto.includes("mktemp")) return ok(`${DIR}\n`);
      if (remoto.includes("command -v")) return ok(ryx ? "node\npython\n" : "node\n");
      if (remoto.startsWith("ls ")) return ok("a.test.mjs\nb.test.mjs\n");
      if (remoto.includes("node --test")) return ok(TAP_OK);
      if (remoto.includes("unittest")) return ok(UNIT_OK);
      return ok();
    }
    throw new Error(`comando inesperado: ${cmd}`);
  };
  return { run, chamadas, ssh: () => chamadas.filter((c) => c.cmd === "ssh") };
}

const rodar = (f, perfil = PERFIL, extra = {}) =>
  testarAparelho(perfil, { raiz: "/repo", ryxDir: "/ryx", run: f.run, autorizado: true, ...extra });
const removeu = (f) => f.ssh().filter((c) => c.args[c.args.length - 1].includes("rm -rf"));

test("caminho feliz: PASS, uma linha por suíte e limpeza só da pasta criada", async () => {
  const f = falso();
  const r = await rodar(f);
  assert.equal(r.resultado, "PASS");
  assert.equal(r.serial, SERIAL);
  assert.deepEqual(r.suites.map((s) => s.status), ["PASS", "PASS", "PASS"]); // 2 arquivos node + ryx
  const rm = removeu(f);
  assert.equal(rm.length, 1);
  assert.ok(rm[0].args[rm[0].args.length - 1].includes(DIR));
  assert.ok(f.chamadas.some((c) => c.cmd === "adb" && c.args.includes("--remove")), "remove o forward");
});

test("T124: sem a ordem do Ryan recusa antes de qualquer comando e diz o que rodaria", async () => {
  const f = falso();
  const r = await rodar(f, PERFIL, { autorizado: false });
  assert.equal(f.chamadas.length, 0, "nem adb devices: nada toca o aparelho");
  assert.equal(r.resultado, "BLOCKED");
  assert.equal(r.recusado, true);
  assert.match(r.motivo, /--autorizado-pelo-ryan/);
  const plano = r.planejado.join("\n");
  for (const trecho of ["mktemp", "tar", "rm -rf"]) assert.match(plano, new RegExp(trecho));
});

test("T124: sem informar `autorizado` o padrão também recusa", async () => {
  const f = falso();
  const r = await testarAparelho(PERFIL, { raiz: "/repo", run: f.run });
  assert.equal(f.chamadas.length, 0);
  assert.equal(r.recusado, true);
});

test("envia o que os testes leem: sh-do-git e deploy.ps1 com o server/termux, e o ryx inteiro sem .git", async () => {
  const f = falso();
  await rodar(f);
  const tars = f.chamadas.filter((c) => c.cmd === "tar");
  assert.equal(tars.length, 2);
  const [termux, ryx] = tars.map((c) => c.args);
  for (const p of ["server/termux", "tools/qa/sh-do-git.mjs", "tools/server/deploy.ps1"]) assert.ok(termux.includes(p), p);
  assert.equal(tars[0].opts.cwd, "/repo");
  assert.ok(ryx.includes("."), "ryx inteiro (config/, templates/ também)");
  assert.equal(tars[1].opts.cwd, "/ryx");
  for (const a of [termux, ryx]) assert.ok(a.includes("--exclude=.git") && a.includes("--exclude=__pycache__"));
});

test("nome de arquivo estranho vindo do aparelho não entra num comando remoto", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "ssh" && args[args.length - 1].startsWith("ls ") ? { code: 0, stdout: "a.test.mjs\nx';reboot;'.test.mjs\n", stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.ok(!f.ssh().some((c) => c.args[c.args.length - 1].includes("reboot")));
  assert.equal(r.suites.filter((s) => s.nome.startsWith("server/termux/test/")).length, 1);
});

test("aparelho ausente: BLOCKED sem keyscan, sem ssh e sem forward", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "adb" && args[0] === "devices" ? { code: 0, stdout: "List of devices attached\n\n", stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "BLOCKED");
  assert.match(r.motivo, /aparelho ausente/);
  assert.equal(f.chamadas.filter((c) => c.cmd !== "adb").length, 0);
  assert.ok(!f.chamadas.some((c) => c.args.includes("forward")));
});

test("aparelho sem autorização de USB: BLOCKED", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "adb" && args[0] === "devices" ? { code: 0, stdout: `List of devices attached\n${SERIAL}\tunauthorized\n`, stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "BLOCKED");
  assert.match(r.motivo, /unauthorized/);
  assert.equal(f.ssh().length, 0);
});

test("host key diferente do perfil: BLOCKED sem abrir sessão ssh, e o forward é desfeito", async () => {
  const f = falso({ sobrescreve: (cmd) => (cmd === "ssh-keyscan" ? { code: 0, stdout: `[127.0.0.1]:34567 ssh-ed25519 ${OUTRA}\n`, stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "BLOCKED");
  assert.match(r.motivo, /host key/);
  assert.equal(f.ssh().length, 0, "nenhuma sessão ssh");
  assert.ok(f.chamadas.some((c) => c.cmd === "adb" && c.args.includes("--remove")));
});

test("perfil sem ssh_hostkey_sha256: BLOCKED antes de tocar no adb", async () => {
  const f = falso();
  const sem = { ...PERFIL, network: { ...PERFIL.network, ssh_hostkey_sha256: undefined } };
  const r = await rodar(f, sem);
  assert.equal(r.resultado, "BLOCKED");
  assert.match(r.motivo, /ssh_hostkey_sha256/);
  assert.equal(f.chamadas.length, 0);
});

test("nunca accept-new: toda sessão ssh exige StrictHostKeyChecking=yes", async () => {
  const f = falso();
  await rodar(f);
  assert.ok(f.ssh().length > 3);
  for (const c of f.ssh()) {
    const linha = c.args.join(" ");
    assert.match(linha, /StrictHostKeyChecking=yes/);
    assert.doesNotMatch(linha, /accept-new|StrictHostKeyChecking=no/);
    assert.match(linha, /UserKnownHostsFile=/);
  }
});

test("suíte que falha vira FAIL, com o resumo, e a limpeza ainda acontece", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "ssh" && args[args.length - 1].includes("b.test.mjs") && args[args.length - 1].includes("node --test") ? { code: 1, stdout: SPEC_FALHA, stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "FAIL");
  const ruim = r.suites.find((s) => s.status === "FAIL");
  assert.equal(ruim.falharam, 1);
  assert.equal(removeu(f).length, 1);
});

test("suíte que sai 0 sem resumo de testes não pode virar PASS", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "ssh" && args[args.length - 1].includes("a.test.mjs") && args[args.length - 1].includes("node --test") ? { code: 0, stdout: "nada útil", stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "FAIL");
  assert.match(r.suites.find((s) => s.status === "FAIL").detalhe, /sem resumo/);
});

test("suíte que estoura o tempo vira FAIL", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "ssh" && args[args.length - 1].includes("unittest") ? { code: null, stdout: "", stderr: "", timedOut: true } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "FAIL");
  assert.equal(r.suites.find((s) => s.nome === "ryx").detalhe, "tempo esgotado");
});

test("sem python no aparelho: a suíte do ryx fica BLOCKED e o resto segue", async () => {
  const f = falso({ ryx: false });
  const r = await rodar(f);
  const ryx = r.suites.find((s) => s.nome === "ryx");
  assert.equal(ryx.status, "BLOCKED");
  assert.equal(r.resultado, "BLOCKED");
  assert.equal(r.suites.filter((s) => s.status === "PASS").length, 2);
});

test("pasta temporária fora do padrão: não apaga nada e vira BLOCKED", async () => {
  const f = falso({ sobrescreve: (cmd, args) => (cmd === "ssh" && args[args.length - 1].includes("mktemp") ? { code: 0, stdout: "/\n", stderr: "" } : undefined) });
  const r = await rodar(f);
  assert.equal(r.resultado, "BLOCKED");
  assert.equal(removeu(f).length, 0);
});

test("erro no meio da rodada ainda apaga a pasta e desfaz o forward", async () => {
  const f = falso({ sobrescreve: (cmd, args) => { if (cmd === "ssh" && args[args.length - 1].startsWith("ls ")) throw new Error("caiu"); } });
  const r = await rodar(f);
  assert.equal(r.resultado, "BLOCKED");
  assert.match(r.motivo, /caiu/);
  assert.equal(removeu(f).length, 1);
  assert.ok(f.chamadas.some((c) => c.cmd === "adb" && c.args.includes("--remove")));
});

test("impressaoDigital bate com o formato do ssh (SHA256:base64 sem '=')", () => {
  const esperado = "SHA256:" + createHash("sha256").update(Buffer.from(BLOB, "base64")).digest("base64").replace(/=+$/, "");
  assert.equal(impressaoDigital(BLOB), esperado);
  assert.doesNotMatch(impressaoDigital(BLOB), /=/);
});

test("resumos: node (tap e spec) e unittest", () => {
  assert.deepEqual(resumoNodeTest(TAP_OK), { testes: 5, passaram: 5, falharam: 0, pulados: 0 });
  assert.deepEqual(resumoNodeTest(SPEC_FALHA), { testes: 4, passaram: 3, falharam: 1, pulados: 0 });
  assert.deepEqual(resumoUnittest(UNIT_OK), { testes: 7, passaram: 5, falharam: 0, pulados: 2 });
  assert.deepEqual(resumoUnittest("Ran 3 tests in 1s\n\nFAILED (failures=1, errors=1)\n"), { testes: 3, passaram: 1, falharam: 2, pulados: 0 });
  assert.equal(resumoNodeTest("lixo"), null);
});
