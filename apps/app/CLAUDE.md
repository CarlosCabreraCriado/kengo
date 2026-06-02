# apps/app — Convenciones Angular + UI

Reglas específicas para la app Angular 20. El CLAUDE.md raíz cubre el monorepo entero; este documento se aplica solo a `apps/app/`.

## Estilo Angular obligatorio

- **Standalone components** siempre (`standalone: true`).
- **Signals** para estado reactivo. Evitar `BehaviorSubject` salvo cuando se necesita un Observable verdadero.
- **`ChangeDetectionStrategy.OnPush`** en cada componente nuevo.
- **`input()` / `output()`** functions (Angular 17+) para nuevas APIs en lugar de `@Input/@Output` decorators cuando sea posible.
- **`@if / @for / @switch`** (control flow). No usar `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Reactive Forms** (`FormBuilder`, `FormGroup`). No template-driven forms para formularios serios.
- **`NgOptimizedImage` (`<img [ngSrc]>`)** para toda imagen servida desde Cloudflare R2 (URL construida con `assetUrl()`). Requiere `width`/`height` explícitos; pasar `[loaderParams]="{ fit: 'cover', quality: 80 }"` para que el loader (`core/utils/image-loader.ts`) reescriba los query params según device pixel ratio. Marcar `priority` solo en el LCP candidate de la pantalla; el resto va con `loading="lazy"`. SVGs locales y blobs de preview (cropper, file inputs) mantienen `<img src>`.

## UI: catálogo V2 + componentes legacy especializados

- **`apps/app/src/app/shared/ui-v2/`** (selector `ui2-*`) — catálogo principal con la estética "cream wellness". Usar siempre que se vaya a construir UI nueva.
- **`apps/app/src/app/shared/ui/`** — solo conserva los componentes especializados sin equivalente V2: `app-video-ejercicio`, `app-image-upload`, `app-preview-ejercicio-dialog`, `app-selector-paciente`, `app-dialogo-pdf`, y los wrappers internos del sistema legacy de diálogos (`ui-dialog-container/header/content/actions`, `ui-confirm-dialog`).
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
| Surface de diálogo (estructura interna del componente abierto) | `<ui2-dialog-host [variant]>` + `<ui2-dialog-header>` + `<ui2-dialog-content>` + (opcional) `<ui2-dialog-actions>` |
| Toasts/snackbars | `ToastService.success/error/info/warning(...)` (compartido) |
| Modales/diálogos (apertura) | `DialogService.openForm / openInformative / openSheet / openFullscreen / confirm` (compartido) |

Importa desde `apps/app/src/app/shared/ui-v2`.

### Sistema de diálogos: variantes y reglas

Todos los diálogos se abren con `DialogService` (CDK Overlay por debajo). Elige el **shortcut** según el caso de uso — eso aplica `panelClass` con los presets de tamaño y posicionamiento. Dentro del componente, declara la variant igualmente en `<ui2-dialog-host>` para que la superficie (radius, padding, anclaje móvil) coincida.

| Variant | Caso de uso | Shortcut | Header X | Actions |
|---|---|---|---|---|
| `standard` | Formularios, crear/editar entidad | `openForm()` | sí | sí |
| `informative` | Legal, ayuda, FAQ | `openInformative()` | sí | **no** (cierre solo por X o backdrop) |
| `compact` | Confirmación sí/no | `confirm()` | no | sí (los botones cierran) |
| `sheet` | Bottom-sheet móvil + modal desktop | `openSheet()` | sí | sí |
| `fullscreen` | Image crop, vídeo, cámara | `openFullscreen()` | sí | opcional |

Reglas obligatorias:
- **No usar overlays inline** con `<div class="dialog-overlay">` ni `@if (mostrar)`. Siempre `DialogService.openX(Component, { data })`.
- **No definir `panelClass` manualmente** — el shortcut aplica `ui-dialog-panel--{variant}` y sus presets.
- **Diálogos informativos no llevan `<ui2-dialog-actions>`** — el cierre vive en la X del header. No añadas botones tipo "Entendido"/"OK" cuando no aportan acción real.
- **Para confirmaciones usa `DialogService.confirm({ title, message, ... })`** que devuelve `Promise<boolean>`. No abras `Ui2ConfirmDialogComponent` directamente.
- **El componente abierto recibe props vía `DIALOG_DATA`** y cierra con `inject(DialogRef).close(result)`. No uses `@Output` para comunicarse con el padre.

#### Componentes legacy especializados (sin equivalente V2)

| Componente | Uso |
|------------|-----|
| `<app-video-ejercicio>` | Reproductor de vídeo de ejercicio con poster |
| `<app-image-upload>` | Subida de imagen con preview y crop |
| `<app-preview-ejercicio-dialog>` | Diálogo de preview de ejercicio |
| `<app-selector-paciente>` | Selector tipo combo de paciente |
| `<app-dialogo-pdf>` | Diálogo de descarga/impresión/envío de PDF |

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
- **Z-index**: nunca hardcodear valores. Usar las variables `--z-*` definidas en `styles.css` (`--z-base`, `--z-content`, `--z-sticky`, `--z-floating`, `--z-loader`, `--z-header`, `--z-banner`, `--z-drawer`, `--z-sidebar`, `--z-sidebar-toggle`, `--z-modal`, `--z-menu`, `--z-toast`, `--z-critical`). Para diálogos modales preferir siempre `DialogService.open(...)` — CDK Overlay asigna z-index automáticamente sobre el shell. No construir overlays inline con z-index propio salvo que sea estrictamente necesario; en ese caso, usar `var(--z-modal)` y documentar el motivo.

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

**Subset auto-hosteado**: el WOFF2 vive en `apps/app/src/assets/fonts/material-symbols-subset.woff2` (~10 kB con la lista actual de iconos). Al añadir un icono nuevo, regenerar el subset:

```bash
# 1. Compilar lista de iconos usados en el código
grep -rPo 'class="[^"]*material-symbols-outlined[^"]*"[^>]*>\s*[a-z_]+\s*<' apps/app/src/ --include='*.html' --include='*.ts' 2>/dev/null | grep -oE '>\s*[a-z_]+\s*<' | tr -d '<>' | tr -d ' ' | sort -u > /tmp/icons.txt
grep -rEho "icon:\s*'[a-z_]+'" apps/app/src/ --include='*.ts' 2>/dev/null | grep -oE "'[a-z_]+'" | tr -d "'" | sort -u >> /tmp/icons.txt
# (añadir manualmente cualquier icono dinámico — p.ej. star/star_outline en favoritos)
sort -u /tmp/icons.txt -o /tmp/icons.txt

