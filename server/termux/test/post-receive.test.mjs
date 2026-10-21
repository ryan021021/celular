import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// T84 (auditoria A1): o teste RODA o hook de deploy de verdade (com `sh`), num repositório temporário.
// Só ficam falsos os comandos que mexem no aparelho: `sv`, `curl` (/health), `node` (testes do painel), `sleep`;
// o `git` é o de verdade, embrulhado para poder falhar o `reset` de um commit específico. Nada toca no celular nem no HOME do Ryan.
// Rodar com: node --test server/termux/test/post-receive.test.mjs
// Prova por mutação: HOOK_ALVO=<cópia quebrada do hook> roda este mesmo teste contra a cópia.
const aqui = dirname(fileURLToPath(import.meta.url));
const HOOK = process.env.HOOK_ALVO || join(aqui, "..", "git-hooks", "post-receive");
const fw = p => p.replace(/\\/g, "/");
const ZEROS = "0".repeat(40);
const GIT_REAL = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8", windowsHide: true }).stdout.trim();

function git(args, cwd) {
  const r = spawnSync("git", ["-c", "user.name=teste", "-c", "user.email=teste@exemplo.invalid", ...args], { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Mundo falso: HOME/PREFIX temporários, painel com dois commits (velho, novo) e os comandos do aparelho trocados por falsos. */
function montar({ comAlertas = true } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "hook-"));
  const home = join(raiz, "home"), prefix = join(raiz, "prefix"), bin = join(raiz, "bin");
  const repo = join(home, "servidor", "panel", "server-box");
  mkdirSync(repo, { recursive: true });
  mkdirSync(bin);
  mkdirSync(join(prefix, "var", "service", "server-box"), { recursive: true });
  if (comAlertas) mkdirSync(join(prefix, "var", "service", "alertas"), { recursive: true });

  git(["init", "-q", "-b", "celular"], repo);
  mkdirSync(join(repo, "test"));
  writeFileSync(join(repo, "test", "a.test.mjs"), "// teste falso\n");
  writeFileSync(join(repo, "versao.txt"), "velho\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "velho"], repo);
  const velho = git(["rev-parse", "HEAD"], repo);
  writeFileSync(join(repo, "versao.txt"), "novo\n");
  git(["commit", "-q", "-am", "novo"], repo);
  const novo = git(["rev-parse", "HEAD"], repo);
  git(["reset", "-q", "--hard", velho], repo); // o aparelho roda o velho; o push traz o novo

  const chamadas = join(raiz, "chamadas.txt");
  const falso = (nome, corpo) => writeFileSync(join(bin, nome), `#!/bin/sh\n${corpo}\n`, { mode: 0o755 });
  // git: o de verdade, mas o `reset` que termina no commit $FALHA_RESET_EM falha (simula disco cheio / repo travado)
  falso("git", `for a; do ult="$a"; done
case " $* " in *" reset "*) if [ -n "$FALHA_RESET_EM" ] && [ "$ult" = "$FALHA_RESET_EM" ]; then echo "git falso: reset falhou" >&2; exit 1; fi ;; esac
exec "$GIT_REAL" "$@"`);
  falso("sv", `echo "sv $*" >> "$CHAMADAS"`);
  falso("sleep", "exit 0");
  falso("node", `echo "node $*" >> "$CHAMADAS"; echo "# testes falsos"; [ "$TESTES_OK" = 1 ]`);
  // curl: o painel só "responde" quando a árvore está no commit $SAUDE_EM (assim o /health depende do que o hook deixou no repo)
  // (lê o ref solto direto, sem subir outro processo: no Windows cada processo custa ~1 s e o hook espera até 15 voltas)
  falso("curl", `echo "curl $*" >> "$CHAMADAS"; read -r atual < "$REPO/.git/refs/heads/celular"; [ "$atual" = "$SAUDE_EM" ]`);

  const rodar = ({ ref = "refs/heads/celular", old = velho, nova = novo, testesOk = true, saudeEm = novo, falhaResetEm = "" } = {}) => {
    const env = { ...process.env, HOME: fw(home), PREFIX: fw(prefix), REPO: fw(repo), CHAMADAS: fw(chamadas), GIT_REAL,
      TESTES_OK: testesOk ? "1" : "0", SAUDE_EM: saudeEm, FALHA_RESET_EM: falhaResetEm, PATH: `${fw(bin)}:${process.env.PATH}` };
    delete env.GIT_DIR;
    return spawnSync("sh", [fw(HOOK)], { input: `${old} ${nova} ${ref}\n`, env, encoding: "utf8", timeout: 150000, windowsHide: true });
  };
  const cabeca = () => git(["rev-parse", "HEAD"], repo);
  const ramo = () => git(["symbolic-ref", "HEAD"], repo);
  const ler = arq => (existsSync(arq) ? readFileSync(arq, "utf8") : "");
  const log = () => ler(join(home, "servidor", "logs", "deploy.log"));
  const nomes = () => ler(chamadas);
  const limpar = () => { try { rmSync(raiz, { recursive: true, force: true }); } catch {} };
  const versao = () => readFileSync(join(repo, "versao.txt"), "utf8");
  return { velho, novo, versao, rodar, cabeca, ramo, log, chamadas: nomes, limpar };
}

test("deploy ok: testes passam, painel reinicia, /health responde; fica no commit novo e o branch continua preso (G14)", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /painel reiniciado com [0-9a-f]+ novo \(testes ok\)/);
  assert.equal(m.cabeca(), m.novo);
  assert.equal(m.ramo(), "refs/heads/celular", "HEAD soltou do branch celular");
  assert.match(m.chamadas(), /node --test test\/a\.test\.mjs/, "os testes do painel não rodaram");
  assert.match(m.chamadas(), /sv restart server-box/);
  assert.match(m.chamadas(), /sv restart alertas/);
  assert.match(m.log(), /-> [0-9a-f]+ ok\n$/);
  assert.ok(!/ROLLBACK/.test(m.log()));
});

