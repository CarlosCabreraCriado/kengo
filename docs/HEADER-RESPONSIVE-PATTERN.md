# Patrón: Header Responsivo Alineado con Navegación

Este documento describe el patrón aplicado para adaptar los headers de componentes según el breakpoint de la navegación principal de Kengo.

## Contexto

La navegación principal (`NavegacionComponent`) se muestra en **desktop (>= 768px)** y se oculta en móvil. En desktop, la navegación ya proporciona:
- El título de la sección actual (ej: "Ejercicios")
- Navegación entre secciones (no es necesario botón "volver")

Por lo tanto, los headers de los componentes deben adaptarse para no duplicar esta información en desktop.

## Breakpoint de Referencia

```typescript
// apps/app/src/app/shared/utils/breakpoints.ts
export const KENGO_BREAKPOINTS = {
  MOBILE: '(max-width: 767.98px)',  // <- Usar este
  // ...
} as const;
```

- **Móvil**: `< 768px` → Header completo con título y navegación
- **Desktop**: `>= 768px` → Header simplificado (solo controles)

---

## Cambios a Aplicar

### 1. TypeScript del Componente

**Importar los breakpoints y crear signal `isMovil`:**

```typescript
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { KENGO_BREAKPOINTS } from '../../../../shared';

@Component({...})
export class MiComponente {
  private breakpointObserver = inject(BreakpointObserver);

  // Detectar si es móvil (< 768px) - alineado con breakpoint de navegación
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );
}
```

> **Nota**: Si el componente ya tiene `isDesktop` con `KENGO_BREAKPOINTS.DESKTOP` (1024px), reemplazarlo por `isMovil` con `KENGO_BREAKPOINTS.MOBILE` (768px) para alinearse con la navegación.

---

### 2. HTML del Componente

**Estructura del header con condicionales:**

```html
<header class="header-glass sticky top-0 z-50 shrink-0 px-4 pt-3 pb-4">
  <div class="mx-auto max-w-6xl">

    <!-- MÓVIL: Header completo con título y navegación -->
    @if (isMovil()) {
      <div class="mb-4 flex items-center justify-between">
        <!-- Botón volver + Título -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            routerLink="/inicio"
            class="flex h-10 w-10 items-center justify-center rounded-xl
                   bg-white/60 backdrop-blur-md border border-white/40
                   text-zinc-600 transition-all duration-200
                   hover:bg-white/80 hover:scale-105 active:scale-95"
            aria-label="Volver al inicio"
          >
            <span class="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 class="titulo-kengo text-2xl text-[#e75c3e]">Título Sección</h1>
            <!-- Subtítulo opcional (contador, etc.) -->
            <p class="text-xs font-medium text-zinc-500">Subtítulo</p>
          </div>
        </div>

        <!-- Acciones rápidas (solo iconos en móvil) -->
        <div class="flex items-center gap-2">
          <!-- Botones de acción -->
        </div>
      </div>
    }

    <!-- Barra de controles (siempre visible) -->
    <div class="flex items-center gap-2">
      <!-- DESKTOP: Información compacta al inicio -->
      @if (!isMovil()) {
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 backdrop-blur-md shrink-0">
          <span class="text-sm font-bold text-[#e75c3e]">123</span>
          <span class="text-xs text-zinc-500">elementos</span>
        </div>
      }

      <!-- Controles comunes (búsqueda, filtros, etc.) -->
      <!-- ... -->

      <!-- DESKTOP: Acciones con etiquetas de texto -->
      @if (!isMovil()) {
        <div class="flex items-center gap-2 ml-2 pl-2 border-l border-zinc-200/50">
          <button class="flex h-10 items-center gap-1.5 rounded-full px-3 ...">
            <span class="material-symbols-outlined text-lg">icon</span>
            <span class="text-xs font-semibold">Etiqueta</span>
          </button>
        </div>
      }
    </div>

  </div>
</header>
```

---

### 3. CSS del Componente

**Glassmorphism solo en móvil:**

```css
/* === Header con glassmorphism (solo móvil) === */
.header-glass {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

@media (max-width: 767.98px) {
  .header-glass {
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.85) 60%,
      rgba(255, 255, 255, 0) 100%
    );
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
}
```

---

## Resumen de Diferencias

| Elemento | Móvil (< 768px) | Desktop (>= 768px) |
|----------|-----------------|---------------------|
| Botón volver | Visible | Oculto (navegación lo provee) |
| Título sección | Visible | Oculto (navegación lo provee) |
| Fondo glassmorphism | Aplicado | Transparente |
| Botones de acción | Solo iconos | Iconos + etiquetas de texto |
| Información (contadores) | Bajo el título | Inline en barra de controles |

---

## Componentes Aplicados

- [x] `ejercicios-list` - Catálogo de ejercicios
- [x] `pacientes-list` - Lista de pacientes
- [ ] `planes` - Gestión de planes
- [ ] `ejercicio-detail` - Detalle de ejercicio
- [ ] `perfil` - Perfil de usuario
- [ ] `mi-clinica` - Gestión de clínica

---

## Referencia

- **Breakpoints**: `apps/app/src/app/shared/utils/breakpoints.ts`
- **Navegación**: `apps/app/src/app/core/layout/components/navegacion/`
- **Ejemplo implementado**: `apps/app/src/app/features/ejercicios/pages/ejercicios-list/`
