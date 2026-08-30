@echo off
rem ============================================================
rem  TK$ Bot - Registrar los comandos de barra en Discord
rem
rem  Ejecuta este archivo cuando anadas o cambies un comando,
rem  o si los comandos con / no te aparecen en Discord.
rem ============================================================

chcp 65001 >nul 2>&1
setlocal
title TK$ Bot - Registrar comandos

cd /d "%~dp0"

echo.
echo  ==========================================
echo    Registrar comandos de barra
echo  ==========================================
echo.
echo   1. Solo en mi servidor de pruebas  (inmediato)
echo   2. En todos los servidores         (tarda hasta 1 hora)
echo   3. Borrar todos los comandos
echo.
set /p OPCION="  Elige una opcion [1/2/3]: "

echo.
echo  [..] Actualizando el catalogo de comandos de la web...
call npm run gen:commands
if errorlevel 1 goto error

echo.
if "%OPCION%"=="2" (
    echo  [..] Registrando globalmente...
    call npm run deploy:global
) else if "%OPCION%"=="3" (
    echo  [..] Borrando los comandos...
    call npm run deploy --workspace @tkbot/bot -- --clear
) else (
    echo  [..] Registrando en el servidor de pruebas...
    call npm run deploy
)

if errorlevel 1 goto error

rem Marca para que INICIAR.bat no vuelva a registrarlos solo.
echo Registrados > ".comandos-registrados"

echo.
echo  [OK] Hecho.
echo.
echo   Si no ves los comandos en Discord, cierra la aplicacion
echo   por completo y vuelve a abrirla.
echo.
pause
exit /b 0

:error
echo.
echo  [X] Algo ha fallado.
echo.
echo   Comprueba en el archivo .env:
echo     - DISCORD_TOKEN y DISCORD_CLIENT_ID estan bien copiados
echo     - DISCORD_DEV_GUILD_ID tiene el ID de tu servidor
echo       ^(solo necesario para la opcion 1^)
echo.
pause
exit /b 1
