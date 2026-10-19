# Funcoes compartilhadas dos scripts em tools/. Uso: . "$PSScriptRoot\..\common.ps1"
# Texto sem acentos de proposito: o PowerShell 5.1 le .ps1 sem BOM como ANSI.

# Ao ser carregado com ".", $PSScriptRoot aqui dentro e a pasta tools/.
$script:RaizProjeto = Split-Path -Parent $PSScriptRoot

# Procura o adb.exe, nesta ordem: $env:ADB, PATH, SDK do Android, scrcpy instalado pelo WinGet.
function Find-Adb {
    if ($env:ADB -and (Test-Path $env:ADB)) { return (Resolve-Path $env:ADB).Path }

    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidatos = @()
    foreach ($sdk in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA "Android\Sdk"))) {
        if ($sdk) { $candidatos += Join-Path $sdk "platform-tools\adb.exe" }
    }
    foreach ($c in $candidatos) { if (Test-Path $c) { return $c } }

    # scrcpy do WinGet traz o proprio adb; pega a versao mais nova instalada.
    $winget = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $winget) {
        $achado = Get-ChildItem -Path $winget -Filter adb.exe -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -like "*scrcpy*" } |
            Sort-Object FullName -Descending | Select-Object -First 1
        if ($achado) { return $achado.FullName }
    }
    return $null
}

# Lista os aparelhos em estado "device" (ignora offline/unauthorized).
function Get-AdbDevices([string]$Adb) {
    & $Adb devices 2>$null | Select-Object -Skip 1 |
        Where-Object { $_ -match "^(\S+)\s+device\b" } |
        ForEach-Object { $Matches[1] }
}

# Devolve o perfil de profiles/ cujo serial bate, ou $null.
function Get-ProfileBySerial([string]$Serial) {
    $dir = Join-Path $script:RaizProjeto "profiles"
    foreach ($f in Get-ChildItem -Path $dir -Filter *.json -ErrorAction SilentlyContinue) {
        if ($f.Name -like "_*") { continue }
        try { $p = Get-Content $f.FullName -Raw | ConvertFrom-Json } catch { continue }
        if ($p.serial -and $p.serial -eq $Serial) { return $p }
    }
    return $null
}
