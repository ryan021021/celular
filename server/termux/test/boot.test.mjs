import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { comShDoGit } from "../../../tools/qa/sh-do-git.mjs";

// Rodar com: node --test server/termux/test/boot.test.mjs  (nada no aparelho: tudo em pasta temporária, com runsv/sshd/crond falsos)
const aqui = dirname(fileURLToPath(import.meta.url));
const fw = p => p.replace(/\\/g, "/");
const BOOT = fw(join(aqui, "..", "boot.sh"));
const START = fw(join(aqui, "..", "start-services.sh"));
const ENV = comShDoGit(process.env);

// Ambiente falso do Termux. Cada comando registra a sua chamada em `chamadas`, na ordem em que acontece.
// `pgrep -x <nome>` acha o processo só se existir o arquivo up-<nome>; sshd/crond falsos criam esse arquivo.
// runsvSobe=true: o profile do Termux (runsvdir falso) sobe sshd e depois crond, como o runit faria.
function ambiente({ runsvSobe = true, painelSaudavel = true, comPainel = false } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "boot-"));
  const home = join(raiz, "home"), prefix = join(raiz, "prefix"), bin = join(raiz, "bin");
  const chamadas = join(raiz, "chamadas");
  mkdirSync(join(home, "servidor"), { recursive: true });
  mkdirSync(join(prefix, "etc", "profile.d"), { recursive: true });
  mkdirSync(join(prefix, "var", "service"), { recursive: true });
  mkdirSync(bin);
  if (comPainel) mkdirSync(join(prefix, "var", "service", "server-box"));

  // start-services.sh do servidor (registra a chamada; a lógica do painel é testada à parte)
  writeFileSync(join(home, "servidor", "start-services.sh"), `echo start-services >> "${fw(chamadas)}"\nexit 0\n`);

  // runsvdir falso, lido pelo boot.sh via . "$PREFIX/etc/profile.d/start-services.sh"
  const runsv = runsvSobe
    ? `echo runsv >> "${fw(chamadas)}"\ntouch "${fw(raiz)}/up-sshd"\necho sshd-runit >> "${fw(chamadas)}"\ntouch "${fw(raiz)}/up-crond"\necho crond-runit >> "${fw(chamadas)}"\n`
    : "";
  writeFileSync(join(prefix, "etc", "profile.d", "start-services.sh"), runsv);

  const cmd = (nome, corpo) => writeFileSync(join(bin, nome), `#!/bin/sh\n${corpo}\n`, { mode: 0o755 });
  cmd("termux-wake-lock", `echo wake-lock >> "${fw(chamadas)}"`);
  cmd("sleep", "exit 0");
  cmd("pgrep", `[ -f "${fw(raiz)}/up-$2" ] && exit 0 || exit 1`);
  // reserva: o boot.sh só chama sshd/crond quando o runit não subiu
  cmd("sshd", `echo sshd-reserva >> "${fw(chamadas)}"; touch "${fw(raiz)}/up-sshd"`);
  cmd("crond", `echo crond-reserva >> "${fw(chamadas)}"; touch "${fw(raiz)}/up-crond"`);
  cmd("curl", `echo "curl $*" >> "${fw(chamadas)}"\n` + (painelSaudavel ? "exit 0" : "exit 1"));
  cmd("sv", `echo "sv $*" >> "${fw(chamadas)}"`);

  const env = { ...ENV, HOME: fw(home), PREFIX: fw(prefix), SVDIR: fw(join(prefix, "var", "service")), RAIZ: fw(raiz), PATH: `${fw(bin)}${delimiter}${ENV.PATH || process.env.PATH}` };
  const rodar = script => spawnSync("sh", [script], { env, encoding: "utf8", timeout: 30000 });
  const lista = () => (existsSync(chamadas) ? readFileSync(chamadas, "utf8") : "").split("\n").filter(Boolean);
  return { home, rodar, lista };
}

test("ordem de subida: wake-lock, runit sobe sshd e crond, boot espera e só então chama start-services", () => {
  const amb = ambiente({ runsvSobe: true });
  const r = amb.rodar(BOOT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(amb.lista(), ["wake-lock", "runsv", "sshd-runit", "crond-runit", "start-services"]);
});

test("reserva: se o runit não subiu, boot liga sshd e crond na mão antes do start-services", () => {
  const amb = ambiente({ runsvSobe: false });
  const r = amb.rodar(BOOT);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(amb.lista(), ["wake-lock", "sshd-reserva", "crond-reserva", "start-services"]);
});

test("idempotente: rodar o boot de novo com tudo já no ar não liga nada em duplicata", () => {
  const amb = ambiente({ runsvSobe: true });
  assert.equal(amb.rodar(BOOT).status, 0);
  const primeira = amb.lista().length;
  const r = amb.rodar(BOOT);
  assert.equal(r.status, 0, r.stderr);
  const nova = amb.lista().slice(primeira);
  assert.ok(!nova.some(l => l.includes("reserva")), `subiu em duplicata: ${nova}`);
  assert.ok(nova.includes("start-services"));
});

test("boot cria ~/servidor/logs antes de chamar start-services", () => {
  const amb = ambiente({ runsvSobe: true });
  assert.equal(amb.rodar(BOOT).status, 0);
  assert.ok(existsSync(join(amb.home, "servidor", "logs")));
});

test("start-services: reinicia o painel só quando /health não responde (mata M12)", () => {
  const caiu = ambiente({ painelSaudavel: false, comPainel: true });
  assert.equal(caiu.rodar(START).status, 0);
  assert.ok(caiu.lista().some(l => l.startsWith("curl") && l.includes("http://127.0.0.1:8080/health")), "curl deve verificar a rota /health na porta 8080");
  assert.ok(caiu.lista().includes("sv restart server-box"), caiu.lista().join(" | "));

  const ok = ambiente({ painelSaudavel: true, comPainel: true });
  assert.equal(ok.rodar(START).status, 0);
  assert.ok(ok.lista().some(l => l.startsWith("curl") && l.includes("http://127.0.0.1:8080/health")), "curl deve verificar a rota /health na porta 8080");
  assert.ok(!ok.lista().some(l => l.startsWith("sv restart")), ok.lista().join(" | "));
});

