[CmdletBinding()]
param(
    [string]$Device = "a13",
    [ValidateSet("SSH", "Mirror", "Status", "WifiADB", "Menu")]
    [string]$Mode = "Menu"
)

# Caminhos base
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$profilePath = Join-Path $projectRoot "profiles\$Device.json"

if (-not (Test-Path $profilePath)) {
    Write-Host "[ERRO] Perfil de dispositivo '$Device' nao encontrado em: $profilePath" -ForegroundColor Red
    exit 1
}

$profile = Get-Content $profilePath -Raw | ConvertFrom-Json

# Localizar ADB e Scrcpy dinamicamente
$scrcpyDir = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1"
$adb = Join-Path $scrcpyDir "adb.exe"
$scrcpy = Join-Path $scrcpyDir "scrcpy.exe"

if (-not (Test-Path $adb)) {
    $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($adbCmd) { $adb = $adbCmd.Source } else { $adb = "adb" }
}
if (-not (Test-Path $scrcpy)) {
    $scrcpyCmd = Get-Command scrcpy -ErrorAction SilentlyContinue
    if ($scrcpyCmd) { $scrcpy = $scrcpyCmd.Source } else { $scrcpy = "scrcpy" }
}

# T82: network.ip e so uma dica (o celular troca de rede). O achador confere a chave de host publica do perfil e devolve o IP atual.
# Roda uma vez por execucao, so quando alguem precisa do IP. Se nao achar, segue com o IP do perfil.
$script:ipResolvido = $false
function Resolve-AparelhoIp {
    if ($script:ipResolvido) { return }
    $script:ipResolvido = $true
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return }
    $prevEap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $achado = & node (Join-Path $projectRoot "tools\lib\achar-aparelho.mjs") --perfil $Device 2>$null
    $codigo = $LASTEXITCODE; $ErrorActionPreference = $prevEap
    if ($codigo -eq 0 -and "$achado" -match '^\d{1,3}(\.\d{1,3}){3}$') {
        if ("$achado" -ne "$($profile.network.ip)") { Write-Host "[achar] IP atual: $achado (o perfil diz $($profile.network.ip))" -ForegroundColor Yellow }
        $profile.network.ip = "$achado"
    } else { Write-Host "[AVISO] Achador nao encontrou o aparelho; usando o IP do perfil ($($profile.network.ip))." -ForegroundColor Yellow }
}

function Show-Header {
    Clear-Host
    Write-Host "====================================================================" -ForegroundColor Cyan
    Write-Host "       CENTRAL DE CONTROLE BARE-METAL - $($profile.name)           " -ForegroundColor Yellow
    Write-Host "====================================================================" -ForegroundColor Cyan
    Write-Host " Status:     $($profile.status.ToUpper())" -ForegroundColor Green
    Write-Host " Hardware:   $($profile.hardware.cpu) | $($profile.hardware.ram_total)" -ForegroundColor Gray
    Write-Host " Armazenam.: $($profile.hardware.storage_free) livres" -ForegroundColor Gray
    Write-Host " Rede Local: $($profile.network.ip):$($profile.network.ssh_port) (IP do perfil e so dica)" -ForegroundColor Cyan
    Write-Host "====================================================================`n" -ForegroundColor Cyan
}

function Connect-SSH {
    Write-Host "[*] Iniciando sessao SSH com $($profile.name)..." -ForegroundColor Yellow
    Resolve-AparelhoIp
    $ip = $profile.network.ip
    $port = $profile.network.ssh_port
    $user = $profile.network.ssh_user
    $key = [System.Environment]::ExpandEnvironmentVariables($profile.network.ssh_key.Replace("~", "%USERPROFILE%"))

    # Testar ping rapido ou porta
    $wifiOk = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($ip, $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(1500, $false)
        if ($wait -and $tcp.Connected) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            $wifiOk = $true
        }
    } catch {
        $wifiOk = $false
    }

    if ($wifiOk) {
        Write-Host "[+] Conectando diretamente via Wi-Fi ($($ip):$($port))..." -ForegroundColor Green
        ssh -i "$key" -p $port "$user@$ip"
    } else {
        Write-Host "[!] Wi-Fi offline ou porta bloqueada. Redirecionando via USB (ADB Port Forward)..." -ForegroundColor Yellow
        & $adb forward tcp:$port tcp:$port >$null 2>&1
        Write-Host "[+] Conectando via tunel USB local (127.0.0.1:$($port))..." -ForegroundColor Green
        ssh -i "$key" -p $port "$user@127.0.0.1"
    }
}

