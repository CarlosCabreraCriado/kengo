#!/usr/bin/env bash
set -euo pipefail

# Kengo - Setup Caddy reverse proxy para desarrollo local
# Uso: bash scripts/setup-caddy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
CADDY_DIR="$HOME/.caddy.d"
CADDYFILE_DEV="$REPO_DIR/Caddyfile.dev"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${RED}✗${NC} $1"; }
dim()   { echo -e "${DIM}  $1${NC}"; }

echo -e "\n${BOLD}Kengo - Setup Caddy${NC}\n"

# 1. Verificar que Caddy esta instalado
if ! command -v caddy &> /dev/null; then
  warn "Caddy no esta instalado."
  echo ""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    dim "Instala con: brew install caddy"
  else
    dim "Instala con: sudo apt install -y caddy"
    dim "  o visita: https://caddyserver.com/docs/install"
  fi
  exit 1
fi
info "Caddy encontrado: $(caddy version)"

# 2. Leer puertos del registro central
BASE_PORT=$(node -e "
  const fs = require('fs');
  const path = require('path');
  const file = path.join(require('os').homedir(), '.dev-ports.json');
  if (!fs.existsSync(file)) { console.log('4200'); process.exit(0); }
  const reg = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const p = reg.projects && reg.projects['kengo'];
  console.log(p ? p.base : '4200');
")
APP_PORT=$BASE_PORT
API_PORT=$((BASE_PORT + 1))
WEB_PORT=$((BASE_PORT + 2))

info "Puertos del registro: app=$APP_PORT, api=$API_PORT, web=$WEB_PORT"

# 3. Crear directorio ~/.caddy.d/ si no existe
if [[ ! -d "$CADDY_DIR" ]]; then
  mkdir -p "$CADDY_DIR"
  info "Directorio creado: $CADDY_DIR"
else
  dim "Directorio ya existe: $CADDY_DIR"
fi

# 4. Generar kengo.caddy con puertos del registro
TARGET_FILE="$CADDY_DIR/kengo.caddy"
cat > "$TARGET_FILE" <<CADDY
# Kengo - Desarrollo local (generado por setup-caddy.sh)
# Regenerar con: bash scripts/setup-caddy.sh

kengo.localhost {
	reverse_proxy localhost:${APP_PORT}
}

kengo-api.localhost {
	reverse_proxy localhost:${API_PORT}
}

kengo-web.localhost {
	reverse_proxy localhost:${WEB_PORT}
}
CADDY
info "Generado: $TARGET_FILE"

# 5. Detectar Caddyfile global
GLOBAL_CADDYFILE=""
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS: Homebrew (Intel o Apple Silicon)
  if [[ -f "/opt/homebrew/etc/Caddyfile" ]]; then
    GLOBAL_CADDYFILE="/opt/homebrew/etc/Caddyfile"
  elif [[ -f "/usr/local/etc/Caddyfile" ]]; then
    GLOBAL_CADDYFILE="/usr/local/etc/Caddyfile"
  fi
else
  # Linux
  if [[ -f "/etc/caddy/Caddyfile" ]]; then
    GLOBAL_CADDYFILE="/etc/caddy/Caddyfile"
  fi
fi

if [[ -z "$GLOBAL_CADDYFILE" ]]; then
  # Crear Caddyfile global automaticamente
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ -d "/opt/homebrew/etc" ]]; then
      GLOBAL_CADDYFILE="/opt/homebrew/etc/Caddyfile"
    elif [[ -d "/usr/local/etc" ]]; then
      GLOBAL_CADDYFILE="/usr/local/etc/Caddyfile"
    else
      GLOBAL_CADDYFILE="/opt/homebrew/etc/Caddyfile"
      mkdir -p "$(dirname "$GLOBAL_CADDYFILE")"
    fi
  else
    GLOBAL_CADDYFILE="/etc/caddy/Caddyfile"
    sudo mkdir -p "$(dirname "$GLOBAL_CADDYFILE")"
  fi
  echo "import $HOME/.caddy.d/*.caddy" > "$GLOBAL_CADDYFILE"
  info "Caddyfile global creado: $GLOBAL_CADDYFILE"
fi

info "Caddyfile global: $GLOBAL_CADDYFILE"

# 6. Anadir linea de import si no existe
IMPORT_LINE="import $HOME/.caddy.d/*.caddy"
if grep -qF "$IMPORT_LINE" "$GLOBAL_CADDYFILE"; then
  dim "Import ya configurado en Caddyfile global"
else
  echo "" >> "$GLOBAL_CADDYFILE"
  echo "$IMPORT_LINE" >> "$GLOBAL_CADDYFILE"
  info "Anadido import al Caddyfile global"
fi

# 7. Recargar Caddy
if caddy reload --config "$GLOBAL_CADDYFILE" 2>/dev/null; then
  info "Caddy recargado"
else
  dim "No se pudo recargar Caddy (puede que no este corriendo)"
  dim "Inicia con: caddy run --config $GLOBAL_CADDYFILE"
fi

echo ""
echo -e "${BOLD}Dominios configurados:${NC}"
dim "https://kengo.localhost      → localhost:${APP_PORT}"
dim "https://kengo-api.localhost  → localhost:${API_PORT}"
dim "https://kengo-web.localhost  → localhost:${WEB_PORT}"
echo ""
