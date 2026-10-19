# Script de Ativacao de Recursos e Otimizacoes Ocultas do Android (ADB)
# Galaxy A13 (SM-A135M) - Executado em modo seguro e reversivel.
param(
    [string]$Serial = "RQ8TC00EJNB",
    [switch]$CompilarTudo, # Se passado, compila todos os apps de utilizador
    [switch]$ModoImersivo, # Esconde barras para tela 100% limpa
    [int]$Dpi = 0          # Permite definir densidade personalizada (ex: 280)
)

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
Write-Host "`n[1/5] Otimizando Wi-Fi para baixa latencia (sem micro-sono)..." -ForegroundColor Yellow
Sh "settings put global wifi_suspend_optimizations_enabled 0"
Sh "settings put global wifi_scan_always_enabled 0"
Sh "settings put global ble_scan_always_enabled 0"
Sh "settings put global wifi_sleep_policy 2"
Sh "cmd netpolicy set restrict-background false"
Write-Host "  -> Wi-Fi configurado para manter ping estavel mesmo com tela apagada." -ForegroundColor Green

# 2. RESPOSTA DE TOQUE & ANIMACAO
Write-Host "`n[2/5] Ajustando sensibilidade de toque e animacoes ultra-rapidas..." -ForegroundColor Yellow
Sh "settings put system touch_sensitiveness 1"
Sh "settings put secure long_press_timeout 250"
Sh "settings put secure multi_press_timeout 200"
Sh "settings put global window_animation_scale 0.5"
Sh "settings put global transition_animation_scale 0.5"
Sh "settings put global animator_duration_scale 0.5"
Write-Host "  -> Animacoes em 0.5x e toque instantaneo (250ms)." -ForegroundColor Green

# 3. TELEMETRIA OCULTA & RELATORIOS SILENCIOSOS
Write-Host "`n[3/5] Desativando telemetria oculta e coleta silenciosa de dados..." -ForegroundColor Yellow
Sh "settings put secure srm_allow_data_collection 0"
Sh "settings put system send_security_reports 0"
Sh "settings put secure upload_apk_enable 0"
Write-Host "  -> Coleta de relatorios silenciosos desligada." -ForegroundColor Green

# 4. RECURSOS OCULTOS DE UI (ROTACAO EM QUALQUER LUGAR)
Write-Host "`n[4/5] Ativando rotacoes de tela ocultas (Lockscreen)..." -ForegroundColor Yellow
Sh "settings put secure lockscreen_rotation 1"
Write-Host "  -> Rotacao 360 ativada para tela de bloqueio." -ForegroundColor Green

# 5. COMPILACAO NATIVA AOT (SPEED PROFILE)
Write-Host "`n[5/5] Compilando modulos criticos em codigo nativo ELF (dex2oat speed)..." -ForegroundColor Yellow
$appsCriticos = @(
    "com.android.systemui",
    "com.android.settings",
    "com.sec.android.app.myfiles",
    "com.termux"
)

foreach ($app in $appsCriticos) {
    Write-Host "  Compilando $app (AOT Speed)..." -NoNewline
    $res = Sh "cmd package compile -m speed -f $app"
    Write-Host " [$res]" -ForegroundColor Green
}

if ($CompilarTudo) {
    Write-Host "  Compilando todos os pacotes em modo Speed (pode levar alguns minutos)..." -ForegroundColor Yellow
    $resAll = Sh "cmd package compile -m speed -a"
    Write-Host "  -> Compilacao total concluida: $resAll" -ForegroundColor Green
}

if ($ModoImersivo) {
    Write-Host "`n[*] Ativando modo imersivo total (ocultar barras de navegacao e status)..." -ForegroundColor Yellow
    Sh "settings put global policy_control immersive.full=*"
    Write-Host "  -> Modo imersivo ativado." -ForegroundColor Green
}

if ($Dpi -gt 120 -and $Dpi -lt 640) {
    Write-Host "`n[*] Ajustando DPI da tela para $Dpi..." -ForegroundColor Yellow
    Sh "wm density $Dpi"
    Write-Host "  -> Densidade definida para $Dpi." -ForegroundColor Green
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "   TWEAKS OCULTOS APLICADOS COM SUCESSO!" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
