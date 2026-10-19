// node --test "tools/qa/test/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { DESKTOP } from "../regras.mjs";

test("caminho da Desktop: todas as formas conhecidas são pegas", () => {
  for (const linha of [
    String.raw`python "C:\Users\Ryanr\Desktop\desenhar_padrao.py" %SEQ%`,
    "fs.writeFileSync('C:/Users/Ryanr/Desktop/test_com6.ps1', script);",
    String.raw`copy x %USERPROFILE%\Desktop\y`,
    String.raw`$saida = "$env:USERPROFILE\Desktop\a21s.png"`,
    "cp x $HOME/Desktop/y",
    "cp x ${HOME}/Desktop/y",
    "cat ~/Desktop/notas.txt",
    "[Environment]::GetFolderPath('Desktop')",
    "[Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)",
    "const d = join(homedir(), \"Desktop\", \"x\");",
    "p = os.path.join(os.path.expanduser('~'), 'Desktop')",
    "p = Path.home() / 'Desktop'",
  ]) assert.match(linha, DESKTOP, linha);
});

test("caminho da Desktop: não acusa o que é permitido", () => {
  for (const linha of [
    '"~/Desktop/**", "~/Documents/**",',          // glob das regras de bloqueio do worker
    "Read(~/Desktop/**)",
    "%~dp0desenhar_padrao.py",
    "join(PSScriptRoot, 'Desktop.md')",
    "C:/Users/Ryanr/agentes-pc",
    "a pasta Desktop do usuário não é usada",
  ]) assert.doesNotMatch(linha, DESKTOP, linha);
});
