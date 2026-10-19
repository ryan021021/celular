@echo off
chcp 65001 >nul
title CONECTAR SSH - SERVIDOR GALAXY A13
powershell -ExecutionPolicy Bypass -File "%~dp0tools\connect\connect.ps1" -Device a13 -Mode SSH
pause
