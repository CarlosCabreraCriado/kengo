# apps/app — Convenciones Angular + UI

Reglas específicas para la app Angular 20. El CLAUDE.md raíz cubre el monorepo entero; este documento se aplica solo a `apps/app/`.

## Estilo Angular obligatorio

- **Standalone components** siempre (`standalone: true`).
- **Signals** para estado reactivo. Evitar `BehaviorSubject` salvo cuando se necesita un Observable verdadero.
- **`ChangeDetectionStrategy.OnPush`** en cada componente nuevo.
- **`input()` / `output()`** functions (Angular 17+) para nuevas APIs en lugar de `@Input/@Output` decorators cuando sea posible.
- **`@if / @for / @switch`** (control flow). No usar `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Reactive Forms** (`FormBuilder`, `FormGroup`). No template-driven forms para formularios serios.

## UI: catálogo V2 + componentes legacy especializados

- **`apps/app/src/app/shared/ui-v2/`** (selector `ui2-*`) — catálogo principal con la estética "cream wellness". Usar siempre que se vaya a construir UI nueva.
- **`apps/app/src/app/shared/ui/`** — solo conserva los componentes especializados sin equivalente V2: `app-video-ejercicio`, `app-image-upload`, `app-preview-ejercicio-dialog`, `app-selector-paciente`, `app-dialogo-pdf`, `app-user-menu`, y los wrappers internos del sistema legacy de diálogos (`ui-dialog-container/header/content/actions`, `ui-confirm-dialog`).
- **`apps/app/src/app/shared/services/`** — servicios neutrales (`ToastService`, `DialogService`) usables desde cualquier catálogo. Importar desde `'.../shared/services/toast'` y `'.../shared/services/dialog'` (o desde el barrel `'.../shared'`).

**Antes de escribir un `<input>`, `<button>`, dropdown, badge o card, comprueba si ya existe un componente compartido `ui2-*`.** Si existe pero le falta una variante, **extiéndelo** en lugar de duplicar HTML.

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
| Selector de fecha/hora | `<ui2-datepicker mode="date\|datetime\|time">` (con `formControlName`) |
| Stepper/wizard | `<ui2-stepper [selectedIndex]>` + `<ui2-step label>` |
| Progress bar lineal | `<ui2-progress-bar [value]>` (variantes `sm`/`md`, colores semánticos) |
| Surface de diálogo (estructura interna del componente abierto) | `<ui2-dialog-host>` + `<ui2-dialog-header>` + `<ui2-dialog-content>` + `<ui2-dialog-actions>` |
| Toasts/snackbars | `ToastService.success/error/info/warning(...)` (compartido) |
| Modales/diálogos (apertura) | `DialogService.open(...)` (compartido) — el contenido del componente abre con `<ui2-dialog-host>` |

Importa desde `apps/app/src/app/shared/ui-v2`.

#### Componentes legacy especializados (sin equivalente V2)

| Componente | Uso |
|------------|-----|
| `<app-video-ejercicio>` | Reproductor de vídeo de ejercicio con poster |
| `<app-image-upload>` | Subida de imagen con preview y crop |
| `<app-preview-ejercicio-dialog>` | Diálogo de preview de ejercicio |
| `<app-selector-paciente>` | Selector tipo combo de paciente |
| `<app-dialogo-pdf>` | Diálogo de descarga/impresión/envío de PDF |
| `<app-user-menu>` | Menú de usuario del shell legacy del modo fisio |

Importa desde `apps/app/src/app/shared` (barrel). Comprueba `apps/app/src/app/shared/index.ts`.

### Cuándo crear un nuevo componente compartido

Crea uno cuando un patrón visual aparece **3 o más veces** en features distintas y la copia es esencialmente idéntica. Antes de crear:
1. ¿Puedo cubrirlo extendiendo un componente existente?
2. ¿Es realmente compartido o pertenece a una feature concreta? (Si es solo de una feature, vive en esa feature.)

## Tokens y colores: nada hardcodeado

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
