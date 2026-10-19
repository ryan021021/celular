import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// T66 (P0 R1): backup.sh + restauração com um backup do A15, SEM tocar no aparelho.
// O `ssh` é falso: em vez de entrar no celular, devolve o tar de uma pasta que imita o A15.
// Tudo (chave, backups, estado do aparelho falso) fica em pasta temporária. Precisa de bash, openssl, git, tar e sha256sum.
// Rodar com: node --test tools/server/test/backup.test.mjs
const aqui = dirname(fileURLToPath(import.meta.url));
const BACKUP_SH = join(aqui, "..", "backup.sh");
const fw = p => p.replace(/\\/g, "/");
const ferramentas = spawnSync("bash", ["-c", "command -v openssl git tar sha256sum cygpath >/dev/null 2>&1 || command -v openssl git tar sha256sum >/dev/null 2>&1"], { windowsHide: true });
const SEM_FERRAMENTAS = ferramentas.status !== 0 && "bash/openssl/git/tar/sha256sum não encontrados";

// Arquivos que o backup.sh exige na prova de restauração (menos o bundle git, criado à parte)
const ESSENCIAIS = [
  "servidor/alertas.json", "servidor/painel.token", "servidor/start-services.sh", "servidor/watchdog.sh",
  "servidor/panel/server-box/server.js", "servidor/.inventario/crontab.txt", ".termux/boot/boot.sh", ".ssh/authorized_keys",
  "etc/ssh/ssh_host_ed25519_key", "var/service/server-box/run", "var/service/alertas/run",
  "servidor/agentops/server.mjs", "servidor/agentops.token", "servidor/agentops-workers.json", "servidor/agentops-data/state.json",
  "servidor/sftp/host_ed25519", "servidor/sftp_authorized_keys", "var/service/agentops/run", "var/service/sftp/run",
  "var/service/egress/run", "servidor/termux/egress-proxy.mjs",
];
const SEGREDO_FALSO = "token-falso-do-a15-para-teste-0123456789";

function git(args, cwd) {
  const r = spawnSync("git", ["-c", "user.name=teste", "-c", "user.email=teste@exemplo.invalid", ...args], { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
}

/** Monta o mundo falso: projeto temporário com o backup.sh, perfil a15 de mentira, ssh falso e a pasta que imita o A15. */
function montar({ sem = [] } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "bkp-"));
  const projeto = join(raiz, "projeto"), home = join(raiz, "home"), bin = join(raiz, "bin"), aparelho = join(raiz, "aparelho");
  mkdirSync(join(projeto, "tools", "server"), { recursive: true });
  mkdirSync(join(projeto, "profiles"));
  mkdirSync(home); mkdirSync(bin);
  copyFileSync(BACKUP_SH, join(projeto, "tools", "server", "backup.sh"));
  writeFileSync(join(projeto, "profiles", "a15.json"), JSON.stringify({ id: "a15", network: { ip: "192.0.2.15", ssh_port: 8022, ssh_user: "u0_a999" } }));

  for (const f of ESSENCIAIS.filter(f => !sem.includes(f))) {
    const alvo = join(aparelho, f);
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, f.endsWith("painel.token") || f.endsWith("agentops.token") ? SEGREDO_FALSO : `conteúdo falso de ${f}\n`);
  }
  // histórico git do painel, como o `git bundle` do A15
  const repo = join(raiz, "repo");
  mkdirSync(repo);
  git(["init", "-q", "-b", "celular"], repo);
  writeFileSync(join(repo, "server.js"), "// painel falso\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "painel falso"], repo);
  mkdirSync(join(aparelho, "servidor", ".inventario"), { recursive: true });
  git(["bundle", "create", join(aparelho, "servidor", ".inventario", "server-box.bundle"), "--all"], repo);
  writeFileSync(join(aparelho, "servidor", ".inventario", "commit.txt"), "abc1234 painel falso\n");

  // ssh falso: o comando do tar devolve a pasta do A15 falso; o do registro só grava o texto recebido
  const registro = join(raiz, "registro-no-aparelho.txt");
  writeFileSync(join(bin, "ssh"), `#!/bin/sh
for a; do cmd="$a"; done
case "$cmd" in
  *"tar -czf"*) cd "$APARELHO" && tar -czf - servidor .termux .ssh etc var ;;
  *backup-ultimo.json*) printf '%s' "$cmd" > "$REGISTRO" ;;
  *) echo "ssh falso: comando inesperado" >&2; exit 2 ;;
esac
`, { mode: 0o755 });

  const env = { ...process.env, HOME: fw(home), SERVER_DEVICE: "a15", APARELHO: fw(aparelho), REGISTRO: fw(registro), PATH: `${fw(bin)}:${process.env.PATH}` };
  const script = fw(join(projeto, "tools", "server", "backup.sh"));
  const rodar = (...args) => spawnSync("bash", [script, ...args], { env, encoding: "utf8", timeout: 180000, windowsHide: true });
  const backups = join(projeto, "backups");
  const arquivoEnc = () => (existsSync(backups) ? readdirSync(backups).find(f => f.endsWith(".tar.gz.enc")) : undefined);
  return { raiz, home, aparelho, backups, registro, env, script, rodar, arquivoEnc };
}

