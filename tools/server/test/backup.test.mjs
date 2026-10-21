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
const BACKUP_SH = process.env.BACKUP_ALVO || join(aqui, "..", "backup.sh"); // BACKUP_ALVO: cópia quebrada do script, para a prova por mutação
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
function montar({ sem = [], achador = null } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "bkp-"));
  const projeto = join(raiz, "projeto"), home = join(raiz, "home"), bin = join(raiz, "bin"), aparelho = join(raiz, "aparelho");
  mkdirSync(join(projeto, "tools", "server"), { recursive: true });
  mkdirSync(join(projeto, "profiles"));
  mkdirSync(home); mkdirSync(bin);
  copyFileSync(BACKUP_SH, join(projeto, "tools", "server", "backup.sh"));
  // T82: achador falso no lugar do real (que varreria a rede): imprime o IP "atual" do A15 quando recebe --perfil a15
  if (achador) {
    mkdirSync(join(projeto, "tools", "lib"), { recursive: true });
    writeFileSync(join(projeto, "tools", "lib", "achar-aparelho.mjs"), `const i = process.argv.indexOf("--perfil");
if (process.argv[i + 1] === "a15") { console.log(${JSON.stringify(achador)}); } else process.exitCode = 1;
`);
  }
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

  // ssh falso (T84): LÊ o `tar -czf` que o backup.sh pediu e empacota só esses caminhos do A15 falso (um caminho tirado do pedido some do backup).
  // SSH_MODO=255 imita o aparelho fora da rede no meio do tar: escreve um pedaço e sai com 255. O comando do registro só grava o texto recebido.
  const registro = join(raiz, "registro-no-aparelho.txt"), argsSsh = join(raiz, "args-ssh.txt"), pedidos = join(raiz, "tar-pedido.txt");
  writeFileSync(join(bin, "ssh-falso.mjs"), `import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2), cmd = args.at(-1), alvo = args.at(-2);
appendFileSync(process.env.ARGS_SSH, alvo + "\\n");
if (cmd.includes("tar -czf")) {
  const pedido = cmd.slice(cmd.indexOf("tar -czf")).split("\\n  rm -rf")[0].replace(/\\\\\\n/g, " ").split(/\\s+/).filter(Boolean).slice(3);
  const caminhos = [];
  for (let i = 0; i < pedido.length; i++) { if (pedido[i] === "-C") { i++; continue; } if (!pedido[i].startsWith("--exclude")) caminhos.push(pedido[i]); }
  writeFileSync(process.env.TAR_PEDIDO, caminhos.join("\\n"));
  const existentes = caminhos.filter(c => existsSync(join(process.env.APARELHO, c)));
  if (process.env.SSH_MODO === "255") { process.stdout.write(Buffer.from("pedaco-do-tar-antes-da-queda")); process.exit(255); }
  const r = spawnSync("sh", ["-c", 'cd "$APARELHO" && tar -czf - "$@"', "sh", ...existentes], { stdio: ["ignore", "inherit", "inherit"] });
  process.exit(r.status ?? 1);
} else if (cmd.includes("backup-ultimo.json")) {
  writeFileSync(process.env.REGISTRO, cmd);
} else { console.error("ssh falso: comando inesperado"); process.exit(2); }
`);
  writeFileSync(join(bin, "ssh"), `#!/bin/sh\nexec node "$FAKE_SSH_JS" "$@"\n`, { mode: 0o755 });

  const env = { ...process.env, HOME: fw(home), SERVER_DEVICE: "a15", APARELHO: fw(aparelho), REGISTRO: fw(registro), ARGS_SSH: fw(argsSsh), TAR_PEDIDO: fw(pedidos),
    FAKE_SSH_JS: fw(join(bin, "ssh-falso.mjs")), PATH: `${fw(bin)}:${process.env.PATH}` };
  const script = fw(join(projeto, "tools", "server", "backup.sh"));
  const rodarComEnv = (extra, ...args) => spawnSync("bash", [script, ...args], { env: { ...env, ...extra }, encoding: "utf8", timeout: 180000, windowsHide: true });
  const rodar = (...args) => rodarComEnv({}, ...args);
  const backups = join(projeto, "backups");
  const arquivoEnc = () => (existsSync(backups) ? readdirSync(backups).find(f => f.endsWith(".tar.gz.enc")) : undefined);
  const alvosSsh = () => (existsSync(argsSsh) ? readFileSync(argsSsh, "utf8") : "").split("\n").filter(Boolean).map(l => l.match(/\S+@\S+/)?.[0]);
  return { raiz, home, aparelho, backups, registro, alvosSsh, env, script, rodar, rodarComEnv, arquivoEnc };
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

