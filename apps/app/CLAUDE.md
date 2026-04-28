# apps/app — Convenciones Angular + UI

Reglas específicas para la app Angular 20. El CLAUDE.md raíz cubre el monorepo entero; este documento se aplica solo a `apps/app/`.

## Estilo Angular obligatorio

- **Standalone components** siempre (`standalone: true`).
- **Signals** para estado reactivo. Evitar `BehaviorSubject` salvo cuando se necesita un Observable verdadero.
- **`ChangeDetectionStrategy.OnPush`** en cada componente nuevo.
- **`input()` / `output()`** functions (Angular 17+) para nuevas APIs en lugar de `@Input/@Output` decorators cuando sea posible.
- **`@if / @for / @switch`** (control flow). No usar `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Reactive Forms** (`FormBuilder`, `FormGroup`). No template-driven forms para formularios serios.

## UI: usa el catálogo compartido antes que escribir HTML

El proyecto ya tiene un catálogo en `apps/app/src/app/shared/ui/`. **Antes de escribir un `<input>`, `<button>`, dropdown, badge o card, comprueba si ya existe un componente compartido**. Si existe pero le falta una variante, **extiéndelo** en lugar de duplicar HTML.

### Componentes que debes preferir sobre HTML inline

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

Importa desde el barrel `@/shared` (alias) o desde `apps/app/src/app/shared` según la configuración. Comprueba `apps/app/src/app/shared/index.ts` para ver qué está exportado.

### Cuándo crear un nuevo componente compartido

Crea uno cuando un patrón visual aparece **3 o más veces** en features distintas y la copia es esencialmente idéntica. Antes de crear:
1. ¿Puedo cubrirlo extendiendo un componente existente?
2. ¿Es realmente compartido o pertenece a una feature concreta? (Si es solo de una feature, vive en esa feature.)

## Tokens y colores: nada hardcodeado

- **Colores**: usa las clases `bg-kengo-primary`, `text-kengo-primary`, `border-kengo-primary/20`, etc. (ver `apps/app/src/styles.css`). **Nunca** uses `#e75c3e` ni `rgb(231,92,62)` directamente — el `ThemeService` cambia el primario en runtime para white-labeling.
- **Grises**: usa la escala Tailwind (`text-zinc-700`, `bg-zinc-100`...). No hardcodees `#3f3f46`, `#71717a`, etc.
- **Sombras**: usa las utilities `shadow-md/lg/xl-kengo-primary/25-30-40` cuando son del primario, o las default Tailwind para neutras.
- **Tipografía**: usa la escala Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`). Evita `text-[10px]`, `text-[15px]` — si necesitas un tamaño nuevo, propónlo como token en `@theme`.
- **Border radius**: usa la escala Tailwind (`rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`). No `border-radius: 9px` o valores fuera de escala.

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
