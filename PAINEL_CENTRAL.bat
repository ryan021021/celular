@echo off
chcp 65001 >nul
title CENTRAL DE CONTROLE - BARE METAL SERVERS
powershell -ExecutionPolicy Bypass -File "%~dp0tools\connect\connect.ps1" -Device a13 -Mode Menu
