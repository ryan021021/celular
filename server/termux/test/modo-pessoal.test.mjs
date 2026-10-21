import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// T113: modo pessoal do A15. Orçamento (carregando, Wi-Fi, bateria >= 50%, < 40 °C) e botão de parar.
// Nada no aparelho: HOME/PREFIX temporários e termux-battery-status/ip/sv/crontab falsos.
// Rodar com: node --test server/termux/test/modo-pessoal.test.mjs
const aqui = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(aqui, "..", "modo-pessoal.sh");
const BOOT = join(aqui, "..", "boot.sh");
const fw = p => p.replace(/\\/g, "/");
const SERVICOS = ["server-box", "alertas", "agentops", "sftp", "egress", "sshd", "crond"];
const CRON_ALHEIO = "0 3 * * * echo cron-que-nao-e-do-projeto";
const CRON_PROJETO = ["*/5 * * * * sh $HOME/servidor/watchdog.sh", "*/5 * * * * node $HOME/servidor/netguard.mjs >> $HOME/servidor/logs/netguard.log 2>&1"];

const bateria = (o = {}) => JSON.stringify({ percentage: 80, plugged: "PLUGGED_AC", status: "CHARGING", temperature: 31.5, ...o });

function ambiente() {
  const raiz = mkdtempSync(join(tmpdir(), "mp-"));
  const home = join(raiz, "home"), prefix = join(raiz, "prefix"), bin = join(raiz, "bin");
  const chamadas = join(raiz, "chamadas.log");
  mkdirSync(join(home, ".termux", "boot"), { recursive: true });
  mkdirSync(join(home, "servidor"), { recursive: true });
  for (const s of SERVICOS) mkdirSync(join(prefix, "var", "service", s), { recursive: true });
  writeFileSync(join(home, ".termux", "boot", "boot.sh"), "#!/bin/sh\necho boot\n");
  writeFileSync(join(home, ".crontab-falso"), [CRON_ALHEIO, ...CRON_PROJETO].join("\n") + "\n");
  mkdirSync(bin);
  const cmd = (nome, corpo) => writeFileSync(join(bin, nome), `#!/bin/sh\n${corpo}\n`, { mode: 0o755 });
  cmd("termux-battery-status", `[ -n "$FAKE_BATERIA" ] && printf '%s' "$FAKE_BATERIA" || exit 1`);
  cmd("ip", `echo "default via 192.168.1.1 dev \${FAKE_IFACE:-wlan0}"`);
  cmd("sv", `echo "sv $*" >> "${fw(chamadas)}"`);
  cmd("crontab", `F="$HOME/.crontab-falso"
if [ "$1" = "-l" ]; then [ -f "$F" ] && cat "$F" || exit 1; exit 0; fi
D="$(cat)"; printf '%s\\n' "$D" > "$F"`);
  const rodar = (args, extra = {}) => spawnSync("bash", [fw(SCRIPT), ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: fw(home), PREFIX: fw(prefix), PATH: `${fw(bin)}${delimiter}${process.env.PATH}`, FAKE_BATERIA: bateria(), ...extra },
  });
  return { raiz, home, prefix, chamadas, rodar };
}

function foto(a) {
  const out = {};
  const andar = dir => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { out[fw(relative(a.raiz, p)) + "/"] = "dir"; andar(p); }
      else out[fw(relative(a.raiz, p))] = createHash("sha256").update(readFileSync(p)).digest("hex");
    }
  };
  andar(a.home); andar(a.prefix);
  return out;
}
const cron = a => readFileSync(join(a.home, ".crontab-falso"), "utf8").split("\n").filter(Boolean);
const chamadasSv = a => (existsSync(a.chamadas) ? readFileSync(a.chamadas, "utf8").split("\n").filter(Boolean) : []);

