@echo off
chcp 65001 >nul
title INSTALAR SERVIDOR 24/7 NO CELULAR
set DEVICE=%1
if "%DEVICE%"=="" set DEVICE=a13
powershell -ExecutionPolicy Bypass -File "%~dp0tools\server\deploy.ps1" -Device %DEVICE%
pause
