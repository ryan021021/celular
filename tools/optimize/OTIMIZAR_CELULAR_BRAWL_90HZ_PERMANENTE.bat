@echo off
title OTIMIZADOR ESTAVEL - BRAWL STARS ZERO LAG
color 0A
rem Agora delega para otimizar_jogo.ps1 (generico). Outro jogo: otimizar_jogo.ps1 -Pacote <pacote>
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0otimizar_jogo.ps1" -Pacote com.supercell.brawlstars %*
timeout /t 3 >nul
