# Otimizador de jogo generico (T3). Mesmos ajustes do antigo OTIMIZAR_CELULAR_BRAWL_90HZ_PERMANENTE.bat,
# com o pacote do jogo e o aparelho como parametros.
#   .\otimizar_jogo.ps1                                  -> Brawl Stars no unico aparelho conectado
#   .\otimizar_jogo.ps1 -Pacote com.dts.freefireth -Serial XYZ
# Recusa aparelhos cujo perfil em profiles/ tem status online_server (ex.: A13), salvo com -Forcar.
param(
    [string]$Pacote = "com.supercell.brawlstars",
    [string]$Serial,
    [switch]$Forcar
)

. "$PSScriptRoot\..\common.ps1"

Write-Host "================================================================" -ForegroundColor Green
Write-Host "   OTIMIZADOR DE JOGO: $Pacote" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

$adb = Find-Adb
if (-not $adb) {
    Write-Host "[!] adb.exe nao encontrado. Instale o platform-tools ou o scrcpy, ou defina a variavel ADB." -ForegroundColor Red
    exit 1
}

$aparelhos = @(Get-AdbDevices $adb)
if (-not $Serial) {
    if ($aparelhos.Count -eq 0) {
        Write-Host "[!] Celular nao detectado. Conecte o cabo USB e ative a Depuracao USB." -ForegroundColor Red
        exit 1
    }
    if ($aparelhos.Count -gt 1) {
        Write-Host "[!] Mais de um aparelho conectado. Escolha com -Serial:" -ForegroundColor Yellow
        $aparelhos | ForEach-Object { Write-Host "    $_" }
        exit 1
    }
    $Serial = $aparelhos[0]
} elseif ($aparelhos -notcontains $Serial) {
    Write-Host "[!] Aparelho $Serial nao esta conectado/autorizado." -ForegroundColor Red
    exit 1
}

$perfil = Get-ProfileBySerial $Serial
if ($perfil -and $perfil.status -eq "online_server" -and -not $Forcar) {
    Write-Host "[!] $Serial e o perfil '$($perfil.id)', marcado como servidor. Nada foi alterado." -ForegroundColor Red
    Write-Host "    Use -Forcar se tiver certeza." -ForegroundColor Red
    exit 1
}

$instalado = & $adb -s $Serial shell "pm path $Pacote" 2>$null
if (-not $instalado) {
    Write-Host "[!] Pacote $Pacote nao esta instalado em $Serial." -ForegroundColor Red
    exit 1
}

function Sh([string]$c) { & $adb -s $Serial shell $c }

Write-Host "[1/4] Compilando $Pacote em codigo nativo (AOT speed)..."
Sh "cmd package compile -m speed -f $Pacote"

Write-Host "[2/4] Animacoes 0.5x e toque mais rapido (long press 250 ms)..."
Sh "settings put global window_animation_scale 0.5"
Sh "settings put global transition_animation_scale 0.5"
Sh "settings put global animator_duration_scale 0.5"
Sh "settings put system touch_sensitiveness 1"
Sh "settings put secure long_press_timeout 250"

Write-Host "[3/4] Wi-Fi sem scans de fundo e sem dormir..."
Sh "settings put global wifi_scan_always_enabled 0"
Sh "settings put global ble_scan_always_enabled 0"
Sh "settings put global wifi_sleep_policy 2"
Sh "cmd netpolicy set restrict-background false"

Write-Host "[4/4] Taxa de atualizacao e driver de GPU padrao..."
Sh "settings put secure refresh_rate_mode 1"
Sh "settings delete global game_driver_all_apps"
Sh "settings delete global updatable_driver_all_apps"
Sh "setprop debug.sf.latch_unsignaled 0"

Write-Host ""
Write-Host "[+] Pronto: $Pacote otimizado em $Serial." -ForegroundColor Green
