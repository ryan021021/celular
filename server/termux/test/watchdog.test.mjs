import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Pasta de serviços falsa em PREFIX/var/service + `sv` falso (lê o estado e registra o `up`)
function comVarService(estados, extra) {
    const raiz = mkdtempSync(join(tmpdir(), "wd-"));
  const home = join(raiz, "home"), svdir = join(raiz, "var", "service"), bin = join(raiz, "bin");
  mkdirSync(join(home, "servidor", "logs"), { recursive: true }); mkdirSync(bin); mkdirSync(svdir, { recursive: true });
  writeFileSync(join(home, "servidor", "start-services.sh"), "exit 0\n");
  for (const [nome, est] of Object.entries(estados)) {
    mkdirSync(join(svdir, nome));
    writeFileSync(join(svdir, nome, "estado"), est);
    if (extra?.[nome] === "down") writeFileSync(join(svdir, nome, "down"), "");
  }
  writeFileSync(join(bin, "sv"), `#!/bin/sh\nif [ "$1" = status ]; then cat "$SVDIR/$2/estado"; else echo "$1 $2" >> "${raiz}/chamadas"; fi\n`, { mode: 0o755 });
  writeFileSync(join(bin, "pgrep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const r = spawnSync("sh", [join(process.cwd(), "server/termux/watchdog.sh")], {
    env: { ...process.env, HOME: home, PREFIX: raiz, PATH: `${bin}:${process.env.PATH}` }, encoding: "utf8",
  });
  const f = join(raiz, "chamadas");
  return { r, chamadas: existsSync(f) ? readFileSync(f, "utf8") : "", log: readFileSync(join(home, "servidor", "logs", "watchdog.log"), "utf8").toString() };
}

test("watchdog religa só os serviços fora de 'run:'", () => {
  const { r, chamadas, log } = comVarService({ agentops: "down: agentops: 5s", alertas: "run: alertas: (pid 1) 90s", egress: "run: egress: (pid 2) 9s", sftp: "down: sftp: 1s" });
  assert.equal(r.status, 0);
  assert.match(chamadas, /up agentops/);
  assert.match(chamadas, /up sftp/);
  assert.doesNotMatch(chamadas, /up alertas|up egress/);
  assert.match(log, /agentops religado/);
});

test("watchdog respeita o arquivo 'down' (parado de propósito) e ignora serviço não instalado", () => {
  const { r, chamadas } = comVarService({ agentops: "down: agentops: 5s", egress: "down: egress: 5s" }, { agentops: "down" });
  assert.equal(r.status, 0);
  assert.doesNotMatch(chamadas, /agentops/);
  assert.match(chamadas, /up egress/);
  assert.doesNotMatch(chamadas, /sftp|alertas/);
});
