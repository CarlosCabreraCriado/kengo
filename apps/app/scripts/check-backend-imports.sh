#!/usr/bin/env bash
# Guardrail B1 (auditoría performance): bloquea imports runtime de deps
# server-only (Convex) o del SDK de Firebase desde el código del frontend
# Angular. `import type` está permitido — útil para shims de tipos que no
# añaden runtime al bundle (ver apps/app/src/types/pdfkit-standalone.d.ts).
#
# - `stripe`, `resend`, `google-auth-library`, `pdfkit`, `@aws-sdk/*`: solo
#   se usan dentro de `convex/`. Si necesitas funcionalidad equivalente
#   desde Angular, llama a un action de Convex.
# - `firebase`/`firebase/*`: la app accede a FCM vía
#   `@capacitor-firebase/messaging`. No importar el SDK directamente.
#
# Falla con código != 0 si encuentra ocurrencias.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → app → apps → repo root
cd "$SCRIPT_DIR/../../.."

# Regex de imports prohibidos. Cubre tanto `from 'X'` como `from "X/sub"`.
BANNED_REGEX="from ['\"](stripe|resend|google-auth-library|pdfkit|firebase)(/[^'\"]+)?['\"]|from ['\"]@aws-sdk/[^'\"]+['\"]"

# Excluye `import type ... from "X"` — los type-only imports se borran en
# compilación y no llegan al bundle. Pasamos por -v invertido sobre las
# líneas que empiecen con `import type` (después del lineno de grep -n).
raw=$(grep -rEn "$BANNED_REGEX" apps/app/src --include='*.ts' --include='*.html' || true)
violations=$(echo "$raw" | grep -vE ':[[:space:]]*import[[:space:]]+type[[:space:]]' || true)

if [ -n "$violations" ]; then
  echo "✗ Imports runtime de deps server-only o SDK firebase detectados en apps/app/src:" >&2
  echo "$violations" >&2
  echo "" >&2
  echo "Reglas:" >&2
  echo "  - stripe/resend/google-auth-library/pdfkit/@aws-sdk/*: server-only (Convex)." >&2
  echo "  - firebase/firebase/*: usar @capacitor-firebase/messaging." >&2
  echo "  - 'import type' está permitido (no añade runtime al bundle)." >&2
  exit 1
fi

echo "✓ check-backend-imports: 0 violaciones"
