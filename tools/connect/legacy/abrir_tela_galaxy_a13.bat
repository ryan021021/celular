@echo off
title Espelhamento Automatico Galaxy A13 (SM-A135M)
color 0a
echo ==========================================================
echo    SCRCPY AUTO-RECONNECT - GALAXY A13 (SM-A135M)
echo ==========================================================
echo O seu Galaxy A13 JA ESTA COM DEPURACAO ATIVADA!
echo Mantenha o cabo USB firme conectado.
echo.

cd /d "C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1"

:loop
echo [%time%] Aguardando reconectar Galaxy A13...
adb.exe wait-for-device
echo [%time%] Galaxy A13 detectado! Abrindo janela da tela...
scrcpy.exe --stay-awake --turn-screen-off --window-title "Galaxy A13 - Servidor VPS"
echo.
echo [%time%] Conexao caiu ou janela foi fechada. Reconectando em 2 segundos...
timeout /t 2 /nobreak >nul
goto loop
