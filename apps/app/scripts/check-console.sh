#!/usr/bin/env bash
# Guardrail E6 (auditoría performance): impide console.* directos en código
# de aplicación. Usar LoggerService (core/services/logger.service.ts) que
# guarda los logs tras isDevMode().
#
# Falla con código != 0 si encuentra ocurrencias no allowlisteadas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → app → apps → repo root
cd "$SCRIPT_DIR/../../.."

# Allowlist: archivos donde console.* es legítimo.
# - main.ts: bootstrap pre-DI (LoggerService aún no resoluble).
# - logger.service.ts: el propio wrapper.
ALLOWLIST=(
  "apps/app/src/main.ts"
  "apps/app/src/app/core/services/logger.service.ts"
)

matches=$(grep -rEn "console\.(log|warn|error|info|debug)\s*\(" apps/app/src --include='*.ts' || true)

violations=()
if [ -n "$matches" ]; then
  while IFS= read -r match; do
    [ -z "$match" ] && continue
    file=$(echo "$match" | cut -d: -f1)
    allowed=0
    for entry in "${ALLOWLIST[@]}"; do
      if [ "$file" = "$entry" ]; then
        allowed=1
        break
      fi
    done
    [ "$allowed" -eq 0 ] && violations+=("$match")
  done <<< "$matches"
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "✗ console.* directo en código de aplicación:" >&2
  for v in "${violations[@]}"; do
    echo "  $v" >&2
  done
  echo "" >&2
  echo "Usa LoggerService:" >&2
  echo "  private logger = inject(LoggerService);" >&2
  echo "  this.logger.{log,warn,error,info,debug}(...)" >&2
  echo "" >&2
  echo "Allowlist (main.ts + logger.service.ts) en apps/app/scripts/check-console.sh" >&2
  exit 1
fi

echo "✓ check-console: 0 violaciones (${#ALLOWLIST[@]} casos allowlisteados)"
