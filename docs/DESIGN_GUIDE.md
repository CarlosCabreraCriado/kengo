# Kengo Design Guide

Guia de diseno para el desarrollo de interfaces en la aplicacion Kengo. Este documento captura el estilo visual, tono y patrones de diseno establecidos para garantizar consistencia en futuros desarrollos.

---

## 1. Filosofia de Diseno

Kengo adopta una estetica **premium mobile-first** con enfasis en:

- **Glassmorfismo sutil**: Superficies translucidas con blur que crean profundidad
- **Calidez visual**: Paleta de colores calidos inspirada en tonos coral y dorado
- **Interacciones fluidas**: Animaciones suaves y micro-interacciones que transmiten calidad
- **Claridad funcional**: Jerarquia visual clara que prioriza la accion principal

---

## 2. Sistema de Colores

### Colores Primarios

| Token | Valor | Uso |
|-------|-------|-----|
| `--kengo-primary` | `#e75c3e` | Color principal, CTAs, acentos, titulos |
| `--kengo-primary-dark` | `#c94a2f` / `#d14d30` | Hover states, gradientes |
| `--kengo-tertiary` | `#efc048` | Acentos secundarios, estados completados, favoritos |

### Colores de Estado

| Estado | Color | Uso |
|--------|-------|-----|
| Success | `#22c55e` | Acciones completadas, validaciones |
| Error | `red-400` / `red-600` | Errores, acciones destructivas |
| Warning | `#efc048` | Alertas, favoritos activos |

### Colores Neutros (Zinc scale)

```css
--zinc-400: #a1a1aa;  /* Texto secundario, iconos inactivos */
--zinc-500: #71717a;  /* Subtitulos, labels */
--zinc-600: #52525b;  /* Texto de cuerpo */
--zinc-700: #3f3f46;  /* Texto enfatizado */
--zinc-800: #27272a;  /* Titulos, texto principal */
```

### Sistema de Glassmorfismo

```css
--kengo-glass: rgba(255, 255, 255, 0.5);
--kengo-glass-strong: rgba(255, 255, 255, 0.7);
--kengo-border: rgba(255, 255, 255, 0.25);
--kengo-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
--kengo-shadow-primary: 0 4px 16px rgba(231, 92, 62, 0.35);
```

### Fondo de Aplicacion

El fondo caracteristico de Kengo es un gradiente calido:

```css
background-image: linear-gradient(
  to right top,
  #ffab6a,
  #ffb372,
  #ffba7a,
  #ffc282,
  #ffc98b,
  #ffce94,
  #ffd49e,
  #ffd9a7,
  #ffdeb3,
  #ffe3be,
  #ffe8ca,
  #ffedd6
);
```

---

## 3. Tipografia

### Fuentes

| Fuente | Uso | Peso |
|--------|-----|------|
| **kengoFont** (Field Gothic 45) | Titulos de marca, headings destacados | - |
| **Galvji** | Texto de cuerpo, UI general | 400, 700 |
| Material Symbols Outlined | Iconografia | Variable |

### Clases de Tipografia

```css
/* Titulo con fuente de marca */
.titulo-kengo {
  font-family: "kengoFont" !important;
}

/* Texto con color primario */
.fuente-kengo {
  font-family: "kengoFont";
  color: var(--color-primary);
}
```

### Escalas Tipograficas

| Elemento | Tamano (Mobile) | Tamano (Desktop) |
|----------|-----------------|------------------|
| Titulo principal | `text-2xl` (1.5rem) | `text-3xl` (1.875rem) |
| Titulo de seccion | `text-lg` (1.125rem) | `text-xl` (1.25rem) |
| Texto de cuerpo | `text-sm` (0.875rem) | `text-base` (1rem) |
| Labels/captions | `text-xs` (0.75rem) | `text-sm` (0.875rem) |

---

## 4. Iconografia

### Material Symbols Outlined

La aplicacion utiliza Material Symbols con configuracion variable:

