import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// T76: setup.sh idempotente. Nada no aparelho: HOME e PREFIX temporários, com pkg/sv-enable/sv/sshd/crontab falsos.
// Rodar com: node --test server/termux/test/setup.test.mjs
const aqui = dirname(fileURLToPath(import.meta.url));
const SETUP = join(aqui, "..", "setup.sh");
const fw = p => p.replace(/\\/g, "/");
const PACOTES = ["openssh", "termux-services", "termux-api", "cronie", "nodejs", "nano", "curl", "git", "rclone"];
const SERVICOS = ["server-box", "alertas", "agentops", "sftp", "egress"];
const CRON_ALHEIO = "0 3 * * * echo meu-cron-que-nao-e-do-projeto";
const CHAVE = "ssh-ed25519 AAAAFAKE chave-de-teste\n";

function ambiente({ comChave = true, cronAlheio = true } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "setup-"));
  const home = join(raiz, "home"), prefix = join(raiz, "prefix"), bin = join(raiz, "bin");
  const chamadas = join(raiz, "chamadas.log");
  mkdirSync(join(home, ".ssh"), { recursive: true });
  mkdirSync(join(prefix, "etc", "profile.d"), { recursive: true });
  mkdirSync(join(prefix, "var", "service"), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(prefix, "etc", "profile.d", "start-services.sh"), "");
  if (comChave) writeFileSync(join(home, ".ssh", "authorized_keys"), CHAVE);
  if (cronAlheio) writeFileSync(join(home, ".crontab-falso"), `${CRON_ALHEIO}\n`);
  writeFileSync(join(home, "alertas.json-ausente"), "");

  const cmd = (nome, corpo) => writeFileSync(join(bin, nome), `#!/bin/sh\n${corpo}\n`, { mode: 0o755 });
  cmd("pkg", `echo "pkg $*" >> "${fw(chamadas)}"
if [ "$1" = "update" ] && [ -n "$FAKE_UPDATE_FALHA" ]; then echo "E: mirrors" >&2; exit 100; fi
if [ "$1" = "install" ]; then
  for a in "$@"; do
    if [ "$a" = "$FAKE_PKG_FALHA" ]; then echo "E: Unable to locate package $a" >&2; exit 100; fi
  done
  touch "$PREFIX/instalado-$3"
fi
exit 0`);
  cmd("sv-enable", `echo "sv-enable $1" >> "${fw(chamadas)}"; mkdir -p "$PREFIX/var/service/$1"; touch "$PREFIX/var/service/$1/habilitado"`);
  cmd("sv", `echo "sv $*" >> "${fw(chamadas)}"`);
  cmd("sshd", `if [ "$1" = "-t" ]; then exit 0; fi; echo sshd >> "${fw(chamadas)}"; touch "${fw(raiz)}/up-sshd"`);
  cmd("pgrep", `[ -f "${fw(raiz)}/up-$2" ] && exit 0 || exit 1`);
  cmd("pkill", "exit 1");
  cmd("sleep", "exit 0");
  cmd("crontab", `F="$HOME/.crontab-falso"
if [ "$1" = "-l" ]; then [ -f "$F" ] && cat "$F" || { echo "no crontab" >&2; exit 1; }; exit 0; fi
# crontab de verdade lê o stdin todo antes de gravar (o pipeline do setup.sh lê o antigo ao mesmo tempo)
D="$(cat)"; printf '%s
' "$D" > "$F"`);

  const rodar = (extra = {}) => spawnSync("bash", [fw(SETUP)], {
    encoding: "utf8",
    env: { ...process.env, HOME: fw(home), PREFIX: fw(prefix), PATH: `${fw(bin)}${delimiter}${process.env.PATH}`, ...extra },
  });
  return { raiz, home, prefix, chamadas, rodar };
}

// foto do estado: caminho relativo -> sha256 do conteúdo (HOME e PREFIX; ignora o log de chamadas e o up-sshd, que ficam na raiz)
function foto(a) {
  const out = {};
  const andar = (base, dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(base, p);
      else out[fw(relative(a.raiz, p))] = createHash("sha256").update(readFileSync(p)).digest("hex");
    }
  };
  andar(a.raiz, a.home);
  andar(a.raiz, a.prefix);
  return out;
}
const cron = a => readFileSync(join(a.home, ".crontab-falso"), "utf8").split("\n").filter(Boolean);

