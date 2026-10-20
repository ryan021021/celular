import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import { comShDoGit } from "../../../tools/qa/sh-do-git.mjs";

const fw = p => p.replace(/\\/g, "/");
const WATCHDOG = fw(join(process.cwd(), "server", "termux", "watchdog.sh"));
const ENV = comShDoGit(process.env);

// Pasta de serviços falsa em PREFIX/var/service + `sv` falso (lê o estado e registra o `up`)
function comVarService(estados, extra = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "wd-"));
  const home = join(raiz, "home"), svdir = join(raiz, "var", "service"), bin = join(raiz, "bin");
  mkdirSync(join(home, "servidor", "logs"), { recursive: true });
  mkdirSync(bin);
  mkdirSync(svdir, { recursive: true });
  writeFileSync(join(home, "servidor", "start-services.sh"), "exit 0\n");

  if (extra.criarLogGrande) {
    const { nome, linhas } = extra.criarLogGrande;
    writeFileSync(join(home, "servidor", "logs", nome), "linha de log\n".repeat(linhas));
  }

  for (const [nome, est] of Object.entries(estados)) {
    mkdirSync(join(svdir, nome));
    writeFileSync(join(svdir, nome, "estado"), est);
    if (extra[nome] === "down") writeFileSync(join(svdir, nome, "down"), "");
  }

  writeFileSync(join(bin, "sv"), `#!/bin/sh\nif [ "$1" = status ]; then cat "$SVDIR/$2/estado"; else echo "$1 $2" >> "${fw(raiz)}/chamadas"; fi\n`, { mode: 0o755 });

  const pgrepScript = extra.pgrepSshdVivo === false
    ? `#!/bin/sh\nif [ "$2" = "sshd" ]; then exit 1; fi\nexit 0\n`
    : `#!/bin/sh\nexit 0\n`;
  writeFileSync(join(bin, "pgrep"), pgrepScript, { mode: 0o755 });
  writeFileSync(join(bin, "sshd"), `#!/bin/sh\necho "sshd executado" >> "${fw(raiz)}/chamadas"\nexit 0\n`, { mode: 0o755 });

  const r = spawnSync("sh", [WATCHDOG], {
    env: { ...ENV, HOME: fw(home), PREFIX: fw(raiz), PATH: `${fw(bin)}${delimiter}${ENV.PATH || process.env.PATH}` },
    encoding: "utf8",
  });
  const f = join(raiz, "chamadas");
  const logFile = join(home, "servidor", "logs", "watchdog.log");
  return {
    r,
    home,
    chamadas: existsSync(f) ? readFileSync(f, "utf8") : "",
    log: existsSync(logFile) ? readFileSync(logFile, "utf8").toString() : ""
  };
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

test("watchdog religa sshd quando pgrep acusa que caiu (mata M9)", () => {
  const { r, chamadas, log } = comVarService({}, { pgrepSshdVivo: false });
  assert.equal(r.status, 0);
  assert.match(chamadas, /up sshd|sshd executado/);
  assert.match(log, /sshd reiniciado/);
});

test("watchdog rotaciona logs quando passam de 500 linhas", () => {
  const { home } = comVarService({}, {
    criarLogGrande: { nome: "boot.log", linhas: 550 }
  });
  const linhas = readFileSync(join(home, "servidor", "logs", "boot.log"), "utf8").trim().split("\n");
  assert.equal(linhas.length, 500);
});

