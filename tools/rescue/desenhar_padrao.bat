@echo off
chcp 65001 >nul
echo ========================================================
echo        DESENHAR PADRÃO DE DESBLOQUEIO VIA ADB
echo ========================================================
echo.
echo Veja a imagem na sua Área de Trabalho: mapa_padrao_desbloqueio.png
echo.
echo Pontos:
echo   1   2   3
echo   4   5   6
echo   7   8   9
echo.
set /p SEQ="Digite os números do seu padrão (ex: 14789 ou 12369): "
python "C:\Users\Ryanr\Desktop\desenhar_padrao.py" %SEQ%
pause