test("T76: instalação limpa instala os pacotes, habilita os serviços, o cron e a config do ssh", () => {
  const a = ambiente();
  const r = a.rodar();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const p of PACOTES) assert.ok(existsSync(join(a.prefix, `instalado-${p}`)), `pacote ${p}`);
  for (const s of [...SERVICOS, "sshd", "crond"]) assert.ok(existsSync(join(a.prefix, "var", "service", s, "habilitado")), `serviço ${s} habilitado`);
  for (const s of SERVICOS) assert.ok(existsSync(join(a.prefix, "var", "service", s, "run")), `serviço ${s} tem run`);
  assert.ok(existsSync(join(a.prefix, "etc", "ssh", "sshd_config.d", "10-servidor.conf")));
  assert.deepEqual(cron(a).sort(), [CRON_ALHEIO, "*/5 * * * * sh $HOME/servidor/watchdog.sh", "*/5 * * * * node $HOME/servidor/netguard.mjs >> $HOME/servidor/logs/netguard.log 2>&1", "0 4 * * 0 pkg clean -y >> $HOME/servidor/logs/clean.log 2>&1"].sort());
  assert.equal(readFileSync(join(a.home, ".ssh", "authorized_keys"), "utf8"), CHAVE, "chave autorizada intacta");
  assert.match(r.stdout, /^OK\./m);
});

test("T76: rodar 3 vezes deixa o mesmo estado e não duplica cron, serviços nem chaves", () => {
  const a = ambiente();
  assert.equal(a.rodar().status, 0);
  const um = foto(a);
  assert.equal(a.rodar().status, 0);
  const dois = foto(a);
  assert.equal(a.rodar().status, 0);
  const tres = foto(a);
  assert.deepEqual(dois, um, "segunda rodada não muda nada");
  assert.deepEqual(tres, um, "terceira rodada não muda nada");
  const linhas = cron(a);
  assert.equal(linhas.filter(l => l.includes("servidor/watchdog.sh")).length, 1);
  assert.equal(linhas.filter(l => l.includes("servidor/logs/clean.log")).length, 1);
  assert.equal(linhas.filter(l => l.includes("servidor/netguard.mjs")).length, 1);
  assert.equal(linhas.filter(l => l === CRON_ALHEIO).length, 1, "cron de fora preservado");
  assert.equal(readFileSync(join(a.home, ".ssh", "authorized_keys"), "utf8"), CHAVE);
});

test("T76: serviço que já roda não perde o supervise/ do runsv (nada de rm do diretório)", () => {
  const a = ambiente();
  const sup = join(a.prefix, "var", "service", "server-box", "supervise");
  mkdirSync(sup, { recursive: true });
  writeFileSync(join(sup, "status"), "estado-do-runsv");
  assert.equal(a.rodar().status, 0);
  assert.equal(readFileSync(join(sup, "status"), "utf8"), "estado-do-runsv");
  assert.ok(existsSync(join(a.prefix, "var", "service", "server-box", "run")));
});

test("T76: falha no meio (pacote não instala) para com mensagem clara e a próxima rodada retoma", () => {
  const a = ambiente();
  const falhou = a.rodar({ FAKE_PKG_FALHA: "rclone" });
  assert.notEqual(falhou.status, 0);
  assert.match(falhou.stderr, /ERRO: não consegui instalar o pacote 'rclone'/);
  assert.match(falhou.stderr, /rode setup\.sh de novo/);
  assert.ok(existsSync(join(a.prefix, "instalado-git")), "o que veio antes ficou instalado");
  assert.ok(!existsSync(join(a.prefix, "instalado-rclone")));
  assert.ok(!existsSync(join(a.prefix, "var", "service", "server-box", "run")), "nada de serviço antes dos pacotes");
  assert.deepEqual(cron(a), [CRON_ALHEIO], "cron não foi mexido na rodada que falhou");

  const retomou = a.rodar();
  assert.equal(retomou.status, 0, retomou.stderr);
  const limpo = ambiente();
  assert.equal(limpo.rodar().status, 0);
  assert.deepEqual(Object.keys(foto(a)).sort(), Object.keys(foto(limpo)).sort(), "retomada termina igual a uma instalação limpa");
});

test("T76: pkg update falhando para com mensagem clara e sem mexer em nada", () => {
  const a = ambiente();
  const r = a.rodar({ FAKE_UPDATE_FALHA: "1" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ERRO: pkg update\/upgrade falhou/);
  assert.ok(!existsSync(join(a.prefix, "instalado-git")));
  assert.ok(!existsSync(join(a.prefix, "var", "service", "server-box")));
});

test("T76: sem authorized_keys o login por senha não é alterado e o aviso aparece", () => {
  const a = ambiente({ comChave: false });
  const r = a.rodar();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sem ~\/\.ssh\/authorized_keys/);
  assert.ok(!existsSync(join(a.prefix, "etc", "ssh", "sshd_config.d", "10-servidor.conf")), "não tranca o acesso");
});
