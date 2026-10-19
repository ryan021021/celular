[CmdletBinding()]
param([string]$Serial = "RQ8TC00EJNB", [switch]$SoConferir)
# Reaplica pelo ADB (cabo) os ajustes do servidor que já voltaram ao padrão sozinhos (T30).
# O Termux não consegue: o comando settings exige o shell do ADB (INTERACT_ACROSS_USERS / app_process bloqueados).
#   .\reaplicar-ajustes.ps1 -SoConferir   -> só mostra o que está diferente
#   .\reaplicar-ajustes.ps1               -> corrige o que estiver diferente e confere de novo
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\common.ps1") 2>$null
$adb = if (Get-Command Find-Adb -ErrorAction SilentlyContinue) { Find-Adb } else { "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\adb.exe" }

$desejado = [ordered]@{
  "global settings_enable_monitor_phantom_procs" = "false"  # Android não mata processos do Termux
  "global stay_on_while_plugged_in"              = "0"      # tela não fica acesa no carregador
  "global protect_battery"                       = "1"      # carga limitada a 80%
  "global adb_wifi_enabled"                      = "0"      # depuração sem fio desligada
  "secure double_tap_to_wake"                    = "1"      # único jeito de acender a tela (sem botão)
}

$diferentes = 0
foreach ($k in $desejado.Keys) {
  $ns, $nome = $k -split " "
  $atual = (& $adb -s $Serial shell settings get $ns $nome).Trim()
  if ($atual -eq $desejado[$k]) { "ok        $nome = $atual"; continue }
  $diferentes++
  if ($SoConferir) { "DIFERENTE $nome = $atual (esperado $($desejado[$k]))"; continue }
  & $adb -s $Serial shell settings put $ns $nome $desejado[$k] | Out-Null
  $novo = (& $adb -s $Serial shell settings get $ns $nome).Trim()
  if ($novo -eq $desejado[$k]) { "CORRIGIDO $nome : $atual -> $novo" } else { "FALHOU    $nome continua $novo"; exit 1 }
}
if ($diferentes -eq 0) { "tudo certo: nada a corrigir" }
