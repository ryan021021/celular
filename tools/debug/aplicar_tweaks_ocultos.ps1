# Script de Ativacao de Recursos e Otimizacoes Ocultas do Android (ADB)
# Galaxy A13 (SM-A135M) - Executado em modo seguro e reversivel.
# NOTA (T40): PROIBIDO EXECUTAR EM QUALQUER APARELHO ATE REVISAO DO ORQ/CHEFE.
param(
    [string]$Device = "a13",
    [string]$Serial = "",
    [switch]$Confirmo
)

if (-not $Confirmo) {
    Write-Host "[BLOQUEADO] O script aplicar_tweaks_ocultos.ps1 esta proibido de rodar sem confirmacao explicita (T40)." -ForegroundColor Red
    Write-Host "            Para executar deliberadamente, use o parametro -Confirmo." -ForegroundColor Yellow
    exit 1
}

# serial vem do perfil (profiles/<Device>.json), nao fica fixo no script (T39)
if (-not $Serial) {
    $perfil = Join-Path $PSScriptRoot "..\..\profiles\$Device.json"
    $Serial = (Get-Content $perfil -Raw | ConvertFrom-Json).serial
    if (-not $Serial) { Write-Error "perfil $Device sem serial"; exit 1 }
}

. "$PSScriptRoot\..\common.ps1"
$adb = Find-Adb
if (-not $adb) {
    Write-Error "ADB nao encontrado!"
    exit 1
}

function Sh([string]$cmd) {
    & $adb -s $Serial shell $cmd
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   APLICANDO TWEAKS E RECURSOS OCULTOS VIA ADB NO A13 ($Serial)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. LATENCIA DE REDE & WI-FI 24/7 (SEMPRE ACORDADO)
Write-Host "`n[1/4] Otimizando Wi-Fi para baixa latencia (sem micro-sono)..." -ForegroundColor Yellow
Sh "settings put global wifi_suspend_optimizations_enabled 0"
Sh "settings put global wifi_scan_always_enabled 0"
Sh "settings put global ble_scan_always_enabled 0"
Sh "settings put global wifi_sleep_policy 2"
Sh "cmd netpolicy set restrict-background false"
Write-Host "  -> Wi-Fi configurado para manter ping estavel mesmo com tela apagada." -ForegroundColor Green

# 2. RESPOSTA DE TOQUE & ANIMACAO
Write-Host "`n[2/4] Ajustando sensibilidade de toque e animacoes ultra-rapidas..." -ForegroundColor Yellow
Sh "settings put system touch_sensitiveness 1"
Sh "settings put secure long_press_timeout 250"
Sh "settings put secure multi_press_timeout 200"
Sh "settings put global window_animation_scale 0.5"
Sh "settings put global transition_animation_scale 0.5"
Sh "settings put global animator_duration_scale 0.5"
Write-Host "  -> Animacoes em 0.5x e toque instantaneo (250ms)." -ForegroundColor Green

# 3. TELEMETRIA OCULTA & RELATORIOS SILENCIOSOS
Write-Host "`n[3/4] Desativando telemetria oculta e coleta silenciosa de dados..." -ForegroundColor Yellow
Sh "settings put secure srm_allow_data_collection 0"
Sh "settings put system send_security_reports 0"
Sh "settings put secure upload_apk_enable 0"
Write-Host "  -> Coleta de relatorios silenciosos desligada." -ForegroundColor Green

# 4. RECURSOS OCULTOS DE UI (ROTACAO EM QUALQUER LUGAR)
Write-Host "`n[4/4] Ativando rotacoes de tela ocultas (Lockscreen)..." -ForegroundColor Yellow
Sh "settings put secure lockscreen_rotation 1"
Write-Host "  -> Rotacao 360 ativada para tela de bloqueio." -ForegroundColor Green

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "   TWEAKS OCULTOS CONCLUIDOS COM SUCESSO!" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
