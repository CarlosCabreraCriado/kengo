# apps/app — Convenciones Angular + UI

Reglas específicas para la app Angular 20. El CLAUDE.md raíz cubre el monorepo entero; este documento se aplica solo a `apps/app/`.

## Estilo Angular obligatorio

- **Standalone components** siempre (`standalone: true`).
- **Signals** para estado reactivo. Evitar `BehaviorSubject` salvo cuando se necesita un Observable verdadero.
- **`ChangeDetectionStrategy.OnPush`** en cada componente nuevo.
- **`input()` / `output()`** functions (Angular 17+) para nuevas APIs en lugar de `@Input/@Output` decorators cuando sea posible.
- **`@if / @for / @switch`** (control flow). No usar `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Reactive Forms** (`FormBuilder`, `FormGroup`). No template-driven forms para formularios serios.

## UI: dos catálogos coexistentes — `ui-*` (legacy) y `ui2-*` (V2 cream wellness)

El proyecto tiene **dos catálogos de componentes**:

- **`apps/app/src/app/shared/ui/`** (selector `ui-*`) — catálogo legacy. Lo usan todas las pantallas no migradas. **No se modifica visualmente.** Sigue siendo válido para mantenimiento de pantallas legacy.
- **`apps/app/src/app/shared/ui-v2/`** (selector `ui2-*`) — catálogo V2 con la estética "cream wellness" de la guía de Claude Design (`diseño/design_handoff_kengo_ui_library/`). Se usa en pantallas rediseñadas.

**Regla crítica: no mezclar `ui-*` y `ui2-*` en una misma pantalla.** Una pantalla migra completa al set V2 o no migra. Excepción permitida: componentes especializados sin equivalente V2 (`app-video-ejercicio`, `app-image-upload`, `app-qr-dialog`, `app-preview-ejercicio-dialog`, `app-selector-paciente`, `dialogo-pdf`) y servicios (`DialogService`, `ToastService`) se pueden usar dentro de pantallas `ui2-*`.

**Antes de escribir un `<input>`, `<button>`, dropdown, badge o card, comprueba si ya existe un componente compartido en el catálogo correspondiente** (V2 si la pantalla está migrada, legacy si no). Si existe pero le falta una variante, **extiéndelo** en lugar de duplicar HTML.

### Componentes que debes preferir sobre HTML inline

#### Catálogo V2 (`ui2-*` — usar en pantallas rediseñadas)

| En vez de... | Usa... |
|--------------|--------|
| `<button class="...">` (CTA grande con icono+título+subtítulo) | `<ui2-cta-bar>` |
| `<button class="bg-kengo-primary ...">` | `<ui2-button variant="primary">` |
| `<input class="...">` | `<ui2-input>` (con `formControlName`) |
| `<textarea class="...">` | `<ui2-textarea>` |
| `<select>` | `<ui2-select>` |
| `<input type="checkbox">` con label | `<ui2-checkbox>` |
| Toggle iOS-style | `<ui2-toggle>` o `<ui2-toggle-row>` (en lista) |
| Radios | `<ui2-radio-group>` |
| Búsqueda | `<ui2-search-box>` |
| Empty state con icono+título+CTA | `<ui2-empty-state>` |
| Spinner | `<ui2-spinner>` |
| Chip/tag/badge | `<ui2-pill variant="primary\|soft\|neutral\|success\|custom">` |
| Indicador de estado (dot + texto) | `<ui2-status-dot>` |
| Card blanca radius 22 | `<ui2-card>` (`tinted` para destacada) |
| Hero "subtítulo + título grande" | `<ui2-big-title>` |
| Etiqueta de sección uppercase | `<ui2-section-label>` |
| Wrapper de sección con padding 20px lateral | `<ui2-section>` |
| Avatar (imagen o inicial sobre gradient) | `<ui2-avatar>` |
| Icono dentro de bg tinted | `<ui2-icon-badge>` |
| Fila de lista (icon + title + subtitle + trailing) | `<ui2-list-row>` |
| Tarjeta KPI (badge + número grande + delta) | `<ui2-kpi-card>` |
| Burbuja de chat | `<ui2-message-bubble>` |
| Tile de fecha (LUN / 28 / ABR) | `<ui2-date-tile>` |
| Carrusel horizontal full-bleed | `<ui2-horizontal-scroller>` |
| Card de mensaje del fisio | `<ui2-fisio-message-card>` |
| Anillo de progreso | `<ui2-progress-ring>` o `<ui2-activity-rings>` |
| Botón de retroceso | `<ui2-back-button>` |
| Toasts/snackbars | `ToastService.success/error/info/warning(...)` (compartido) |
| Modales/diálogos | `DialogService.open(...)` (compartido) |

Importa desde `apps/app/src/app/shared/ui-v2`.

#### Catálogo legacy (`ui-*` — usar en pantallas no migradas)

| En vez de... | Usa... |
|--------------|--------|
| `<button class="bg-kengo-primary px-4 py-2 ...">` | `<ui-button variant="primary">` |
| `<input class="w-full rounded-xl border ...">` | `<ui-input>` (con `formControlName`) |
| `<textarea class="...">` | `<ui-textarea>` |
| `<select>` o dropdowns con `<option>` | `<ui-select>` |
| `<input type="checkbox">` con label | `<ui-checkbox>` |
| Radios sueltos | `<ui-radio-group>` |
| Datepicker hecho a mano | `<ui-datepicker>` |
| `<div>` empty state con icono+título+CTA | `<ui-empty-state>` |
| Toasts/snackbars | `ToastService.success/error/info/warning(...)` |
| Modales/diálogos | `DialogService.open(...)` con `<ui-dialog-header/content/actions>` |
| Spinner inline | `<ui-spinner>` |
| Progress bar | `<ui-progress-bar>` |
| Chip/tag | `<ui-chip>` |
| Dropdown menu | `<ui-menu [items]="...">` |
| Drawer/sidebar | `<ui-drawer>` |
| Stepper/wizard | `<ui-stepper>` + `<ui-step>` |

Importa desde `apps/app/src/app/shared` (barrel). Comprueba `apps/app/src/app/shared/index.ts`.

### Cuándo crear un nuevo componente compartido

Crea uno cuando un patrón visual aparece **3 o más veces** en features distintas y la copia es esencialmente idéntica. Antes de crear:
1. ¿Puedo cubrirlo extendiendo un componente existente?
2. ¿Es realmente compartido o pertenece a una feature concreta? (Si es solo de una feature, vive en esa feature.)

## Tokens y colores: nada hardcodeado

### Tokens legacy (consumidos por `ui-*`)
- **Colores**: usa las clases `bg-kengo-primary`, `text-kengo-primary`, `border-kengo-primary/20`, etc. (ver `apps/app/src/styles.css`). **Nunca** uses `#e75c3e` ni `rgb(231,92,62)` directamente — el `ThemeService` cambia el primario en runtime para white-labeling.
- **Grises**: usa la escala Tailwind (`text-zinc-700`, `bg-zinc-100`...). No hardcodees `#3f3f46`, `#71717a`, etc.
- **Sombras**: usa las utilities `shadow-md/lg/xl-kengo-primary/25-30-40` cuando son del primario, o las default Tailwind para neutras.
- **Tipografía**: usa la escala Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`). Evita `text-[10px]`, `text-[15px]` — si necesitas un tamaño nuevo, propónlo como token en `@theme`.
- **Border radius**: usa la escala Tailwind (`rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`). No `border-radius: 9px` o valores fuera de escala.

### Tokens V2 (consumidos por `ui2-*`)
- **Coral primario**: `var(--kengo-primary)` / `var(--kengo-primary-dark)` / `var(--kengo-primary-light)` (mismas variables que legacy — el `ThemeService` también las gobierna).
- **Cream**: `bg-cream-50` (background base), `bg-cream-100` (chips neutros, chat fisio).
- **Ink (text/borders neutros)**: `text-ink-{900,700,500,400,300}`, `border-ink-{100,300}`. **No mezclar** con la escala `zinc-*` legacy en pantallas V2.
- **Semantic**: `text-success/warning/danger/info`, `bg-success/warning/danger/info`.
- **Sombras V2**: `shadow-card`, `shadow-card-strong`, `shadow-cta-coral`, `shadow-pill-coral`, `shadow-toggle-coral`, `shadow-tab-bar`.
- **Gradientes**: `bg-coral-gradient` (CTA bar / mensaje propio), `bg-tinted-coral` (Card destacada).
- **Tipografía**: `KengoDisplay` para titulares e impactos (KPI, hero, CTA bar). `Galvji` (body por defecto) para todo lo demás.
- **Escala de radios V2** (CSS directa, no Tailwind): `14px` (button, chip pequeño), `18px` (chat bubble), `22px` (Card por defecto, dialog), `9999px` (pill, toggle, tab bar pill). Padding lateral de página: `20px` (`px-5`).

### Mapping `PatientIcon` → Material Symbol (para componentes V2)

La librería de diseño usa 18 SVG inline (`PatientIcon`); en `ui2-*` se usan **Material Symbols** ya cargados globalmente vía la clase `.material-symbols-outlined`. Tabla de equivalencias (también disponible como constante en `shared/ui-v2/icons/icon-map.ts`):

```
home   → home              chat   → chat               play  → play_arrow
trend  → trending_up       check  → check              flame → local_fire_department
clock  → schedule          arrow  → arrow_forward      pin   → location_on
phone  → phone             heart  → favorite           bell  → notifications
user   → person            settings → settings         dot   → fiber_manual_record
pain   → mood_bad          building → apartment        location → public
```

## Estilos: clases Tailwind antes que CSS por componente

- Preferencia 1: clases Tailwind directamente en el template.
- Preferencia 2: si la lógica de clases es compleja, extrae con `@apply` en `@layer components` dentro del CSS del componente.
- **Evita `style="..."` inline**. Si necesitas valores dinámicos, usa `[ngStyle]` o variables CSS con `[style.--mi-var]`.
- **Evita `[ngClass]` con strings largos** mezclados con clases estáticas. Separa lo estático en `class=""` y lo dinámico en `[ngClass]`.

## Accesibilidad

- Botones tienen `type="button"` salvo cuando son `submit`.
- Iconos decorativos van con `aria-hidden="true"` o dentro de un botón con `aria-label`.
- Inputs tienen `<label>` asociado o `aria-label`.
- Modales: foco se debe gestionar (`DialogService` ya lo hace).

## Mobile-first

La app prioriza móvil. Diseña primero el layout móvil (sin breakpoints), luego añade `sm:`, `md:`, `lg:` para desktop. Usa el composable `useResponsive()` (en `shared/composables/use-responsive.ts`) cuando necesites lógica condicional en TS.

## Permisos

La lógica de roles vive en `SessionService` (modo paciente vs fisio, permisos por modo). No dupliques checks de rol — pregunta al servicio.

## Imports y alias

Importa desde `@kengo/shared-models` para tipos compartidos del monorepo. Para utilidades y componentes locales usa rutas relativas o el barrel `apps/app/src/app/shared/index.ts`.
