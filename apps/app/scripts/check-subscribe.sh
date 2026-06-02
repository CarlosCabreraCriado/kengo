#!/usr/bin/env bash
# Guardrail E3 (auditoría performance): impide que se introduzcan nuevas
# llamadas a `.subscribe(...)` en componentes Angular sin `takeUntilDestroyed`
# en las 5 líneas anteriores. Para servicios singleton (no destruidos),
# preferir `firstValueFrom` para operaciones one-shot.
#
# Falla con código != 0 si encuentra ocurrencias no allowlisteadas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → app → apps → repo root
cd "$SCRIPT_DIR/../../.."

# Allowlist: "archivo:lineno" — casos justificados donde la suscripción se
# cierra por otro mecanismo verificable. Mantener vacía salvo necesidad real,
# con comentario justificativo en el propio código.
ALLOWLIST=()

matches=$(grep -rn "\.subscribe(" apps/app/src --include='*.component.ts' || true)

violations=()
if [ -n "$matches" ]; then
  while IFS= read -r match; do
    [ -z "$match" ] && continue
    file=$(echo "$match" | cut -d: -f1)
    lineno=$(echo "$match" | cut -d: -f2)
    key="$file:$lineno"
    allowed=0
    if [ "${#ALLOWLIST[@]}" -gt 0 ]; then
      for entry in "${ALLOWLIST[@]}"; do
        if [ "$key" = "$entry" ]; then
          allowed=1
          break
        fi
      done
    fi
    [ "$allowed" -eq 1 ] && continue
    start=$((lineno > 5 ? lineno - 5 : 1))
    ctx=$(sed -n "${start},${lineno}p" "$file")
    if ! echo "$ctx" | grep -q "takeUntilDestroyed"; then
      violations+=("$key")
    fi
  done <<< "$matches"
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "✗ .subscribe( sin takeUntilDestroyed en componentes:" >&2
  for v in "${violations[@]}"; do
    file=$(echo "$v" | cut -d: -f1)
    lineno=$(echo "$v" | cut -d: -f2)
    line=$(sed -n "${lineno}p" "$file")
    echo "  $file:$lineno: $line" >&2
  done
  echo "" >&2
  echo "Aplica el patrón:" >&2
  echo "  .pipe(takeUntilDestroyed(this.destroyRef))" >&2
  echo "  .subscribe(...)" >&2
  echo "" >&2
  echo "Si destroyRef no está inyectado: private destroyRef = inject(DestroyRef);" >&2
  echo "Para servicios singleton, considera firstValueFrom en lugar de subscribe." >&2
  exit 1
fi

echo "✓ check-subscribe: 0 violaciones (${#ALLOWLIST[@]} casos allowlisteados)"
