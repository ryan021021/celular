# Reativador de Apps Essenciais e Modulos de Configuracoes (A13)
# Mantem a maxima otimizacao desativando apenas lixo real, recuperando Meus Arquivos e Configs.
param(
    [string]$Device = "a13",
    [string]$Serial = ""
)

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

$pacotesEssenciais = @(
    # 1. Meus Arquivos e dependencias de ficheiros
    "com.sec.android.app.myfiles",
    "com.samsung.android.providers.trash",

    # 2. Modulos essenciais das Configuracoes (Bateria, Armazenamento, Memoria, Seguranca, Privacidade, Conta)
    "com.samsung.android.lool",
    "com.samsung.android.sm.devicesecurity",
    "com.samsung.android.privacydashboard",
    "com.samsung.android.mobileservice",
    "com.sec.android.app.personalization",
    "com.samsung.android.scpm",
    "com.samsung.android.mdx.kit",
    "com.samsung.android.mdx.quickboard",
    "com.samsung.android.app.smartcapture",

    # 3. Aplicacoes basicas do utilizador
    "com.sec.android.gallery3d",
    "com.sec.android.app.camera",
    "com.sec.android.app.clockpackage",
    "com.samsung.android.app.clockpack",
    "com.sec.android.app.popupcalculator",
    "com.samsung.android.app.contacts",
    "com.samsung.android.calendar",
    "com.android.providers.calendar",
    "com.samsung.android.app.notes",

    # 4. Servicos Google e Loja (para o menu 'Google' e gestao de contas nao falhar nas Configs)
    "com.google.android.gsf",
    "com.android.vending",
    "com.google.android.configupdater",
    "com.sec.android.app.samsungapps"
)

Write-Host "=== REATIVANDO APPS ESSENCIAIS E CONFIGURACOES NO A13 ($Serial) ===" -ForegroundColor Cyan
foreach ($pkg in $pacotesEssenciais) {
    $out = & $adb -s $Serial shell pm enable --user 0 $pkg 2>&1
    Write-Host "[$pkg] -> $out"
}

Write-Host "`n=== ESTADO ATUAL DOS PACOTES DESATIVADOS RESTANTES ===" -ForegroundColor Green
$desativados = & $adb -s $Serial shell pm list packages -d
Write-Host "Total de pacotes ainda desativados (otimizados/bloatware): $($desativados.Count)"
