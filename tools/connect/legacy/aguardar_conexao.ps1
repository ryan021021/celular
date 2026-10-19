$adb = "C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\adb.exe"
$scrcpy = "C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe"

Write-Output "=========================================================="
Write-Output "   MONITOR AUTOMATICO: AGUARDANDO DEPURACAO USB / TOUCH   "
Write-Output "=========================================================="
Write-Output "Assim que voce tocar na tela ou autorizar, o Scrcpy vai abrir a tela sozinho!"
Write-Output ""

while ($true) {
    $devices = & $adb devices
    $lines = $devices -split "`r?`n" | Where-Object { $_ -match '\t(device|unauthorized)' }
    
    if ($lines) {
        Write-Output "DISPOSITIVO DETECTADO NO ADB!"
        Write-Output $lines
        
        if ($lines -match '\tdevice') {
            [Console]::Beep(1000, 500)
            Write-Output "SUCESSO TOTAL! Abrindo tela com Scrcpy..."
            & $scrcpy --stay-awake
            break
        } elseif ($lines -match '\tunauthorized') {
            [Console]::Beep(500, 300)
            Write-Output "AVISO: Celular detectado mas esta como 'unauthorized'!"
            Write-Output "-> Toque no canto inferior direito da tela para clicar em 'OK'!"
        }
    }
    Start-Sleep -Seconds 2
}
