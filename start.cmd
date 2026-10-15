@echo off
REM Doble clic para tener Pulso Taller en marcha en local.
REM
REM Hace lo mismo que `npm start`: levanta los contenedores de Convex, prepara el
REM entorno, despliega las funciones, arranca la app y comprueba que todo
REM responde. Al terminar queda la URL en pantalla, y esta ventana no se cierra
REM sola para que se pueda leer.
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encuentra npm. Instala Node 20 o superior desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

if "%~1"=="" (
  call npm start
) else (
  call npm run local -- %*
)
set "code=%ERRORLEVEL%"

if not "%code%"=="0" (
  echo.
  echo El arranque no ha terminado bien. Para arreglar el entorno sin tocar los datos:
  echo     npm run local -- --repair
  echo O desde PowerShell:
  echo     .\start.ps1 -Repair
)

echo.
pause
exit /b %code%