test("testes falham no código novo: volta para o commit velho, reinicia e o /health do velho confirma o rollback", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ testesOk: false, saudeEm: m.velho });
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /FALHOU \(testes falharam/);
  assert.match(r.stdout, /ROLLBACK ok: painel de volta em [0-9a-f]+/);
  assert.equal(m.cabeca(), m.velho, "o rollback não devolveu a árvore ao commit velho");
  assert.equal(m.ramo(), "refs/heads/celular");
  assert.equal(m.versao().trim(), "velho", "os arquivos do painel não voltaram"); // trim: o git do Windows converte a quebra de linha
  assert.match(m.chamadas(), /sv restart server-box/);
  assert.match(m.log(), /ROLLBACK \(testes falharam/);
});

test("/health do código novo não responde: rollback automático para o velho", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ testesOk: true, saudeEm: m.velho }); // o novo passa nos testes mas o painel só responde no velho
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /FALHOU \(painel nao respondeu \/health em 15 s\)/);
  assert.match(r.stdout, /ROLLBACK ok/);
  assert.equal(m.cabeca(), m.velho);
  assert.match(m.log(), /ROLLBACK \(painel nao respondeu/);
});

test("rollback que também não sobe: ERRO GRAVE, exit 1 e o log não diz que deu certo", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ testesOk: false, saudeEm: "nunca" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ERRO GRAVE: rollback tambem nao subiu/);
  assert.ok(!/ROLLBACK ok/.test(r.stdout));
  assert.match(m.log(), /ROLLBACK FALHOU \(testes falharam/);
});

test("o reset do rollback falha: não finge que voltou (ERRO GRAVE, log ROLLBACK FALHOU)", t => {
  const m = montar(); t.after(m.limpar);
  // o reset para o velho falha e a árvore fica no novo; o painel "responde" nela, então só a checagem do reset impede o falso "ROLLBACK ok"
  const r = m.rodar({ testesOk: false, saudeEm: m.novo, falhaResetEm: m.velho });
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /ERRO GRAVE/);
  assert.ok(!/ROLLBACK ok/.test(r.stdout), "disse que o rollback deu certo com o reset falhando");
  assert.match(m.log(), /ROLLBACK FALHOU/);
  assert.ok(!/ROLLBACK \(/.test(m.log().replace(/ROLLBACK FALHOU/g, "")), "o log registrou rollback bom");
});

test("o reset para o commit novo falha: volta ao velho e não roda os testes no código errado", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ saudeEm: m.velho, falhaResetEm: m.novo });
  assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /FALHOU \(git reset falhou para /);
  assert.equal(m.cabeca(), m.velho);
  assert.ok(!/node --test/.test(m.chamadas()), "rodou os testes depois de o reset falhar");
});

test("primeiro deploy (sem commit anterior) com testes falhando: sai com 1 e não tenta rollback para zeros", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ old: ZEROS, testesOk: false });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /testes falharam no primeiro deploy/);
  assert.ok(!/Voltando/.test(r.stdout));
  assert.ok(!/sv restart/.test(m.chamadas()), "reiniciou o painel num primeiro deploy reprovado");
});

test("push de outro branch não reinicia nem testa nada", t => {
  const m = montar(); t.after(m.limpar);
  const r = m.rodar({ ref: "refs/heads/experimento" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nao e o celular\): nada reiniciado/);
  assert.equal(m.chamadas(), "", "mexeu em algo para um branch que não é o celular");
  assert.equal(m.cabeca(), m.velho);
});

