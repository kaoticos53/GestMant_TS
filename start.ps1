<#
.SYNOPSIS
  Script de inicio rápido de Pulso Taller para Windows (PowerShell).

.DESCRIPTION
  Levanta los contenedores de Convex (Docker), prepara el entorno (.env.local),
  despliega las funciones y el esquema, arranca el servidor Vite de desarrollo
  y abre la aplicación en el navegador.

.PARAMETER Repair
  Repara el entorno sin tocar la base de datos (restaura claves caducadas,
  variables de entorno o contenedores detenidos).

.PARAMETER Fresh
  Reinicia completamente la base de datos local y carga datos de demostración.

.PARAMETER Check
  Solo comprueba la salud del entorno y los servicios sin arrancar nada nuevo.

.PARAMETER NoOpen
  No abre automáticamente el navegador al completar el arranque.

.PARAMETER TakeOver
  Cierra observadores externos huérfanos y toma el control de los procesos.

.EXAMPLE
  .\start.ps1
  Arranque estándar de la aplicación.

.EXAMPLE
  .\start.ps1 -Repair
  Repara el entorno si algún contenedor o clave quedó desincronizada.

.EXAMPLE
  .\start.ps1 -Check
  Verifica el estado de los servicios locales.
#>

[CmdletBinding()]
param(
  [switch]$Repair,
  [switch]$Fresh,
  [switch]$Check,
  [switch]$NoOpen,
  [switch]$TakeOver
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $RepoRoot

function Write-Step($title) {
  Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Write-Success($message) {
  Write-Host "  [OK] $message" -ForegroundColor Green
}

function Write-WarnMessage($message) {
  Write-Host "  [AVISO] $message" -ForegroundColor Yellow
}

function Write-ErrorMessage($message) {
  Write-Host "`n  [ERROR] $message" -ForegroundColor Red
}

Write-Step "Pulso Taller - Sistema de Gestión de Mantenimiento"
Write-Host "Iniciando entorno local para Windows..." -ForegroundColor Gray

# 1. Comprobación de Node.js y npm
try {
  $npmVersion = npm --version 2>$null
  if (-not $npmVersion) {
    throw "npm no encontrado"
  }
  $nodeVersion = node --version 2>$null
  Write-Success "Node.js $nodeVersion y npm $npmVersion detectados"
}
catch {
  Write-ErrorMessage "No se encontró Node.js o npm en el PATH del sistema."
  Write-Host "Por favor instala Node.js 20 LTS o superior desde https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}

# 2. Comprobación de Docker
try {
  $dockerInfo = docker info 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-WarnMessage "Docker está instalado pero el demonio (Docker Desktop) parece no estar iniciado."
    Write-Host "  Asegúrate de que Docker Desktop esté en ejecución antes de continuar." -ForegroundColor Yellow
  }
  else {
    Write-Success "Motor Docker en ejecución y accesible"
  }
}
catch {
  Write-WarnMessage "No se detectó el comando 'docker'. Pulso Taller utiliza Docker para el backend local de Convex."
  Write-Host "  Puedes descargarlo desde https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
}

# 3. Construcción de argumentos para local-dev.mjs
$nodeArgs = @("scripts/local-dev.mjs")

if ($Repair) {
  $nodeArgs += "--repair"
  Write-Host "Modo: Reparación del entorno (sin tocar datos)" -ForegroundColor Magenta
}
if ($Fresh) {
  $nodeArgs += "--fresh"
  Write-Host "Modo: Reinstalación limpia (datos demo)" -ForegroundColor Magenta
}
if ($Check) {
  $nodeArgs += "--check"
  Write-Host "Modo: Comprobación de salud del entorno" -ForegroundColor Magenta
}
if ($NoOpen) {
  $nodeArgs += "--no-open"
}
if ($TakeOver) {
  $nodeArgs += "--take-over"
}

# 4. Ejecución del orquestador local
Write-Step "Lanzando servicios de desarrollo"
& node $nodeArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-ErrorMessage "El proceso de arranque finalizó con código de error $exitCode."
  Write-Host "`nConsejo: Si el backend tuvo problemas de sincronización, ejecuta:" -ForegroundColor Yellow
  Write-Host "  .\start.ps1 -Repair" -ForegroundColor White
  Write-Host "O para revisar el estado del sistema:" -ForegroundColor Yellow
  Write-Host "  .\start.ps1 -Check" -ForegroundColor White
}

exit $exitCode
