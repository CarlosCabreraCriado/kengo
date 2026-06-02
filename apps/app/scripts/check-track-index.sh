#!/usr/bin/env bash
# Guardrail D1 (auditoría performance): impide que se introduzcan `@for ... track $index`
# nuevos fuera de la allowlist de casos legítimos (uploads de File[], charts/stepper con
# orden fijo). Cuando hay un id estable, debe usarse `track item.id`/`item.planItemId`/etc.
#
# Falla con código != 0 si encuentra ocurrencias no allowlisteadas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → app → apps → repo root
cd "$SCRIPT_DIR/../../.."

# Allowlist: paths donde `track $index` es la opción correcta.
# Mantener ordenada y con comentario justificativo en el propio template.
ALLOWLIST=(
  "apps/app/src/app/features/clinica/components/editar-clinica-dialog/editar-clinica-dialog.component.html"
  "apps/app/src/app/features/clinica/components/crear-clinica-dialog/crear-clinica-dialog.component.html"
  "apps/app/src/app/shared/ui-v2/activity-rings/activity-rings.component.ts"
  "apps/app/src/app/shared/ui-v2/stepper/stepper.component.ts"
  "apps/app/src/app/shared/ui-v2/web-activity-chart/web-activity-chart.component.ts"
  "apps/app/src/app/shared/ui-v2/weekly-bars/weekly-bars.component.ts"
)

PATTERN='track $index'

matches=$(grep -rlnF "$PATTERN" apps/app/src --include='*.html' --include='*.ts' || true)

violations=()
if [ -n "$matches" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    allowed=0
    for entry in "${ALLOWLIST[@]}"; do
      if [ "$file" = "$entry" ]; then
        allowed=1
        break
      fi
    done
    if [ "$allowed" -eq 0 ]; then
      violations+=("$file")
    fi
  done <<< "$matches"
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "✗ track \$index en archivos no allowlisteados:" >&2
  for f in "${violations[@]}"; do
    grep -nF "$PATTERN" "$f" | sed "s|^|  $f:|" >&2
  done
  echo "" >&2
  echo "Usa un id estable (item.id, item.planItemId, ...) o añade el path a la" >&2
  echo "allowlist en apps/app/scripts/check-track-index.sh si \$index es correcto." >&2
  exit 1
fi

echo "✓ check-track-index: 0 violaciones (${#ALLOWLIST[@]} casos allowlisteados)"