test("sem o serviço alertas instalado, o deploy reinicia só o painel", t => {
  const m = montar({ comAlertas: false }); t.after(m.limpar);
  const r = m.rodar();
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(m.chamadas(), /sv restart server-box/);
  assert.ok(!/sv restart alertas/.test(m.chamadas()));
});


// ---- deploy.ps1 (B5): o passo Test não pode mascarar a falha dos testes do painel com o exit do `tail` ----
// Roda o deploy.ps1 de verdade (PowerShell) numa cópia do projeto; o `ssh` é um script falso que executa o comando remoto com `sh`
// num HOME temporário, onde o `node` é falso. Nada sai do PC.
// O `node` falso fica só no PATH do `sh` remoto: no PATH do PowerShell, o `& node` do deploy.ps1 achava o arquivo sem
// extensão e o Windows abria "Select an app to open 'node'" a cada rodada.
const SO_WINDOWS = process.platform !== "win32" && "deploy.ps1 só roda no Windows (PowerShell)";
function montarDeploy() {
  const raiz = mkdtempSync(join(tmpdir(), "deploy-"));
  const ps1 = join(aqui, "..", "..", "..", "tools", "server", "deploy.ps1");
  const proj = join(raiz, "proj"), bin = join(raiz, "bin"), binRemoto = join(raiz, "bin-remoto"), home = join(raiz, "home");
  mkdirSync(join(proj, "tools", "server"), { recursive: true });
  mkdirSync(join(proj, "profiles"));
  mkdirSync(bin);
  mkdirSync(binRemoto);
  mkdirSync(join(home, "servidor", "panel", "server-box", "test"), { recursive: true });
  writeFileSync(join(home, "servidor", "panel", "server-box", "test", "a.test.mjs"), "// falso\n");
  writeFileSync(join(proj, "tools", "server", "deploy.ps1"), readFileSync(ps1));
  writeFileSync(join(proj, "profiles", "a13.json"), JSON.stringify({ id: "a13", network: { ip: "10.0.0.9", ssh_port: 8022, ssh_user: "u0_teste", ssh_key: "~/.ssh/id_ed25519" } }));
  const cmdArq = join(raiz, "comando-remoto.sh");
  // ssh falso: guarda o comando remoto (último argumento) e roda com sh; o exit do sh é o exit do ssh
  writeFileSync(join(bin, "ssh.ps1"), `[IO.File]::WriteAllText($env:CMD_ARQ, ($args[-1] -replace "\`r", "") + "\`n")\n$env:PATH = "$env:BIN_REMOTO;$env:PATH"\n& sh $env:CMD_ARQ\nexit $LASTEXITCODE\n`);
  writeFileSync(join(binRemoto, "node"), `#!/bin/sh\necho "# testes falsos: 1 falhou"\n[ "$TESTES_OK" = 1 ]\n`, { mode: 0o755 });
  const rodar = ({ testesOk }) => spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(proj, "tools", "server", "deploy.ps1"), "-Device", "a13", "-Step", "Test"], {
    encoding: "utf8", timeout: 120000, windowsHide: true,
    env: { ...process.env, PATH: `${bin};${process.env.PATH}`, HOME: fw(home), CMD_ARQ: cmdArq, BIN_REMOTO: binRemoto, TESTES_OK: testesOk ? "1" : "0" },
  });
  return { rodar, comando: () => (existsSync(cmdArq) ? readFileSync(cmdArq, "utf8") : ""), limpar: () => { try { rmSync(raiz, { recursive: true, force: true }); } catch {} } };
}

test("deploy.ps1 -Step Test: testes do painel reprovados no aparelho fazem o deploy falhar (não mostra [PRONTO])", { skip: SO_WINDOWS }, t => {
  const d = montarDeploy(); t.after(d.limpar);
  const r = d.rodar({ testesOk: false });
  const saida = `${r.stdout}\n${r.stderr}`;
  assert.match(d.comando(), /node --test/, `o comando remoto não rodou: ${saida}`);
  assert.match(saida, /testes falsos: 1 falhou/, "o resumo dos testes (tail) sumiu");
  assert.match(saida, /\[FALHOU\]/, saida);
  assert.ok(!/\[PRONTO\]/.test(saida), "disse PRONTO com os testes reprovados");
  assert.notEqual(r.status, 0, saida);
});

test("deploy.ps1 -Step Test: testes passando fecham com [PRONTO] e mostram o resumo", { skip: SO_WINDOWS }, t => {
  const d = montarDeploy(); t.after(d.limpar);
  const r = d.rodar({ testesOk: true });
  const saida = `${r.stdout}\n${r.stderr}`;
  assert.match(saida, /testes falsos: 1 falhou/);
  assert.match(saida, /\[PRONTO\] Test concluido/, saida);
  assert.equal(r.status, 0, saida);
});
