import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const hookPath = join(new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), "..", "git-hooks", "post-receive");

test("post-receive: usa reset --hard e não checkout para manter branch celular preso (G14)", () => {
  const content = readFileSync(hookPath, "utf8");
  assert.match(content, /git -C "\$REPO" reset -q --hard "\$novo"/, "deve usar reset --hard para atualizar a árvore de trabalho mantendo o branch preso");
  assert.doesNotMatch(content, /git -C "\$REPO" checkout -q -f "\$novo"/, "não deve usar checkout para evitar soltar o HEAD (detached HEAD)");
});

test("post-receive: simulação de reset mantém HEAD apontando para o branch celular", (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "post-receive-test-"));
  t.after(() => {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  execSync("git init -q", { cwd: tmp });
  execSync("git config user.email test@test.com", { cwd: tmp });
  execSync("git config user.name test", { cwd: tmp });
  execSync("git checkout -q -b celular", { cwd: tmp });
  
  execSync("git commit --allow-empty -q -m 'velho'", { cwd: tmp });
  const velho = execSync("git rev-parse HEAD", { cwd: tmp, encoding: "utf8" }).trim();

  execSync("git commit --allow-empty -q -m 'novo'", { cwd: tmp });
  const novo = execSync("git rev-parse HEAD", { cwd: tmp, encoding: "utf8" }).trim();

  // volta para o commit velho
  execSync(`git reset -q --hard ${velho}`, { cwd: tmp });
  assert.equal(execSync("git rev-parse HEAD", { cwd: tmp, encoding: "utf8" }).trim(), velho);

  // simula o comando exato do post-receive: git -C "$REPO" reset -q --hard "$novo"
  execSync(`git -C "${tmp}" reset -q --hard ${novo}`);

  // confere que HEAD está no commit novo E o branch continua sendo celular (não detached!)
  assert.equal(execSync("git rev-parse HEAD", { cwd: tmp, encoding: "utf8" }).trim(), novo);
  const ref = execSync("git symbolic-ref HEAD", { cwd: tmp, encoding: "utf8" }).trim();
  assert.equal(ref, "refs/heads/celular", "HEAD deve continuar preso a refs/heads/celular");
});
