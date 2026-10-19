@echo off
title Detector e Espelhador de Celular sem Tela (Scrcpy + ADB)
color 0b
echo ===================================================================
echo     DETECTOR E ESPELHADOR DE CELULAR SEM TELA (24/7 VPS SETUP)
echo ===================================================================
echo.
cd /d "C:\Users\Ryanr\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1"

:menu
echo [1] Verificar se o celular foi reconhecido (adb devices)
echo [2] Tentar abrir a TELA do celular no PC (scrcpy normal)
echo [3] Tentar modo OTG (Controlar com Teclado/Mouse do PC se a depuracao estiver desligada)
echo [4] Instalar Termux silenciosamente via USB
echo [5] Abrir terminal ADB Shell direto no celular
echo [6] Sair
echo.
set /p opt="Escolha uma opcao (1-6): "

if "%opt%"=="1" (
    echo.
    echo Buscando celulares conectados via USB...
    adb.exe devices -l
    echo.
    pause
    goto menu
)

if "%opt%"=="2" (
    echo.
    echo Tentando espelhar a tela do celular para o Windows...
    scrcpy.exe --turn-screen-off --stay-awake
    echo.
    pause
    goto menu
)

if "%opt%"=="3" (
    echo.
    echo Iniciando modo OTG (Emulador de teclado e mouse fisico USB)...
    echo Pressione Teclas no teclado do PC para navegar no celular.
    scrcpy.exe --otg
    echo.
    pause
    goto menu
)

if "%opt%"=="4" (
    echo.
    echo Baixando e instalando Termux direto no celular...
    curl -L -o termux.apk "https://github.com/termux/termux-app/releases/download/v0.118.1/termux-app_v0.118.1+github-debug_arm64-v8a.apk"
    adb.exe install -r termux.apk
    echo.
    echo Abrindo o Termux no celular...
    adb.exe shell am start -n com.termux/.app.TermuxActivity
    echo Termux instalado e iniciado com sucesso!
    pause
    goto menu
)

if "%opt%"=="5" (
    echo.
    echo Abrindo ADB Shell...
    adb.exe shell
    goto menu
)

if "%opt%"=="6" exit
