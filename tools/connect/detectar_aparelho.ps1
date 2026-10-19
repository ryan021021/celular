<#
.SYNOPSIS
    Detector Universal de Dispositivos Android (ADB).
    Gera perfis automaticos em profiles/ para qualquer celular plugado.
#>
[CmdletBinding()]
param(
    [switch]$AutoCriarPerfil
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\common.ps1"
$adb = Find-Adb
if (-not $adb) {
    Write-Error "ADB nao encontrado no sistema."
    exit 1
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "       DETECTOR UNIVERSAL DE DISPOSITIVOS ANDROID (ADB)             " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

$rawDevices = & $adb devices -l
$deviceLines = $rawDevices | Where-Object { $_ -match "\bdevice\b" -and $_ -notmatch "List of devices" }

if (-not $deviceLines) {
    Write-Host "[!] Nenhum dispositivo autorizado conectado via ADB." -ForegroundColor Yellow
    Write-Host "    Verifique o cabo USB e confirme o pop-up 'Permitir depuracao USB' na tela." -ForegroundColor Gray
    exit 0
}

$profilesDir = Join-Path $PSScriptRoot "..\..\profiles"
$existingProfiles = Get-ChildItem -Path $profilesDir -Filter "*.json" | Where-Object { $_.Name -ne "_template.json" }

foreach ($line in $deviceLines) {
    $parts = -split $line
    $serial = $parts[0]
    
    Write-Host "`n[*] Analisando dispositivo com serial: $serial..." -ForegroundColor Yellow
    
    $model = (& $adb -s $serial shell getprop ro.product.model).Trim()
    $brand = (& $adb -s $serial shell getprop ro.product.brand).Trim()
    $abi = (& $adb -s $serial shell getprop ro.product.cpu.abi).Trim()
    $androidVer = (& $adb -s $serial shell getprop ro.build.version.release).Trim()
    
    $matchedProfile = $null
    foreach ($p in $existingProfiles) {
        $pData = Get-Content $p.FullName -Raw | ConvertFrom-Json
        if ($pData.serial -eq $serial) {
            $matchedProfile = $pData
            break
        }
    }
    
    Write-Host "    Fabricante:    $brand" -ForegroundColor Green
    Write-Host "    Modelo:        $model" -ForegroundColor Green
    Write-Host "    Arquitetura:   $abi" -ForegroundColor Green
    Write-Host "    Android:       $androidVer" -ForegroundColor Green
    
    if ($matchedProfile) {
        Write-Host "    Perfil ativo:  $($matchedProfile.id) ($($matchedProfile.name))" -ForegroundColor Cyan
        Write-Host "    Para espelhar: .\tools\connect\connect.ps1 -Device $($matchedProfile.id) -Mode Mirror" -ForegroundColor White
    } else {
        $cleanId = ($model -replace "[^a-zA-Z0-9]", "").ToLower()
        if (-not $cleanId) { $cleanId = "device_" + $serial.Substring(0, 4) }
        $targetFile = Join-Path $profilesDir "$cleanId.json"
        
        Write-Host "    [NOVO] Dispositivo sem perfil cadastrado." -ForegroundColor Magenta
        
        $newProfile = [ordered]@{
            id = $cleanId
            name = "$brand $model"
            brand = $brand
            model = $model
            serial = $serial
            status = "connected_usb"
            hardware = @{
                architecture = $abi
            }
            network = @{
                ip = ""
                wifi_adb_port = 5555
                ssh_port = 8022
                ssh_user = ""
                ssh_key = ""
            }
            scrcpy_args = @("--no-audio", "--stay-awake")
            notes = "Perfil gerado automaticamente pelo Detector Universal."
        }
        
        $jsonContent = $newProfile | ConvertTo-Json -Depth 4
        Set-Content -Path $targetFile -Value $jsonContent -Encoding UTF8
        Write-Host "    [OK] Perfil criado automaticamente: profiles/$cleanId.json" -ForegroundColor Green
        Write-Host "    Para espelhar: .\tools\connect\connect.ps1 -Device $cleanId -Mode Mirror" -ForegroundColor White
    }
}

Write-Host "`n====================================================================" -ForegroundColor Cyan
