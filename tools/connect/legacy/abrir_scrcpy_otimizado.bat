@echo off
chcp 65001 >nul
title INICIAR SCRCPY - MODO TELA QUEBRADA OTIMIZADO
set SCRCPY_PATH=C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1

echo =================================================================
echo       INICIANDO SCRCPY (MODO ANTI-CRASH / TELA QUEBRADA)
echo =================================================================
echo.
echo Parametros ativados:
echo   - Sem audio (--no-audio): Evita o erro do MediaCodec da Samsung
echo   - Stay awake (--stay-awake): Impede o celular de bloquear
echo   - Desligar display fisico (--turn-screen-off): Economiza bateria
echo   - Max 1024px: Fluidez maxima em USB 2.0
echo.
echo Conecte o celular com depuracao USB ativa...
echo.

"%SCRCPY_PATH%\scrcpy.exe" --no-audio --stay-awake --turn-screen-off --max-size=1024 --video-bit-rate=4M

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo -------------------------------------------------------------
    echo Se nao abriu, tentando modo compativel simples...
    echo -------------------------------------------------------------
    "%SCRCPY_PATH%\scrcpy.exe" --no-audio
)

pause