test("T113: carregando, no Wi-Fi, 80% e 31 °C libera o trabalho pesado", () => {
  const r = ambiente().rodar(["orcamento"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /pesado liberado/i);
});

test("T113: bateria exatamente 50% libera; 49% bloqueia", () => {
  const a = ambiente();
  assert.equal(a.rodar(["orcamento"], { FAKE_BATERIA: bateria({ percentage: 50 }) }).status, 0);
  const r = a.rodar(["orcamento"], { FAKE_BATERIA: bateria({ percentage: 49 }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /bateria 49%/);
});

test("T113: quente (40 °C ou mais) bloqueia; 39,9 °C libera", () => {
  const a = ambiente();
  assert.equal(a.rodar(["orcamento"], { FAKE_BATERIA: bateria({ temperature: 39.9 }) }).status, 0);
  const r = a.rodar(["orcamento"], { FAKE_BATERIA: bateria({ temperature: 40 }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /quente/i);
});

test("T113: descarregando bloqueia", () => {
  const r = ambiente().rodar(["orcamento"], { FAKE_BATERIA: bateria({ plugged: "UNPLUGGED", status: "DISCHARGING" }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /descarregando/i);
});

test("T113: fora do Wi-Fi (dados móveis) bloqueia", () => {
  const r = ambiente().rodar(["orcamento"], { FAKE_IFACE: "rmnet_data1" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Wi-Fi/);
});

test("T113: sem leitura da bateria bloqueia (na dúvida o servidor só atende)", () => {
  const r = ambiente().rodar(["orcamento"], { FAKE_BATERIA: "" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sem leitura/i);
});

test("T113: vários motivos aparecem juntos", () => {
  const r = ambiente().rodar(["orcamento"], { FAKE_BATERIA: bateria({ percentage: 30, plugged: "UNPLUGGED", status: "DISCHARGING", temperature: 44 }), FAKE_IFACE: "rmnet0" });
  assert.equal(r.status, 1);
  for (const m of [/bateria 30%/, /descarregando/i, /quente/i, /Wi-Fi/]) assert.match(r.stdout, m);
});

test("T113: parar sem --apply só mostra o plano e não muda NADA", () => {
  const a = ambiente();
  const antes = foto(a);
  const r = a.rodar(["parar"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /simula/i);
  assert.match(r.stdout, /--apply/);
  assert.deepEqual(foto(a), antes, "nenhum arquivo mudou");
  assert.deepEqual(cron(a), [CRON_ALHEIO, ...CRON_PROJETO]);
  assert.deepEqual(chamadasSv(a), [], "nenhum sv chamado");
});

test("T113: parar --apply derruba os serviços do projeto, tira do boot e do cron, mantém o sshd", () => {
  const a = ambiente();
  const r = a.rodar(["parar", "--apply"]);
  assert.equal(r.status, 0, r.stderr);
  for (const s of ["server-box", "alertas", "agentops", "sftp", "egress"]) {
    assert.ok(existsSync(join(a.prefix, "var", "service", s, "down")), `${s} com arquivo down (o watchdog respeita)`);
    assert.ok(chamadasSv(a).includes(`sv down ${s}`), `sv down ${s}`);
  }
  assert.ok(!existsSync(join(a.prefix, "var", "service", "sshd", "down")), "sshd fica de pé: é o acesso do Ryan");
  assert.ok(!existsSync(join(a.prefix, "var", "service", "crond", "down")));
  assert.ok(!existsSync(join(a.home, ".termux", "boot", "boot.sh")), "fora do boot");
  assert.ok(existsSync(join(a.home, ".termux", "boot", "boot.sh.parado")), "guardado, não apagado");
  assert.deepEqual(cron(a), [CRON_ALHEIO], "só o cron de fora ficou");
  assert.ok(existsSync(join(a.home, "servidor", "parado")), "marcador de servidor parado");
});

test("T113: parar --apply duas vezes termina no mesmo estado", () => {
  const a = ambiente();
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  const um = foto(a);
  const c = cron(a);
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  assert.deepEqual(foto(a), um);
  assert.deepEqual(cron(a), c);
});

test("T113: retomar --apply desfaz o parar (boot, cron e serviços)", () => {
  const a = ambiente();
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  const r = a.rodar(["retomar", "--apply"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(a.home, ".termux", "boot", "boot.sh")));
  assert.ok(!existsSync(join(a.home, ".termux", "boot", "boot.sh.parado")));
  for (const s of ["server-box", "alertas", "agentops", "sftp", "egress"]) {
    assert.ok(!existsSync(join(a.prefix, "var", "service", s, "down")));
    assert.ok(chamadasSv(a).includes(`sv up ${s}`), `sv up ${s}`);
  }
  assert.ok(!existsSync(join(a.home, "servidor", "parado")));
  assert.deepEqual(cron(a).sort(), [CRON_ALHEIO, ...CRON_PROJETO].sort());
});

test("T113: comando desconhecido ou sem argumento mostra o uso e sai com erro", () => {
  const a = ambiente();
  assert.equal(a.rodar([]).status, 2);
  const r = a.rodar(["apagar-tudo"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /uso:/i);
});

test("T113: boot.sh não sobe nada quando o servidor foi parado", () => {
  const raiz = mkdtempSync(join(tmpdir(), "mp-boot-"));
  const home = join(raiz, "home"), prefix = join(raiz, "prefix"), bin = join(raiz, "bin");
  mkdirSync(join(home, "servidor"), { recursive: true }); mkdirSync(prefix, { recursive: true }); mkdirSync(bin);
  writeFileSync(join(home, "servidor", "parado"), "parado\n");
  const log = join(raiz, "chamadas.log");
  for (const n of ["termux-wake-lock", "sshd", "crond", "pgrep", "sleep"]) writeFileSync(join(bin, n), `#!/bin/sh\necho ${n} >> "${fw(log)}"\nexit 1\n`, { mode: 0o755 });
  writeFileSync(join(home, "servidor", "start-services.sh"), `echo start-services >> "${fw(log)}"\n`);
  const r = spawnSync("bash", [fw(BOOT)], { encoding: "utf8", env: { ...process.env, HOME: fw(home), PREFIX: fw(prefix), PATH: `${fw(bin)}${delimiter}${process.env.PATH}` } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(log), "nenhum comando do boot rodou");
});

test("T113: serviço que o Ryan já deixou desligado (down antigo) continua desligado depois do retomar", () => {
  const a = ambiente();
  writeFileSync(join(a.prefix, "var", "service", "sftp", "down"), "");
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  assert.equal(a.rodar(["retomar", "--apply"]).status, 0);
  assert.ok(existsSync(join(a.prefix, "var", "service", "sftp", "down")), "sftp segue desligado de propósito");
  assert.ok(!existsSync(join(a.prefix, "var", "service", "alertas", "down")));
  assert.ok(!chamadasSv(a).includes("sv up sftp"));
});

test("T113: cron reinstalado enquanto parado não duplica no retomar, e parar de novo não perde o backup", () => {
  const a = ambiente();
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  // setup.sh/deploy recolocam as linhas durante a parada
  writeFileSync(join(a.home, ".crontab-falso"), [CRON_ALHEIO, ...CRON_PROJETO].join("\n") + "\n");
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  assert.deepEqual(cron(a), [CRON_ALHEIO]);
  assert.equal(a.rodar(["retomar", "--apply"]).status, 0);
  assert.deepEqual(cron(a).sort(), [CRON_ALHEIO, ...CRON_PROJETO].sort(), "cada linha uma vez só");
});

test("T113: cron alheio que não cita watchdog/netguard fica intocado no parar", () => {
  const a = ambiente();
  writeFileSync(join(a.home, ".crontab-falso"), [CRON_ALHEIO, "30 2 * * * sh $HOME/backup-pessoal.sh", ...CRON_PROJETO].join("\n") + "\n");
  assert.equal(a.rodar(["parar", "--apply"]).status, 0);
  assert.deepEqual(cron(a), [CRON_ALHEIO, "30 2 * * * sh $HOME/backup-pessoal.sh"]);
});

test("T113: temperatura que não é número vale como sem leitura e bloqueia", () => {
  const r = ambiente().rodar(["orcamento"], { FAKE_BATERIA: bateria({ temperature: "quente" }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sem leitura/i);
});
