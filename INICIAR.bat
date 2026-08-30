@echo off
rem ============================================================
rem  TK$ Bot - Arranque completo (bot + panel web)
rem
rem  Haz doble clic en este archivo.
rem  Comprueba la configuracion, instala lo que falte, registra
rem  los comandos y arranca el bot y la web a la vez.
rem ============================================================

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title TK$ Bot

rem Situarse en la carpeta del proyecto, sea cual sea desde donde se ejecute.
cd /d "%~dp0"

echo.
echo  ==========================================
echo    TK$ Bot
echo  ==========================================
echo.

rem -- 1. Comprobar que Node.js esta instalado ----------------
where node >nul 2>&1
if errorlevel 1 (
    echo  [X] No se encuentra Node.js.
    echo.
    echo      Descargalo desde https://nodejs.org
    echo      Elige la version LTS, instalala y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [OK] Node.js !NODE_VERSION!

rem Avisar si la version es anterior a la 20.
for /f "tokens=1 delims=." %%m in ("!NODE_VERSION:v=!") do set NODE_MAJOR=%%m
if !NODE_MAJOR! LSS 20 (
    echo.
    echo  [!] Tu version de Node.js es antigua. Se necesita la 20 o superior.
    echo      Actualizala desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

rem -- 2. Instalar dependencias si hace falta -----------------
if not exist "node_modules\" (
    echo.
    echo  [..] Primera vez: instalando dependencias.
    echo       Esto tarda un par de minutos, solo ocurre una vez.
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  [X] Fallo la instalacion de dependencias.
        echo      Revisa tu conexion a internet y vuelve a intentarlo.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencias instaladas
) else (
    echo  [OK] Dependencias ya instaladas
)

rem -- 3. Comprobar el archivo .env ---------------------------
echo.
call node scripts\check-env.js --db
if errorlevel 1 (
    echo.
    echo  ==========================================
    echo    Falta configuracion
    echo  ==========================================
    echo.
    echo  Abriendo el archivo .env en el Bloc de notas...
    echo  Rellena los campos que se indican arriba, guarda
    echo  el archivo, cierralo y vuelve a ejecutar INICIAR.bat
    echo.
    timeout /t 3 >nul
    if exist ".env" start "" notepad ".env"
    pause
    exit /b 1
)

rem -- 4. Registrar los comandos de barra (solo la primera vez) -
if not exist ".comandos-registrados" (
    echo.
    echo  [..] Registrando los comandos de barra en Discord...
    echo.
    call npm run gen:commands >nul 2>&1
    call npm run deploy
    if errorlevel 1 (
        echo.
        echo  [!] No se pudieron registrar los comandos de barra.
        echo      Los comandos con prefijo ^(-help^) funcionaran igualmente.
        echo      Comprueba DISCORD_DEV_GUILD_ID en el .env y ejecuta
        echo      REGISTRAR-COMANDOS.bat cuando lo tengas.
        echo.
        timeout /t 4 >nul
    ) else (
        echo Registrados > ".comandos-registrados"
        echo.
        echo  [OK] Comandos de barra registrados
    )
) else (
    echo  [OK] Comandos de barra ya registrados
)

rem -- 5. Arrancar bot y web a la vez -------------------------
echo.
echo  ==========================================
echo    Arrancando
echo  ==========================================
echo.
echo   Panel web:  http://localhost:3000
echo.
echo   Para detenerlo: pulsa Ctrl+C en esta ventana
echo   NO cierres esta ventana mientras lo uses.
echo.
echo  ------------------------------------------
echo.

rem Abre el navegador pasados unos segundos, cuando la web ya responda.
start "" /b cmd /c "timeout /t 12 >nul & start "" http://localhost:3000"

rem `npm run dev` levanta los dos procesos con concurrently.
call npm run dev

rem Si llega aqui es que se detuvo o fallo.
echo.
echo  ------------------------------------------
echo   Los procesos se han detenido.
echo  ------------------------------------------
echo.
pause
endlocal