test("backup do A15: cifra, confere sha256, restaura em pasta temporária e registra o backup (sem tocar no aparelho)", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /sha256 ok/);
  assert.match(r.stdout, /painel clonado do backup: [0-9a-f]+ \(producao: abc1234\)/);
  assert.match(r.stdout, /restauracao conferida: \d+ arquivos/);
  assert.match(r.stdout, /registro do ultimo backup gravado/);

  const enc = m.arquivoEnc();
  assert.match(enc, /^a15-\d{8}-\d{6}\.tar\.gz\.enc$/, "o nome do backup carrega o id do aparelho");
  assert.ok(existsSync(join(m.backups, `${enc}.sha256`)));

  // cifrado de verdade: o segredo falso não aparece nos bytes do arquivo
  const bytes = readFileSync(join(m.backups, enc));
  assert.ok(!bytes.includes(Buffer.from(SEGREDO_FALSO)), "o arquivo do backup tem segredo em texto claro");
  assert.ok(bytes.length > 500);

  // o registro que iria para o aparelho cita este backup (só o texto foi gravado: o ssh era falso)
  const reg = readFileSync(m.registro, "utf8");
  assert.ok(reg.includes(enc), reg);
  assert.match(reg, /backup-ultimo\.json/);
  // a chave nasceu no HOME temporário, nunca no do Ryan
  assert.ok(existsSync(join(m.home, ".servidor-a13", "backup.key")));
});

test("restauração: --restaurar devolve cada arquivo do A15 falso com o mesmo conteúdo", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  assert.equal(m.rodar().status, 0);
  const destino = join(m.raiz, "restaurado");
  const r = m.rodar("--restaurar", fw(join(m.backups, m.arquivoEnc())), fw(destino));
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /restaurado em /);
  for (const f of ESSENCIAIS) {
    const volta = join(destino, f);
    assert.ok(existsSync(volta), `não voltou: ${f}`);
    assert.equal(readFileSync(volta, "utf8"), readFileSync(join(m.aparelho, f), "utf8"), `conteúdo diferente: ${f}`);
  }
  assert.ok(statSync(join(destino, "servidor", ".inventario", "server-box.bundle")).size > 0);
});

test("restaurar com a chave errada falha e não entrega arquivos", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  assert.equal(m.rodar().status, 0);
  const outroHome = join(m.raiz, "outro-home");
  mkdirSync(join(outroHome, ".servidor-a13"), { recursive: true });
  writeFileSync(join(outroHome, ".servidor-a13", "backup.key"), "chave-completamente-diferente\n");
  const destino = join(m.raiz, "nao-deve-existir-conteudo");
  const r = spawnSync("bash", [m.script, "--restaurar", fw(join(m.backups, m.arquivoEnc())), fw(destino)], {
    env: { ...m.env, HOME: fw(outroHome) }, encoding: "utf8", timeout: 120000, windowsHide: true,
  });
  assert.notEqual(r.status, 0);
  assert.ok(!existsSync(join(destino, "servidor", "painel.token")), "restaurou com a chave errada");
});

test("backup incompleto (falta var/service/egress/run) é recusado e não registra no aparelho", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar({ sem: ["var/service/egress/run"] });
  const r = m.rodar();
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /FALTANDO: var\/service\/egress\/run/);
  assert.match(r.stdout, /RESTAURACAO INCOMPLETA/);
  assert.ok(!existsSync(m.registro), "registrou um backup ruim como se fosse bom");
});

test("perfil sem network.ssh_user é recusado antes de qualquer conexão", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  writeFileSync(join(m.raiz, "projeto", "profiles", "a15.json"), JSON.stringify({ id: "a15", network: { ip: "192.0.2.15" } }));
  const r = m.rodar();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sem network\.ip\/ssh_user/);
  assert.ok(!existsSync(m.registro));
});
