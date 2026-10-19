$adb = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\adb.exe"
$scrcpy = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " AGUARDANDO TOQUE NO GALAXY A13 (AUTORIZAR DEPURACAO USB) " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Dica: Dê toques com o polegar no meio do celular, ligeiramente para a direita e para baixo." -ForegroundColor White
Write-Host "Pressione Ctrl+C para parar a qualquer momento.`n" -ForegroundColor Gray

$tentativa = 0
while ($true) {
    $tentativa++
    $output = & $adb devices 2>$null | Out-String
    
    if ($output -match "RQ8TC00EJNB\s+device") {
        Write-Host "`n>>> SUCESSO ABSOLUTO! CELULAR AUTORIZADO! <<<" -ForegroundColor Green
        [Console]::Beep(1200, 200)
        [Console]::Beep(1600, 400)
        Write-Host "Iniciando Scrcpy otimizado em tela cheia/janela..." -ForegroundColor Green
        Start-Process $scrcpy -ArgumentList "-s RQ8TC00EJNB --no-audio --stay-awake --turn-screen-off --max-size=1024 --video-bit-rate=4M"
        break
    }
    elseif ($output -match "RQ8TC00EJNB\s+unauthorized") {
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
