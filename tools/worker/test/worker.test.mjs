import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRunner, prepareDir, claudeSettings, DISALLOWED } from "../worker.mjs";

test("importar o worker não exige worker.json nem roda o loop", () => {
  assert.equal(typeof buildRunner, "function");
});

test("pc-claude: modo dontAsk, só leitura da pasta, sem shell/edição/web/MCP", () => {
  const r = buildRunner("pc-claude", "C:/x");
  const a = r.args.join(" ");
  assert.match(a, /--permission-mode dontAsk/);
  assert.equal(r.args[r.args.indexOf("--allowedTools") + 1], "Read(./**)");
  const dis = r.args[r.args.indexOf("--disallowedTools") + 1].split(",");
  for (const t of ["Bash", "PowerShell", "Edit", "Write", "WebFetch", "WebSearch"]) assert.ok(dis.includes(t), t);
  assert.ok(r.args.includes("--strict-mcp-config"));
  assert.doesNotMatch(a, /dangerously|bypassPermissions|--yolo|acceptEdits|auto\b/);
  assert.ok(!r.args.includes("--prompt") && !a.includes("{{"), "texto da tarefa vai pelo stdin, não por argumento");
});

test("pc-hermes fica desligado até prova de segurança; perfil desconhecido não roda", () => {
  assert.match(buildRunner("pc-hermes", "C:/x").disabled, /desligado/);
  assert.equal(buildRunner("pc-qualquer", "C:/x"), null);
});

test("pasta do perfil recebe regras: lê só ./, nega pastas sensíveis e ferramentas perigosas", () => {
  const dir = prepareDir(mkdtempSync(join(tmpdir(), "worker-")), "pc-claude");
  const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(s, claudeSettings());
  assert.deepEqual(s.permissions.allow, ["Read(./**)"]);
  for (const p of ["Read(~/.ssh/**)", "Read(~/.servidor-a13/**)", "Read(~/.claude/**)", "Read(~/Desktop/**)", "Bash", "PowerShell", "Write"]) {
    assert.ok(s.permissions.deny.includes(p), p);
  }
  assert.equal(s.permissions.defaultMode, "dontAsk");
  for (const t of DISALLOWED) assert.ok(s.permissions.deny.includes(t));
});

test("nome de perfil com caminho é recusado", () => {
  assert.throws(() => prepareDir(tmpdir(), "../fora"), /inválido/);
  assert.throws(() => prepareDir(tmpdir(), "a/b"), /inválido/);
});