function Start-Mirror {
    Write-Host "[*] Iniciando espelhamento de tela (Scrcpy)..." -ForegroundColor Yellow
    $argsList = @()
    if ($profile.serial) {
        $argsList += "-s", $profile.serial
    }
    if ($profile.scrcpy_args) {
        $argsList += $profile.scrcpy_args
    }

    $proc = Start-Process -FilePath $scrcpy -ArgumentList $argsList -PassThru -Wait
    if ($proc.ExitCode -ne 0) {
        Write-Host "[!] USB falhou. Tentando conectar espelhamento via Wi-Fi ADB..." -ForegroundColor Yellow
        Resolve-AparelhoIp
        $wifiTarget = "$($profile.network.ip):$($profile.network.wifi_adb_port)"
        $wifiArgs = @("--tcpip=$wifiTarget") + $profile.scrcpy_args
        Start-Process -FilePath $scrcpy -ArgumentList $wifiArgs -Wait
    }
}

function Show-Status {
    Show-Header
    Write-Host "[*] Coletando metricas em tempo real do aparelho..." -ForegroundColor Yellow
    Write-Host "`n--- Status do ADB ---" -ForegroundColor Cyan
    & $adb devices -l

    Write-Host "`n--- Metricas do Sistema (via SSH) ---" -ForegroundColor Cyan
    Resolve-AparelhoIp
    $ip = $profile.network.ip
    $port = $profile.network.ssh_port
    $user = $profile.network.ssh_user
    $key = [System.Environment]::ExpandEnvironmentVariables($profile.network.ssh_key.Replace("~", "%USERPROFILE%"))
    
    ssh -o ConnectTimeout=3 -i "$key" -p $port "$user@$ip" "echo '[Uptime]'; uptime; echo ''; echo '[Memoria RAM]'; free -h; echo ''; echo '[Disco Flash]'; df -h /data | tail -n 1; echo ''; echo '[Carga CPU]'; top -b -n 1 | head -n 5" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Nao foi possivel consultar metricas via SSH direto." -ForegroundColor DarkGray
    }
    try {
        if ([Environment]::UserInteractive -and [Console]::IsInputRedirected -eq $false) {
            Write-Host "`nPressione Enter para continuar..." -ForegroundColor DarkGray
            [void][Console]::ReadLine()
        }
    } catch {}
}

function Enable-WifiAdb {
    Write-Host "[*] Ativando ADB sobre TCP/IP (Porta $($profile.network.wifi_adb_port))..." -ForegroundColor Yellow
    Resolve-AparelhoIp
    & $adb -s $profile.serial tcpip $profile.network.wifi_adb_port
    Start-Sleep -Seconds 1
    & $adb connect "$($profile.network.ip):$($profile.network.wifi_adb_port)"
    Write-Host "[+] ADB Wi-Fi pronto em $($profile.network.ip):$($profile.network.wifi_adb_port)!" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Roteamento de Modos
switch ($Mode) {
    "SSH"     { Connect-SSH }
    "Mirror"  { Start-Mirror }
    "Status"  { Show-Status }
    "WifiADB" { Enable-WifiAdb }
    "Menu"    {
        while ($true) {
            Show-Header
            Write-Host "Escolha uma opcao:" -ForegroundColor White
            Write-Host "  [1] Conectar Terminal SSH (Wi-Fi / USB automatico)" -ForegroundColor Green
            Write-Host "  [2] Espelhar Tela com Teclado e Mouse (Scrcpy)" -ForegroundColor Cyan
            Write-Host "  [3] Painel de Metricas em Tempo Real (CPU, RAM, Disco)" -ForegroundColor Yellow
            Write-Host "  [4] Reativar ADB via Wi-Fi (tcpip:5555)" -ForegroundColor Magenta
            Write-Host "  [0] Sair" -ForegroundColor DarkGray
            Write-Host ""
            $op = Read-Host "Digite a opcao desejada"
            switch ($op) {
                "1" { Connect-SSH }
                "2" { Start-Mirror }
                "3" { Show-Status }
                "4" { Enable-WifiAdb }
                "0" { exit 0 }
                default { Write-Host "Opcao invalida!" -ForegroundColor Red; Start-Sleep -Seconds 1 }
            }
        }
    }
}
