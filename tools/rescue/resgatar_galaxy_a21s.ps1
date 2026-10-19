. (Join-Path $PSScriptRoot "..\common.ps1") 2>$null
$adb = if (Get-Command Find-Adb -ErrorAction SilentlyContinue) { Find-Adb } else { "adb" }
$scrcpy = if (Get-Command scrcpy -ErrorAction SilentlyContinue) { "scrcpy" } else { Join-Path (Split-Path $adb) "scrcpy.exe" }

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "     RESGATE DO GALAXY A21s: MONITOR AUTOMÁTICO EM LOOP CONTÍNUO   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Este script fica em loop infinito forçando o pop-up de depuração aparecer"
Write-Host "e apitando no seu ouvido assim que ele surgir na tela do celular!"
Write-Host ""

$iteration = 0

while ($true) {
    $iteration++
    $devicesOutput = & $adb devices -l 2>&1
    $deviceLine = $devicesOutput -split "`r?`n" | Where-Object { $_ -match '\t(device|unauthorized|offline)' }
    
    $samsungUsb = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match "SAMSUNG Mobile" -or $_.InstanceId -match "04E8" }

    if ($deviceLine -match '\tunauthorized') {
        [Console]::Beep(1500, 300)
        Clear-Host
        Write-Host "==================================================================" -ForegroundColor Red
        Write-Host "  🚨 POP-UP DETECTADO NA TELA DO A21s NESTE EXATO MOMENTO! 🚨" -ForegroundColor Yellow
        Write-Host "==================================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "TOQUE AGORA NO VIDRO DO GALAXY A21s NO LOCAL INDICADO ABAIXO:" -ForegroundColor Green
        Write-Host ""
        Write-Host "       +---------------------------------+" -ForegroundColor Cyan
        Write-Host "       |           [ CÂMERA ]            |" -ForegroundColor Cyan
        Write-Host "       |                                 |" -ForegroundColor Cyan
        Write-Host "       |   Permitir a depuração USB?     |" -ForegroundColor Cyan
        Write-Host "       |                                 |" -ForegroundColor Cyan
        Write-Host "       |   [x] Sempre permitir           |" -ForegroundColor Cyan
        Write-Host "       |                                 |" -ForegroundColor Cyan
        Write-Host "       |   [ Cancelar ]     [  OK  ]     |  <-- TOQUE AQUI NO MEIO-DIREITO!" -ForegroundColor Yellow
        Write-Host "       |                                 |" -ForegroundColor Cyan
        Write-Host "       |     |||          O          <   |" -ForegroundColor Cyan
        Write-Host "       +---------------------------------+" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "DICA: Dê vários toques rápidos com o polegar direito no meio/inferior da tela!"
        Write-Host "Forçando o pop-up a continuar ativo via ADB..."
        
        & $adb reconnect 2>$null
        Start-Sleep -Seconds 1
        continue
    }
    elseif ($deviceLine -match '\tdevice') {
        [Console]::Beep(1000, 200)
        [Console]::Beep(1400, 200)
        [Console]::Beep(1800, 400)
        Clear-Host
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host "  🎉 SUCESSO TOTAL! GALAXY A21s AUTORIZADO E LIBERADO! 🎉" -ForegroundColor Yellow
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host "Abrindo a tela com Scrcpy..."
        
        $targetDir = Join-Path $PSScriptRoot "..\..\assets\screenshots\sessao-a21s"
        if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
        $targetFile = Join-Path $targetDir "a21s_sucesso.png"
        & $adb shell screencap -p /sdcard/a21s_sucesso.png 2>$null
        & $adb pull /sdcard/a21s_sucesso.png $targetFile 2>$null
        
        & $scrcpy --stay-awake
        break
    }
    else {
        if ($samsungUsb) {
            Write-Host -NoNewline "`r[$iteration] Samsung A21s detectado no USB (Modem COM6 e MTP ativos). Forçando ADB..."
            if ($iteration % 4 -eq 0) {
                & $adb reconnect 2>$null
            }
        } else {
            Write-Host -NoNewline "`r[$iteration] Conecte o Galaxy A21s no cabo USB do computador..."
        }
    }
    
    Start-Sleep -Milliseconds 600
}