test("T82: com o IP do perfil errado, o backup usa o IP que o achador encontrou", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar({ achador: "192.168.1.170" }); // o perfil diz 192.0.2.15, o aparelho está em 192.168.1.170
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}
${r.stderr}`);
  assert.match(r.stdout, /IP atual do aparelho: 192\.168\.1\.170 \(o perfil diz 192\.0\.2\.15\)/);
  const alvos = m.alvosSsh();
  assert.ok(alvos.length >= 2, "esperava as duas idas ao aparelho (tar e registro)");
  assert.ok(alvos.every(a => a === "u0_a999@192.168.1.170"), `ssh foi para o IP do perfil: ${alvos}`);
});

test("T82: sem achador (ou se ele não achar), o backup segue com o IP do perfil e avisa", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar(); // sem tools/lib/achar-aparelho.mjs no projeto de teste
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}
${r.stderr}`);
  assert.match(r.stdout, /achador nao encontrou o aparelho; usando o IP do perfil \(192\.0\.2\.15\)/);
  assert.ok(m.alvosSsh().every(a => a === "u0_a999@192.0.2.15"));
});

// ---- T84 (auditoria A3, M7b): o ssh falso lê o tar pedido e cai com 255; parcial nunca entra na retenção ----
import { utimesSync } from "node:fs";

/** 7 backups bons e antigos na pasta, com data de modificação crescente (o mais velho é 20260101). */
function semearBackupsBons(backups) {
  mkdirSync(backups, { recursive: true });
  const nomes = [];
  for (let d = 1; d <= 7; d++) {
    const nome = `a15-2026010${d}-000000.tar.gz.enc`;
    writeFileSync(join(backups, nome), `backup bom ${d}`);
    writeFileSync(join(backups, `${nome}.sha256`), `x  ${nome}\n`);
    const quando = new Date(Date.UTC(2026, 0, d));
    utimesSync(join(backups, nome), quando, quando);
    nomes.push(nome);
  }
  return nomes;
}
const encs = backups => (existsSync(backups) ? readdirSync(backups).filter(f => f.endsWith(".tar.gz.enc")).sort() : []);

test("T84: o backup pede ao aparelho todos os caminhos de segredo e serviço (o ssh falso empacota só o que foi pedido)", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  assert.equal(m.rodar().status, 0);
  const pedido = readFileSync(join(m.raiz, "tar-pedido.txt"), "utf8").split("\n");
  for (const p of ["servidor", ".termux/boot", ".ssh/authorized_keys", "etc/ssh/ssh_host_ed25519_key", "var/service/server-box", "var/service/alertas",
    "var/service/agentops", "var/service/sftp", "var/service/egress"]) assert.ok(pedido.includes(p), `o tar não pede ${p}: ${pedido}`);
  // e o que foi pedido chegou ao backup: restaura e confere o serviço egress
  const destino = join(m.raiz, "restaurado");
  assert.equal(m.rodar("--restaurar", fw(join(m.backups, m.arquivoEnc())), fw(destino)).status, 0);
  assert.ok(existsSync(join(destino, "var", "service", "egress", "run")));
});

test("T84: aparelho cai (ssh 255) no meio do tar: o backup falha, não deixa arquivo parcial nem registro, e os 7 backups bons continuam", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  const bons = semearBackupsBons(m.backups);
  const r = m.rodarComEnv({ SSH_MODO: "255" });
  assert.notEqual(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.ok(existsSync(join(m.raiz, "tar-pedido.txt")), "o ssh falso nem recebeu o pedido do tar: a falha veio de outro lugar");
  assert.ok(!/restauracao conferida|^backup: /m.test(r.stdout), "anunciou um backup que não existe");
  assert.deepEqual(encs(m.backups), bons, "um backup parcial entrou na pasta (e empurraria um bom para fora da retenção)");
  assert.deepEqual(readdirSync(m.backups).filter(f => /parcial|\.tmp/.test(f)), [], "sobrou arquivo temporário do backup");
  assert.ok(!existsSync(m.registro), "registrou no aparelho um backup que não existe");
  assert.ok(existsSync(join(m.backups, `${bons[0]}.sha256`)));
});

test("T84: depois da queda, o backup seguinte funciona e a retenção apaga só o mais velho (continuam 7)", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar();
  const bons = semearBackupsBons(m.backups);
  assert.notEqual(m.rodarComEnv({ SSH_MODO: "255" }).status, 0);
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const depois = encs(m.backups);
  assert.equal(depois.length, 7, depois.join(", "));
  assert.ok(!depois.includes(bons[0]), "o mais velho não saiu da retenção");
  assert.ok(depois.includes(bons[6]) && depois.some(f => !bons.includes(f)), "o backup novo ou o mais recente sumiu");
  assert.ok(!existsSync(join(m.backups, `${bons[0]}.sha256`)), "o .sha256 do apagado ficou");
});

test("T84: restauração incompleta não deixa o backup ruim na pasta (nem entra na retenção)", { skip: SEM_FERRAMENTAS }, () => {
  const m = montar({ sem: ["var/service/egress/run"] });
  const bons = semearBackupsBons(m.backups);
  const r = m.rodar();
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /RESTAURACAO INCOMPLETA/);
  assert.deepEqual(encs(m.backups), bons, "o backup incompleto ficou na pasta com nome definitivo");
});
