// PreToolUse (Bash/PowerShell): bloqueia comando ADB destrutivo sem OK do Ryan.
// Para liberar depois do OK explícito do Ryan, inclua no comando o marcador: # OK-RYAN: <motivo>
// Falha aberta: qualquer erro de leitura deixa passar (exit 0) para não travar as sessões.
import { readFileSync } from 'node:fs';

let cmd = '';
try { cmd = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command ?? ''; } catch { process.exit(0); }
if (!/\b(adb|fastboot)(\.exe)?\b/i.test(cmd) || /#\s*OK-RYAN:\s*\S/.test(cmd)) process.exit(0);

const perigos = [
  [/\bpm\s+(uninstall|clear|disable(-user)?|hide|suspend)\b/i, 'remover/limpar/desativar pacote'],
  [/\badb(\.exe)?\b[^|;&]*\buninstall\b/i, 'desinstalar app'],
  [/\b(adb(\.exe)?\b[^|;&]*\breboot|shell\s+["']?(svc\s+power\s+)?reboot)\b/i, 'reiniciar o aparelho'],
  [/\bfastboot\b/i, 'fastboot'],
  [/\b(wipe|recovery\s+--wipe|factory)/i, 'apagar dados'],
  [/\bcmd\s+package\s+compile\b/i, 'compilar pacotes (reiniciou o A13 em 19/10)'],
  [/\bwm\s+(density|size)\b/i, 'mudar densidade/tamanho da tela'],
  [/\bpolicy_control\b/i, 'modo imersivo'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+\/(sdcard|storage|data)\b/i, 'apagar arquivos do aparelho'],
];
const achado = perigos.find(([re]) => re.test(cmd));
if (!achado) process.exit(0);
process.stderr.write(
  `BLOQUEADO pelo adb-guard (${achado[1]}). Comando destrutivo no celular exige OK explícito do Ryan, pedido pelo CHEFE. ` +
  `Com o OK, repita o comando com "# OK-RYAN: <motivo>" no fim.\n`);
process.exit(2);
