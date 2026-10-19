. "$PSScriptRoot\..\..\common.ps1" 2>$null
$adb = if (Get-Command Find-Adb -ErrorAction SilentlyContinue) { Find-Adb } else { "adb" }
$scrcpy = if (Get-Command scrcpy -ErrorAction SilentlyContinue) { "scrcpy" } else { Join-Path (Split-Path $adb) "scrcpy.exe" }
$perfilA13 = Join-Path $PSScriptRoot "..\..\..\profiles\a13.json"
$targetSerial = if (Test-Path $perfilA13) { (Get-Content $perfilA13 -Raw | ConvertFrom-Json).serial } else { "" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " AGUARDANDO TOQUE NO GALAXY A13 (AUTORIZAR DEPURACAO USB) " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Dica: Dê toques com o polegar no meio do celular, ligeiramente para a direita e para baixo." -ForegroundColor White
Write-Host "Pressione Ctrl+C para parar a qualquer momento.`n" -ForegroundColor Gray

$tentativa = 0
while ($true) {
    $tentativa++
    $output = & $adb devices 2>$null | Out-String
    
    if ($targetSerial -and ($output -match "$targetSerial\s+device")) {
        Write-Host "`n>>> SUCESSO ABSOLUTO! CELULAR AUTORIZADO! <<<" -ForegroundColor Green
        [Console]::Beep(1200, 200)
        [Console]::Beep(1600, 400)
        Write-Host "Iniciando Scrcpy otimizado em tela cheia/janela..." -ForegroundColor Green
        Start-Process $scrcpy -ArgumentList "-s $targetSerial --no-audio --stay-awake --turn-screen-off --max-size=1024 --video-bit-rate=4M"
        break
    }
    elseif ($targetSerial -and ($output -match "$targetSerial\s+unauthorized")) {
        if ($tentativa % 5 -eq 0) {
            Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] Dialogo visivel! Toque na metade direita, meio da tela..." -ForegroundColor Yellow
        }
    }
    else {
        if ($tentativa % 5 -eq 0) {
            Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] Verificando conexao USB..." -ForegroundColor DarkGray
        }
    }
    Start-Sleep -Milliseconds 400
}
