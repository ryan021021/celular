[CmdletBinding()]
param(
    [string]$Device = "a13",
    [ValidateSet("Check", "Push", "Install", "Start", "Test", "Health", "All")]
    [string]$Step = "All",
    [switch]$DryRun
)
# Envia server/ para o celular e instala o servidor 24/7 (Termux + server-box).
# Le IP/porta/usuario/chave de profiles/<Device>.json. Cada passo pode rodar sozinho.
#   .\deploy.ps1 -Step Check          -> so testa a conexao
#   .\deploy.ps1                      -> tudo, na ordem
#   .\deploy.ps1 -DryRun              -> mostra os comandos sem executar

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$profilePath = Join-Path $root "profiles\$Device.json"
if (-not (Test-Path $profilePath)) { Write-Host "[ERRO] Perfil nao encontrado: $profilePath" -ForegroundColor Red; exit 1 }
$dev = Get-Content $profilePath -Raw | ConvertFrom-Json
$net = $dev.network
if (-not $net -or -not $net.ip -or -not $net.ssh_user) { Write-Host "[ERRO] Perfil '$Device' sem network.ip / network.ssh_user." -ForegroundColor Red; exit 1 }

$port = if ($net.ssh_port) { $net.ssh_port } else { 8022 }
$key = $net.ssh_key -replace '^~', $env:USERPROFILE
$target = "$($net.ssh_user)@$($net.ip)"
$sshOpts = @("-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=accept-new", "-i", $key, "-p", $port)

function Run($exe, [string[]]$argv) {
    Write-Host "  > $exe $($argv -join ' ')" -ForegroundColor DarkGray
    if ($DryRun) { return }
    & $exe @argv
    if ($LASTEXITCODE -ne 0) { throw "$exe falhou (codigo $LASTEXITCODE)" }
}
function Remote([string]$cmd) { Run "ssh" ($sshOpts + @($target, $cmd)) }

function Step-Check {
    Write-Host "[1/5] Testando SSH em $($net.ip):$port ..." -ForegroundColor Cyan
    Remote "echo conectado: `$(whoami) em `$(uname -m); node --version"
}
function Step-Push {
    Write-Host "[2/5] Enviando server/termux, server/agentops, server/discovery e o painel (git) ..." -ForegroundColor Cyan
    Remote "mkdir -p ~/servidor/logs ~/servidor/panel"
    $scpOpts = @("-o", "StrictHostKeyChecking=accept-new", "-i", $key, "-P", $port, "-r")
    # agentops: so o codigo; a fila (agentops-data) e o token ficam fora da pasta e nao sao tocados (achado G1)
    Run "scp" ($scpOpts + @((Join-Path $root "server\termux"), (Join-Path $root "server\agentops"), "${target}:servidor/"))
    # T74: server/discovery/detect.mjs com conferencia de sha256 (o painel precisa dele para /api/v1/capabilities). Antes do push, que reinicia o painel.
    Run "bash" @((Join-Path $PSScriptRoot "sync-discovery.sh"), $target, "$port", ($key.Replace([char]92, '/')))
    # Painel vai por git, nunca por scp (scp por cima estragaria o .git do celular)
    $repo = Join-Path $root "server\panel\server-box"
    Remote "cd ~/servidor/panel && { [ -d server-box/.git ] || git clone -q https://github.com/felipenalves/server-box.git server-box; } && cd server-box && git config receive.denyCurrentBranch updateInstead && { git switch -q celular 2>/dev/null || git switch -q -c celular; }"
    Run "git" @("-C", $repo, "push", "-f", "ssh://${target}:$port/~/servidor/panel/server-box", "celular")
}
function Step-Install {
    Write-Host "[3/5] Instalando pacotes, boot e cron ..." -ForegroundColor Cyan
    Remote "cd ~/servidor/termux && sed -i 's/\r$//' *.sh crontab.example && sh setup.sh"
    Remote "cp ~/servidor/termux/boot.sh ~/.termux/boot/boot.sh && chmod +x ~/.termux/boot/boot.sh && cp ~/servidor/termux/start-services.sh ~/servidor/termux/watchdog.sh ~/servidor/"
    Remote "cp ~/servidor/termux/git-hooks/post-receive ~/servidor/panel/server-box/.git/hooks/post-receive && chmod +x ~/servidor/panel/server-box/.git/hooks/post-receive"
    # Acrescenta as linhas do projeto SEM apagar crons que ja existem
    Remote "(crontab -l 2>/dev/null | grep -v 'servidor/watchdog.sh' | grep -v 'servidor/logs/clean.log'; grep -v '^#' ~/servidor/termux/crontab.example) | crontab -"
    Write-Host "  ! Abra o app Termux:Boot uma vez no celular (so precisa 1 vez)." -ForegroundColor Yellow
}
function Step-Start {
    Write-Host "[4/5] Subindo o painel ..." -ForegroundColor Cyan
    Remote "sh ~/servidor/start-services.sh; sleep 2; SVDIR=`$PREFIX/var/service sv status server-box"
}
function Step-Test {
    Write-Host "[5/5] Rodando testes do server-box no celular ..." -ForegroundColor Cyan
    Remote "cd ~/servidor/panel/server-box && node --test test/*.test.mjs 2>&1 | tail -n 8"
}
function Step-Health {
    Write-Host "[ok?] Checando /health ..." -ForegroundColor Cyan
    Remote "curl -sf -m 3 http://127.0.0.1:8080/health && echo && crontab -l"
    Write-Host "  Painel: http://$($net.ip):8080" -ForegroundColor Green
}

try {
    switch ($Step) {
        "Check"   { Step-Check }
        "Push"    { Step-Push }
        "Install" { Step-Install }
        "Start"   { Step-Start }
        "Test"    { Step-Test }
        "Health"  { Step-Health }
        "All"     { Step-Check; Step-Push; Step-Install; Step-Start; Step-Test; Step-Health }
    }
    Write-Host "[PRONTO] $Step concluido." -ForegroundColor Green
} catch {
    Write-Host "[FALHOU] $_" -ForegroundColor Red
    Write-Host "Dica: sem Wi-Fi? rode 'adb forward tcp:$port tcp:$port' e troque network.ip para 127.0.0.1 temporariamente." -ForegroundColor Yellow
    exit 1
}
