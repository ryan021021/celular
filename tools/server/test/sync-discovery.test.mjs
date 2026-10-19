import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// T74: sync-discovery.sh leva server/discovery/detect.mjs ao aparelho e confere o sha256, SEM tocar no aparelho.
// ssh e scp são falsos (PATH): o "aparelho" é uma pasta temporária. Precisa de bash e sha256sum.
// Rodar com: node --test tools/server/test/sync-discovery.test.mjs
const aqui = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(aqui, "..", "sync-discovery.sh");
const DETECT = join(aqui, "..", "..", "..", "server", "discovery", "detect.mjs");
const DEPLOY = join(aqui, "..", "deploy.ps1");
const fw = p => p.replace(/\\/g, "/");
const ferramentas = spawnSync("bash", ["-c", "command -v sha256sum >/dev/null 2>&1"], { encoding: "utf8" });
const SEM_FERRAMENTAS = ferramentas.status !== 0 && "bash/sha256sum não encontrados";
const shaRepo = () => createHash("sha256").update(readFileSync(DETECT)).digest("hex");

function ambiente(t) {
  const raiz = mkdtempSync(join(tmpdir(), "t74-"));
  const bin = join(raiz, "bin");
  const casa = join(raiz, "aparelho");
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(casa, "servidor"), { recursive: true });
  writeFileSync(join(casa, "servidor", "painel.token"), "token-falso-de-teste\n");
  const chamadas = join(raiz, "chamadas.log");
  writeFileSync(join(bin, "ssh"), `#!/usr/bin/env bash
cmd="\${@: -1}"
echo "ssh: $cmd" >> "${fw(chamadas)}"
case "$cmd" in
  *"mkdir -p ~/servidor/discovery"*) mkdir -p "$FAKE_HOME/servidor/discovery" ;;
  *"sha256sum ~/servidor/discovery/detect.mjs"*) sha256sum "$FAKE_HOME/servidor/discovery/detect.mjs" ;;
  *) echo "ssh falso: comando inesperado: $cmd" >&2; exit 9 ;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "scp"), `#!/usr/bin/env bash
dest="\${@: -1}"
src="\${@: -2:1}"
echo "scp: $src -> $dest" >> "${fw(chamadas)}"
cp "$src" "$FAKE_HOME/\${dest#*:}"
if [ "\${FAKE_CORROMPE:-}" = "1" ]; then printf x >> "$FAKE_HOME/\${dest#*:}"; fi
`, { mode: 0o755 });
  const rodar = (extra = {}) => spawnSync("bash", [fw(SCRIPT), "u0_fake@192.0.2.1", "8022", fw(join(raiz, "chave"))], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${fw(bin)}${delimiter}${process.env.PATH}`, FAKE_HOME: fw(casa), ...extra },
  });
  return { casa, chamadas, rodar };
}

test("T74: copia detect.mjs para ~/servidor/discovery com o mesmo sha256 do repo", { skip: SEM_FERRAMENTAS }, t => {
  const a = ambiente(t);
  const r = a.rodar();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /discovery ok: detect\.mjs sha256 [0-9a-f]{64}/);
  const destino = join(a.casa, "servidor", "discovery", "detect.mjs");
  assert.ok(existsSync(destino), "detect.mjs chegou ao aparelho");
  assert.equal(createHash("sha256").update(readFileSync(destino)).digest("hex"), shaRepo());
  assert.ok(r.stdout.includes(shaRepo()), "a saída mostra o sha conferido");
});

test("T74: sha diferente no aparelho falha com código 3 e mensagem clara", { skip: SEM_FERRAMENTAS }, t => {
  const a = ambiente(t);
  const r = a.rodar({ FAKE_CORROMPE: "1" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /sha256 diferente/);
  assert.doesNotMatch(r.stdout, /discovery ok/);
});

test("T74: rodar de novo é seguro e não mexe no resto de ~/servidor", { skip: SEM_FERRAMENTAS }, t => {
  const a = ambiente(t);
  assert.equal(a.rodar().status, 0);
  assert.equal(a.rodar().status, 0);
  assert.equal(readFileSync(join(a.casa, "servidor", "painel.token"), "utf8"), "token-falso-de-teste\n", "outros arquivos intactos");
  const log = readFileSync(a.chamadas, "utf8");
  assert.ok(!/rm |mv |delete/.test(log), "nenhum comando apaga ou move algo no aparelho");
});

test("T74: o deploy.ps1 chama sync-discovery.sh no passo Push, antes do push do painel", () => {
  const ps = readFileSync(DEPLOY, "utf8");
  const i = ps.indexOf("sync-discovery.sh");
  const j = ps.indexOf('"push", "-f"');
  assert.ok(i > 0, "deploy chama o script");
  assert.ok(j > i, "o painel só reinicia depois que o detect.mjs já está no aparelho");
});
