# Kengo - Setup Caddy reverse proxy para desarrollo local (Windows)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\setup-caddy.ps1

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CaddyDir = Join-Path $env:USERPROFILE ".caddy.d"
$CaddyfileDev = Join-Path $RepoDir "Caddyfile.dev"

function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Red }
function Write-Dim($msg)  { Write-Host "    $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "  Kengo - Setup Caddy" -ForegroundColor White
Write-Host ""

# 1. Verificar que Caddy esta instalado
$caddyCmd = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $caddyCmd) {
    Write-Warn "Caddy no esta instalado."
    Write-Host ""
    Write-Dim "Instala con: choco install caddy"
    Write-Dim "         o: scoop install caddy"
    Write-Dim "         o: https://caddyserver.com/docs/install"
    exit 1
}
$caddyVersion = & caddy version 2>&1
Write-Info "Caddy encontrado: $caddyVersion"

# 2. Leer puertos del registro central
$RegistryFile = Join-Path $env:USERPROFILE ".dev-ports.json"
$BasePort = 4200
if (Test-Path $RegistryFile) {
    $registry = Get-Content $RegistryFile -Raw | ConvertFrom-Json
    if ($registry.projects.PSObject.Properties["kengo"]) {
        $BasePort = $registry.projects.kengo.base
    }
}
$AppPort = $BasePort
$ApiPort = $BasePort + 1
$LandingpagePort = $BasePort + 2

Write-Info "Puertos del registro: app=$AppPort, api=$ApiPort, landingpage=$LandingpagePort"

# 3. Crear directorio ~/.caddy.d/ si no existe
if (-not (Test-Path $CaddyDir)) {
    New-Item -ItemType Directory -Path $CaddyDir -Force | Out-Null
    Write-Info "Directorio creado: $CaddyDir"
} else {
    Write-Dim "Directorio ya existe: $CaddyDir"
}

# 4. Generar kengo.caddy con puertos del registro
$TargetFile = Join-Path $CaddyDir "kengo.caddy"
$CaddyContent = @"
# Kengo - Desarrollo local (generado por setup-caddy.ps1)
# Regenerar con: powershell -ExecutionPolicy Bypass -File scripts\setup-caddy.ps1

kengo.localhost {
	reverse_proxy localhost:$AppPort
}

kengo-api.localhost {
	reverse_proxy localhost:$ApiPort
}

kengo-landingpage.localhost {
	reverse_proxy localhost:$LandingpagePort
}
"@
Set-Content -Path $TargetFile -Value $CaddyContent
Write-Info "Generado: $TargetFile"

# 5. Detectar Caddyfile global
$GlobalCaddyfile = $null
$PossiblePaths = @(
    (Join-Path $env:ProgramData "Caddy\Caddyfile"),
    (Join-Path $env:USERPROFILE "Caddyfile"),
    "C:\Caddy\Caddyfile"
)

foreach ($path in $PossiblePaths) {
    if (Test-Path $path) {
        $GlobalCaddyfile = $path
        break
    }
}

if (-not $GlobalCaddyfile) {
    Write-Warn "No se encontro Caddyfile global."
    Write-Dim "Crea uno manualmente y anade: import $CaddyDir\*.caddy"
    Write-Host ""
    Write-Dim "Puedes ejecutar Caddy directamente con:"
    Write-Dim "  caddy run --config $CaddyfileDev"
    exit 0
}

Write-Info "Caddyfile global: $GlobalCaddyfile"

# 6. Anadir linea de import si no existe
$ImportLine = "import $CaddyDir\*.caddy"
$content = Get-Content $GlobalCaddyfile -Raw -ErrorAction SilentlyContinue
if ($content -and $content.Contains($ImportLine)) {
    Write-Dim "Import ya configurado en Caddyfile global"
} else {
    Add-Content -Path $GlobalCaddyfile -Value "`n$ImportLine"
    Write-Info "Anadido import al Caddyfile global"
}

# 7. Recargar Caddy
try {
    & caddy reload --config $GlobalCaddyfile 2>&1 | Out-Null
    Write-Info "Caddy recargado"
} catch {
    Write-Dim "No se pudo recargar Caddy (puede que no este corriendo)"
    Write-Dim "Inicia con: caddy run --config $GlobalCaddyfile"
}

Write-Host ""
Write-Host "  Dominios configurados:" -ForegroundColor White
Write-Dim "https://kengo.localhost      -> localhost:$AppPort"
Write-Dim "https://kengo-api.localhost  -> localhost:$ApiPort"
Write-Dim "https://kengo-landingpage.localhost -> localhost:$LandingpagePort"
Write-Host ""
