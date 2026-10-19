import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// T80/T82: quem fala com o aparelho por rede tem de passar pelo achador (network.ip é só uma dica).
// Guarda contra alguém reverter a ligação sem querer. O comportamento do achador está em achar-aparelho.test.mjs.
// Rodar com: node --test tools/lib/test/ligacoes.test.mjs
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ler = rel => readFileSync(join(raiz, rel), "utf8");

for (const arq of ["tools/diag/diag.mjs", "server/discovery/detect.mjs", "tools/install/preflight.mjs", "tools/server/deploy.ps1", "tools/server/backup.sh", "tools/connect/connect.ps1"]) {
  test(`${arq} usa o achador do aparelho`, () => {
    assert.match(ler(arq), /achar-aparelho/);
  });
}

test("connect.ps1 resolve o IP antes de SSH, métricas, espelho por Wi-Fi e ADB Wi-Fi", () => {
  const t = ler("tools/connect/connect.ps1");
  for (const fn of ["Connect-SSH", "Show-Status", "Start-Mirror", "Enable-WifiAdb"]) {
    const corpo = t.split(`function ${fn}`)[1]?.split(/\nfunction |\n# Roteamento/)[0] ?? "";
    assert.match(corpo, /Resolve-AparelhoIp/, `${fn} não resolve o IP`);
  }
});
