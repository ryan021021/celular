@echo off
chcp 65001 >nul
title ESPELHAR TELA - SCRCPY
powershell -ExecutionPolicy Bypass -File "%~dp0tools\connect\connect.ps1" -Device a13 -Mode Mirror
pause