# 2. Descargar el TTF subset desde Google y convertirlo a WOFF2
ICONS=$(tr '\n' ',' < /tmp/icons.txt | sed 's/,$//')
FONT_URL=$(curl -s -A 'Mozilla/5.0' "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${ICONS}" | grep -oE "https://[^)]+")
curl -s -A 'Mozilla/5.0' -o /tmp/ms.ttf "$FONT_URL"
woff2_compress /tmp/ms.ttf
mv /tmp/ms.woff2 apps/app/src/assets/fonts/material-symbols-subset.woff2
```

Requiere `brew install woff2` una vez.

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

## Splash screen nativo

- Asset fuente único: `apps/app/assets/splash.png` (idealmente **2732×2732** con el logo centrado dentro del 66 % central — Android 12+ recorta el `windowSplashScreenAnimatedIcon` a un círculo). Para iconos: `assets/icon.png` (1024×1024 opaco) y `assets/icon-only.png` (transparente, opcional).
- Regenera todos los recursos nativos con `npm run cap:assets` (usa `@capacitor/assets`). Después `npm run cap:sync` para propagar al proyecto Xcode/Android Studio.
- Tras cambiar splash o icono, **clean build obligatorio** (Xcode: `Product > Clean Build Folder`; Android Studio: `Build > Clean Project`). El simulador/emulador cachean la launch image.
- iOS: `LaunchScreen.storyboard` tiene root view blanco (coincide con el fondo del PNG fuente) y un imageView con constraints a los 4 bordes y `scaleAspectFit`. No editar el storyboard a mano salvo necesidad real — Xcode puede reformatearlo.
- Android: `values/styles.xml > AppTheme.NoActionBarLaunch` usa el API moderno `Theme.SplashScreen` (background = `@color/splashBackground` blanco, animated icon = `@drawable/splash`, post = `AppTheme.NoActionBar`). Los colores están en `values/colors.xml`.
- El splash se oculta desde `app.component.ts` cuando `SessionService.sesionInicializada()` pasa a true, con un suelo mínimo de **600 ms** para evitar parpadeo en cold start sin sesión. Fade out 250 ms.