```css
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  /* Configuracion base */
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}

/* Icono relleno (para estados activos) */
.relleno, .icon-filled {
  font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
}
```

### Iconos Comunes

| Contexto | Icono | Estado Inactivo | Estado Activo |
|----------|-------|-----------------|---------------|
| Inicio | `home` | Outline | Filled |
| Ejercicios | `fitness_center` | Outline | Filled |
| Favoritos | `star_border` / `star` | `text-zinc-400` | `text-[#efc048]` + filled |
| Navegacion | `arrow_back` | - | - |
| Reproducir | `play_arrow` / `pause` | - | Filled |
| Buscar | `search` | `text-[#e75c3e]` | - |

---

## 5. Componentes Base

### Tarjeta Glassmorfismo (`.tarjeta-kengo`)

```css
.tarjeta-kengo {
  @apply border !border-white/20 !bg-white/50 !shadow-xl !backdrop-blur-md;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

### Tarjeta de Contenido

```css
/* Card base con glassmorfismo */
.content-card {
  @apply relative rounded-2xl overflow-hidden;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Hover state */
.content-card:hover {
  @apply bg-white/70 -translate-y-0.5;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

### Boton Primario

```css
.btn-primary {
  @apply flex items-center justify-center gap-2
         h-12 px-6 rounded-xl
         text-white font-semibold
         cursor-pointer transition-all;
  background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
  box-shadow: 0 4px 16px rgba(231, 92, 62, 0.35);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(231, 92, 62, 0.45);
}

.btn-primary:active {
  @apply scale-[0.98];
}
```

### Boton Secundario (Glassmorfismo)

```css
.btn-secondary {
  @apply flex items-center justify-center
         h-10 px-4 rounded-xl
         text-zinc-600 font-medium
         cursor-pointer transition-all;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.btn-secondary:hover {
  @apply bg-white/80;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### Boton Circular (Icono)

```css
.btn-icon {
  @apply flex items-center justify-center
         w-10 h-10 rounded-full
         bg-white/60 backdrop-blur-md
         border border-white/40
         text-zinc-600 transition-all
         hover:bg-white/80 active:scale-95;
}
```

### Input de Busqueda

```css
.search-input {
  @apply h-12 w-full rounded-2xl
         bg-white/70 backdrop-blur-xl
         border border-white/50
         pl-11 pr-10
         text-zinc-800 text-sm font-medium
         placeholder:text-zinc-400
         shadow-sm shadow-black/5
         transition-all duration-300;
}

.search-input:focus {
  @apply bg-white/90 border-[#e75c3e]/40
         shadow-lg shadow-[#e75c3e]/10
         outline-none;
  transform: scale(1.01);
}
```

---

## 6. Layout y Espaciado

### Breakpoints

```css
/* Mobile first - breakpoints de Tailwind */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md - Navegacion desktop */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### Safe Areas (iOS)

```css
:host {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

/* Header con safe area */
.header {
  padding-top: calc(var(--safe-area-top) + 12px);
}

/* Contenido con padding para navegacion */
.main-content {
  padding-bottom: calc(var(--safe-area-bottom) + 100px);
}

/* Desktop: sin safe areas adicionales */
@media (min-width: 768px) {
  .main-content {
    padding-bottom: 2rem;
  }
}
```

### Contenedor Principal

```css
.page-container {
  @apply relative flex flex-col w-full h-full;
  max-width: 1200px;
  margin: 0 auto;
}
```

### Grid Responsivo

```css
/* Lista de items */
.items-grid {
  @apply grid gap-4;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .items-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .items-grid { grid-template-columns: repeat(3, 1fr); }
}
```

---

## 7. Header con Glassmorfismo

### Mobile Header

```css
.header-glass {
  @apply sticky top-0 z-50 w-full;
  padding: calc(env(safe-area-inset-top, 0px) + 20px) 20px 16px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 60%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Desktop: header transparente */
@media (min-width: 768px) {
  .header-glass {
    background: transparent;
    backdrop-filter: none;
  }
}
```

### Floating Header (Paginas de detalle)

```css
.floating-header {
  @apply absolute top-0 left-0 right-0 z-50
         flex items-center justify-between;
  padding: calc(var(--safe-top) + 12px) 16px 12px;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.5) 0%,
    transparent 100%
  );
}

.header-btn {
  @apply flex items-center justify-center
         w-11 h-11 rounded-full
         cursor-pointer transition-all active:scale-90;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-btn .material-symbols-outlined {
  @apply text-white text-xl;
}
```

---

## 8. Animaciones

### Tokens de Animacion

```css
--transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1);
--transition-fast: 0.2s ease-out;
--transition-slow: 0.5s ease;
```

### Fade In Up (Entrada de elementos)

```css
.animate-in {
  animation: fadeInUp 0.4s ease-out forwards;
  animation-delay: var(--delay, 0s);
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Card Fade In

```css
.card-animate {
  animation: cardFadeIn 0.4s ease-out backwards;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### Dropdown Slide In

```css
.dropdown {
  animation: dropdownFadeIn 0.2s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### Skeleton Shimmer

```css
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Loading Spinner

```css
.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid rgba(231, 92, 62, 0.2);
  border-top-color: #e75c3e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

## 9. Estados de UI

### Estado Vacio

```css
.empty-state {
  @apply flex flex-col items-center justify-center py-16 px-4;
}

.empty-state-icon {
  @apply w-24 h-24 rounded-full
         bg-gradient-to-br from-zinc-100 to-zinc-50
         flex items-center justify-center mb-6;
}

.empty-state-icon .material-symbols-outlined {
  @apply text-5xl text-zinc-300;
}

.empty-state-title {
  @apply text-xl font-bold text-zinc-800 mb-2;
}

.empty-state-text {
  @apply text-sm text-zinc-500 text-center max-w-xs;
}
```

### Estado de Error

```css
.error-card {
  @apply relative p-12 rounded-3xl text-center overflow-hidden;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.error-icon {
  @apply w-20 h-20 mx-auto rounded-2xl bg-red-50
         flex items-center justify-center mb-4;
}

.error-icon .material-symbols-outlined {
  @apply text-4xl text-red-400;
}
```

### Estado de Carga

```css
.loading-card {
  @apply relative p-12 rounded-3xl text-center overflow-hidden;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
}

.loading-icon {
  @apply w-20 h-20 mx-auto rounded-2xl
         flex items-center justify-center;
  background: linear-gradient(
    135deg,
    rgba(231, 92, 62, 0.15) 0%,
    rgba(239, 192, 72, 0.1) 100%
  );
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); opacity: 0.7; }
}
```

---

## 10. Patrones de Interaccion

### Hover Effects

```css
/* Elevacion en hover */
.card:hover {
  @apply -translate-y-1;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

/* Scale en hover para imagenes */
.card:hover img {
  transform: scale(1.1);
}

/* Transicion de color en iconos */
.btn:hover .material-symbols-outlined {
  @apply text-[#e75c3e];
}
```

### Active States

```css
/* Reduccion de escala al presionar */
.btn:active {
  @apply scale-95;
}

.card:active {
  @apply scale-[0.98];
}
```

### Focus States

```css
/* Ring de enfoque con color primario */
.btn:focus-visible {
  @apply ring-2 ring-[#e75c3e]/50 ring-offset-2 outline-none;
}

/* Input con glow */
.input:focus {
  @apply border-[#e75c3e]/40 shadow-lg shadow-[#e75c3e]/10;
}
```

---

## 11. Badges y Chips

### Badge de Estado

```css
.badge {
  @apply flex items-center gap-1.5
         rounded-2xl px-3 py-1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Badge pendiente */
.badge-pending {
  background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
}

/* Badge completado */
.badge-completed {
  background: linear-gradient(135deg, #efc048 0%, #d4a93d 100%);
}

/* Badge descanso */
.badge-rest {
  @apply bg-slate-500/80;
  backdrop-filter: blur(8px);
}
```

### Duration Chips

```css
.duration-chip {
  @apply px-4 py-2 rounded-full
         text-sm font-semibold
         cursor-pointer transition-all active:scale-95;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  color: #64748b;
}

.duration-chip:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(231, 92, 62, 0.3);
  color: #e75c3e;
}

.duration-chip.active {
  background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 6px 24px rgba(231, 92, 62, 0.4);
}
```

---

## 12. Progress Bar

```css
.progress-track {
  @apply flex-1 h-2 rounded-full bg-black/10 overflow-hidden;
}

.progress-fill {
  @apply h-full rounded-full transition-all duration-500;
  background: linear-gradient(90deg, #e75c3e 0%, #efc048 100%);
}

.progress-text {
  @apply text-xs font-medium text-zinc-500 whitespace-nowrap;
}
```

---

## 13. Scrollbar Personalizada

```css
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(231, 92, 62, 0.3) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(231, 92, 62, 0.3);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(231, 92, 62, 0.5);
}
```

---

## 14. Dialogos y Overlays

```css
/* Overlay backdrop */
.cdk-overlay-backdrop {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Menu desplegable */
.dropdown-menu {
  @apply absolute rounded-2xl overflow-hidden;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15),
              0 2px 10px rgba(0, 0, 0, 0.1);
}
```

---

## 15. Especificaciones por Pagina

### Dashboard (Inicio)

- Hero card con estado dinamico (pendiente/completado/descanso)
- Ondas animadas de fondo segun estado
- Grid de acciones rapidas con imagenes
- Bonsai decorativo con opacidad baja

### Lista de Ejercicios

- Header sticky con glassmorfismo (solo mobile)
- Barra de busqueda con efecto glow
- Dropdown de categorias con checkboxes custom
- Toggle de vista (lista/cuadricula)
- Cards con animacion de entrada escalonada
- Skeleton loading con shimmer

### Detalle de Ejercicio

- Video a pantalla completa con gestos
- Panel inferior deslizable (bottom sheet)
- Aurora background decorativa
- Layout de dos columnas en desktop
- Indicador de play/pause animado

### Login

- Card centrada con glassmorfismo
- Logo prominente con el nombre "Kengo"
- Inputs con transiciones suaves
- Spinner de carga integrado

---

## 16. Consideraciones de Accesibilidad

### Contraste de Colores

- Texto principal sobre fondo claro: `zinc-800` minimo
- Texto secundario: `zinc-500` minimo
- Botones primarios: blanco sobre `#e75c3e`

### Focus Visible

Todos los elementos interactivos deben tener un estado de focus visible:

```css
.interactive:focus-visible {
  @apply outline-none ring-2 ring-[#e75c3e]/50 ring-offset-2;
}
```

### ARIA Labels

```html
<button aria-label="Volver al inicio">
<button [attr.aria-expanded]="menuAbierto()">
<nav aria-label="Paginacion">
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 17. Checklist de Implementacion

Al crear nuevas paginas o componentes, verificar:

- [ ] Usa las variables de color CSS definidas
- [ ] Aplica glassmorfismo donde corresponde
- [ ] Headers con safe areas en mobile
- [ ] Animaciones de entrada (fadeInUp)
- [ ] Estados de hover/active/focus
- [ ] Loading state con skeleton o spinner
- [ ] Empty state con icono e instrucciones
- [ ] Error state con opcion de reintentar
- [ ] Tipografia con escala correcta
- [ ] Iconos de Material Symbols con estados filled
- [ ] Layout responsivo mobile-first
- [ ] Aria labels en elementos interactivos

---

*Documento generado para el proyecto Kengo - Plataforma de Fisioterapia*
*Ultima actualizacion: Enero 2026*
