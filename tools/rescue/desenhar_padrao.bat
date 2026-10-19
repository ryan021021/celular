@echo off
chcp 65001 >nul
echo ========================================================
echo        DESENHAR PADRAO DE DESBLOQUEIO VIA ADB
echo ========================================================
echo.
echo Veja o mapa de pontos abaixo:
echo.
echo Pontos:
echo   1   2   3
echo   4   5   6
echo   7   8   9
echo.
set /p SEQ="Digite os numeros do seu padrao (ex: 14789 ou 12369): "
python "%~dp0desenhar_padrao.py" %SEQ%
pause
