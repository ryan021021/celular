@echo off
chcp 65001 >nul
title AUTORIZADOR AUTOMATICO GALAXY A13
echo Iniciando monitoramento em tempo real...
powershell -ExecutionPolicy Bypass -File "%~dp0monitor_e_abrir.ps1"
pause
