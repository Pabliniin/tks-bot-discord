@echo off
rem ============================================================
rem  TK$ Bot - Subir el proyecto a GitHub
rem
rem  Necesario para desplegarlo en Easypanel, que despliega
rem  desde un repositorio.
rem
rem  Haz doble clic. Te ira preguntando lo que necesite.
rem ============================================================

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title TK$ Bot - Subir a GitHub

cd /d "%~dp0"

echo.
echo  ==========================================
echo    Subir TK$ Bot a GitHub
echo  ==========================================
echo.

rem -- 1. Comprobar que Git esta instalado --------------------
where git >nul 2>&1
if errorlevel 1 (
    echo  [X] No se encuentra Git.
    echo.
    echo      Descargalo desde https://git-scm.com/download/win
    echo      Instalalo con las opciones por defecto y vuelve a
    echo      ejecutar este archivo.
    echo.
    pause
    exit /b 1
)
echo  [OK] Git instalado

rem -- 2. Identidad de Git ------------------------------------
for /f "tokens=*" %%n in ('git config --global user.name 2^>nul') do set GIT_NAME=%%n
for /f "tokens=*" %%e in ('git config --global user.email 2^>nul') do set GIT_EMAIL=%%e

if "!GIT_NAME!"=="" (
    echo.
    echo  Git necesita saber quien eres para poder guardar los cambios.
    echo.
    set /p GIT_NAME="  Tu nombre (por ejemplo Pablo): "
    if "!GIT_NAME!"=="" (
        echo  [X] No has escrito nada. Cancelado.
        pause
        exit /b 1
    )
    git config --global user.name "!GIT_NAME!"
)

if "!GIT_EMAIL!"=="" (
    set /p GIT_EMAIL="  Tu correo de GitHub: "
    if "!GIT_EMAIL!"=="" (
        echo  [X] No has escrito nada. Cancelado.
        pause
        exit /b 1
    )
    git config --global user.email "!GIT_EMAIL!"
)
echo  [OK] Identidad: !GIT_NAME! ^<!GIT_EMAIL!^>

rem -- 3. URL del repositorio ---------------------------------
for /f "tokens=*" %%u in ('git remote get-url origin 2^>nul') do set REPO_URL=%%u

if "!REPO_URL!"=="" (
    echo.
    echo  ------------------------------------------
    echo   Crea el repositorio en GitHub
    echo  ------------------------------------------
    echo.
    echo   1. Abre  https://github.com/new
    echo   2. Nombre del repositorio: tkbot
    echo   3. Marca  PRIVATE  ^(privado^)
    echo   4. NO marques nada mas ^(ni README, ni .gitignore, ni licencia^)
    echo   5. Pulsa "Create repository"
    echo   6. Copia la URL que te muestra, del estilo:
    echo        https://github.com/tu-usuario/tkbot.git
    echo.
    set /p REPO_URL="  Pega aqui la URL: "

    if "!REPO_URL!"=="" (
        echo.
        echo  [X] No has pegado ninguna URL. Cancelado.
        pause
        exit /b 1
    )
)

rem -- 4. Preparar el repositorio local -----------------------
echo.
if not exist ".git\" (
    echo  [..] Creando el repositorio local...
    git init -b main
    if errorlevel 1 goto error
) else (
    echo  [OK] El repositorio local ya existe
)

rem Enlazar con GitHub (o actualizar el enlace si ya existia).
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "!REPO_URL!"
) else (
    git remote set-url origin "!REPO_URL!"
)
echo  [OK] Enlazado con !REPO_URL!

rem -- 5. Comprobar que no se sube ningun secreto -------------
echo.
echo  [..] Comprobando que no se suba ningun archivo .env...
git add -A
git diff --cached --name-only > "%TEMP%\tkbot-archivos.txt"

rem Busca cualquier archivo que termine en .env o .env.local
rem (.env.example si puede subirse: no lleva claves reales).
findstr /R /C:"\.env$" /C:"\.env\.local$" "%TEMP%\tkbot-archivos.txt" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo  [X] PELIGRO: se iba a subir un archivo .env con tus claves.
    echo.
    echo      Revisa el archivo .gitignore antes de continuar.
    echo      Cancelado por seguridad.
    echo.
    git reset >nul 2>&1
    del "%TEMP%\tkbot-archivos.txt" >nul 2>&1
    pause
    exit /b 1
)

for /f %%c in ('type "%TEMP%\tkbot-archivos.txt" ^| find /c /v ""') do set NUM_ARCHIVOS=%%c
del "%TEMP%\tkbot-archivos.txt" >nul 2>&1
echo  [OK] Ningun .env en la lista. !NUM_ARCHIVOS! archivos preparados.

rem -- 6. Guardar los cambios ---------------------------------
echo.
echo  [..] Guardando los cambios...
git diff --cached --quiet
if not errorlevel 1 (
    echo  [OK] No hay cambios nuevos que guardar
) else (
    git commit -m "TK$ Bot - bot de Discord y panel de control"
    if errorlevel 1 goto error
    echo  [OK] Cambios guardados
)

rem -- 7. Subir a GitHub --------------------------------------
echo.
echo  [..] Subiendo a GitHub...
echo.
echo   Si es la primera vez, se abrira una ventana del navegador
echo   para que inicies sesion en GitHub. Autorizalo y vuelve aqui.
echo.

git push -u origin main
if errorlevel 1 goto errorpush

echo.
echo  ==========================================
echo    Subido correctamente
echo  ==========================================
echo.
echo   Tu repositorio: !REPO_URL!
echo.
echo   Siguiente paso: sigue la guia EASYPANEL.md
echo   para crear los tres servicios en Easypanel.
echo.
pause
exit /b 0

:errorpush
echo.
echo  [X] Fallo al subir a GitHub.
echo.
echo   Causas mas habituales:
echo.
echo    - La URL del repositorio esta mal escrita.
echo    - El repositorio no esta vacio. Si marcaste "Add a README"
echo      al crearlo, ejecuta esto y vuelve a intentarlo:
echo         git pull origin main --allow-unrelated-histories
echo    - No has iniciado sesion en GitHub cuando te lo pidio.
echo.
pause
exit /b 1

:error
echo.
echo  [X] Algo ha fallado. Lee el mensaje de arriba.
echo.
pause
exit /b 1
