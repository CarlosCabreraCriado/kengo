# Kengo Design Inspiration

Este documento captura la esencia del estilo visual de Kengo, una aplicación de fisioterapia con una estética moderna, cálida y accesible. Úsalo como guía de inspiración para crear nuevas aplicaciones con un look & feel similar.

---

## 1. Filosofía de Diseño

### Principios Fundamentales

- **Mobile-first**: La interfaz prioriza la experiencia en dispositivos móviles
- **App-like**: La UI debe sentirse como una aplicación nativa, no como una web tradicional. Esto implica navegación por gestos, acciones rápidas accesibles, información compacta y feedback táctil inmediato
- **Tailwind-first**: Los estilos deben implementarse con clases de Tailwind CSS siempre que sea posible, reservando CSS personalizado solo para casos que Tailwind no cubra (animaciones complejas, gradientes específicos, etc.)
- **Glassmorphism**: Transparencias y desenfoque como firma visual distintiva
- **Calidez**: Paleta cálida que transmite confianza y profesionalismo en el ámbito de la salud
- **Simplicidad**: Interfaces limpias que no abruman al usuario
- **Fluidez**: Animaciones sutiles que guían la atención sin distraer

### Sensación Buscada

La aplicación debe sentirse como un espacio acogedor y profesional. Los colores cálidos (coral, dorado, melocotón) evocan energía positiva y vitalidad, mientras que los efectos de cristal y las transparencias añaden un toque moderno y sofisticado.

---

## 2. Paleta de Colores

### Colores Principales

| Nombre | Hex | Uso |
|--------|-----|-----|
| **Primary (Coral)** | `#e75c3e` | Botones principales, acentos, enlaces activos |
| **Tertiary (Gold)** | `#efc048` | Estados completados, badges, highlights |
| **On Primary** | `#ffffff` | Texto sobre fondos primarios |

### Colores de Superficie (Light Mode)

| Nombre | Hex | Uso |
|--------|-----|-----|
| **Background** | `#fef8f7` | Fondo general de la app |
| **Surface** | `#fef8f7` | Tarjetas y contenedores |
| **Surface Variant** | `#ffede8` | Variante de superficie con tinte cálido |
| **Surface Container** | `#f3eceb` | Contenedores secundarios |

### Colores de Superficie (Dark Mode)

| Nombre | Hex | Uso |
|--------|-----|-----|
| **Background** | `#151313` | Fondo general oscuro |
| **Surface** | `#151313` | Tarjetas en modo oscuro |
| **Primary (Dark)** | `#ffb4a4` | Acentos en modo oscuro |
| **Tertiary (Dark)** | `#efc048` | Gold se mantiene igual |

### Colores Semánticos

| Estado | Color | Hex |
|--------|-------|-----|
| **Error** | Rojo intenso | `#d10b00` |
| **Success** | Gold/Verde | `#efc048` / `#86efac` |
| **Neutral** | Gris cálido | `#64748b` |

### Gradientes Característicos

```css
/* Fondo principal de la aplicación */
background-image: linear-gradient(
  to right top,
  #ffab6a, #ffb372, #ffba7a, #ffc282,
  #ffc98b, #ffce94, #ffd49e, #ffd9a7,
  #ffdeb3, #ffe3be, #ffe8ca, #ffedd6
);

/* Overlay en tarjetas con imagen */
background: linear-gradient(
  180deg,
  transparent 50%,
  #f9b87e 75%,
  #e75c3e 100%
);

/* Botones CTA */
background: linear-gradient(135deg, #e75c3e, #d14d30);

/* Estado completado */
background: linear-gradient(135deg, #efc048, #d4a93d);

/* Avatar con gradiente */
background: linear-gradient(135deg, #e75c3e, #efc048);
```

---

## 3. Tipografía

### Fuentes

| Fuente | Uso | Características |
|--------|-----|-----------------|
| **FieldGothic** | Logo, títulos de marca | Condensada, impactante, industrial |
| **Galvji** | UI general, cuerpo de texto | Geométrica, legible, moderna |

### Jerarquía Tipográfica

```css
/* Títulos de marca */
.titulo-kengo {
  font-family: "kengoFont" (FieldGothic);
  color: #e75c3e;
}

/* UI general */
body {
  font-family: Galvji, "Helvetica Neue", sans-serif;
}

/* Pesos disponibles */
--bold-weight: 700;
--medium-weight: 500;
--regular-weight: 400;
```

### Escalas de Texto Recomendadas

- **Display/Hero**: 1.75rem - 2rem
- **Títulos de sección**: 1.25rem - 1.5rem
- **Subtítulos**: 1rem
- **Cuerpo**: 0.875rem - 1rem
- **Caption/Labels**: 0.75rem - 0.85rem

---

## 4. Componentes UI - Glassmorphism

### La Tarjeta Kengo (Componente Estrella)

```css
.tarjeta-kengo {
  /* Borde semitransparente */
  border: 1px solid rgba(255, 255, 255, 0.2);

  /* Fondo con transparencia */
  background: rgba(255, 255, 255, 0.5);

  /* Sombra elevada */
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  /* El efecto clave: blur del fondo */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Versión modo oscuro */
.dark .tarjeta-kengo {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.1);
}
```

### Botones

```css
/* Botón primario CTA */
.cta-button {
  background: linear-gradient(135deg, #e75c3e, #d14d30);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 0.875rem 1.5rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(231, 92, 62, 0.35);
  transition: all 0.2s ease;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(231, 92, 62, 0.45);
}

/* Botón secundario/ghost */
.btn-secondary {
  color: #64748b;
  background: transparent;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.btn-secondary:hover {
  color: #e75c3e;
  background-color: rgba(231, 92, 62, 0.1);
}
```

### Campos de Formulario

```css
/* Campo compacto con bordes redondeados */
.ff-compact .mat-mdc-text-field-wrapper {
  border-radius: 9999px; /* Totalmente redondeado */
  height: 50px;
}

/* Autofill con color de marca */
input:-webkit-autofill {
  box-shadow: 0 0 0px 1000px #e9fcff inset;
  -webkit-text-fill-color: #000;
}
```

### Badges y Estados

```css
/* Badge pendiente */
.badge-pending {
  background: #e75c3e;
  padding: 0.5rem 0.75rem;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Badge completado */
.badge-completed {
  background: #efc048;
  border-radius: 50%;
}

/* Badge con glass effect */
.badge-loading {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
}
```

---

## 5. Patrones de Layout

### Grid Responsivo

```css
/* Mobile: 1 columna */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

/* Tablet (768px+): 2 columnas */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
}

/* Desktop (1024px+): 3 columnas */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    max-width: 1400px;
  }
}
```

### Carrusel Horizontal (Mobile)

```css
.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 2rem 5%;

  /* Ocultar scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.card {
  flex: 0 0 90%;
  scroll-snap-align: center;
  scroll-snap-stop: always;
}
```

### Safe Areas (iOS)

```css
/* Padding para contenido con navegación inferior */
.pb-nav {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 6rem);
}

@media (min-width: 768px) {
  .pb-nav {
    padding-bottom: 1.5rem;
  }
}

/* Header con safe area */
.header {
  padding-top: env(safe-area-inset-top, 0);
}
```

### Navegación Inferior

```css
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: #e75c3e;
  background: rgba(231, 92, 62, 0.1);
}

.nav-item.active {
  color: #e75c3e;
  background: rgba(231, 92, 62, 0.15);
}

.nav-item.active .nav-icon {
  transform: scale(1.1);
}
```

---

## 6. Enfoque App-Like

### Filosofía de Diseño de Aplicación

Kengo debe sentirse como una **aplicación nativa**, no como una página web tradicional. Esto significa priorizar la usabilidad táctil, la densidad de información adecuada y patrones de interacción familiares para usuarios de iOS/Android.

### Principios App-Like

#### 1. Información Compacta y Jerarquizada

- **Evitar scroll infinito**: Organizar el contenido en secciones colapsables/expandibles
- **Priorizar lo importante**: La información crítica debe ser visible sin scroll
- **Densidad adecuada**: Ni demasiado espaciado (web) ni demasiado denso (ilegible)

```html
<!-- Sección colapsable -->
<section class="rounded-3xl bg-white/50 backdrop-blur-md overflow-hidden">
  <header class="flex items-center justify-between p-4 cursor-pointer"
          (click)="toggleSection()">
    <h3 class="font-semibold">Título de sección</h3>
    <span class="material-symbols-outlined transition-transform"
          [class.rotate-180]="expanded">expand_more</span>
  </header>
  @if (expanded) {
    <div class="px-4 pb-4"><!-- contenido --></div>
  }
</section>
```

#### 2. Quick Actions Prominentes

Las acciones principales deben estar siempre accesibles con un solo toque:

```html
<!-- Grid de acciones rápidas -->
<div class="grid grid-cols-4 gap-2">
  <button class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl
                 bg-white/50 border border-white/40 active:scale-95">
    <div class="w-11 h-11 rounded-xl bg-[#e75c3e] flex items-center justify-center">
      <span class="material-symbols-outlined text-white">call</span>
    </div>
    <span class="text-xs font-medium text-zinc-600">Llamar</span>
  </button>
  <!-- más acciones... -->
</div>
```

#### 3. Navegación Tipo App

- **Headers compactos**: Título + acciones, sin navegación redundante
- **Bottom sheets** para selección en lugar de dropdowns tradicionales
- **Gestos de swipe** donde sea apropiado
- **Pull to refresh** en listas

```html
<!-- Header estilo app -->
<header class="sticky top-0 z-50 px-4 py-3 bg-white/80 backdrop-blur-xl">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button class="w-10 h-10 rounded-full bg-white/60 active:scale-95">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 class="titulo-kengo text-xl text-[#e75c3e]">Título</h1>
    </div>
    <button class="w-10 h-10 rounded-full bg-white/60">
      <span class="material-symbols-outlined">more_vert</span>
    </button>
  </div>
</header>
```

#### 4. Feedback Táctil Inmediato

Cada interacción debe tener respuesta visual instantánea:

```html
<!-- Elemento con feedback táctil -->
<button class="transition-all duration-150
               active:scale-95 active:opacity-80
               hover:bg-white/70 hover:-translate-y-0.5">
  Acción
</button>
```

#### 5. Estados de Carga Inline

Mostrar estados de carga dentro del contexto, no modales bloqueantes:

```html
<!-- Skeleton loading inline -->
<div class="animate-pulse">
  <div class="h-4 bg-zinc-200/50 rounded-lg w-3/4 mb-2"></div>
  <div class="h-3 bg-zinc-200/50 rounded-lg w-1/2"></div>
</div>

<!-- Shimmer effect -->
<div class="relative overflow-hidden">
  <div class="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]
              bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
</div>
```

#### 6. Listas Compactas con Avatar Stack

Para mostrar múltiples elementos (usuarios, items) de forma compacta:

```html
<!-- Avatar stack -->
<div class="flex items-center">
  @for (item of items.slice(0, 4); track item.id; let i = $index) {
    <div class="w-10 h-10 rounded-full border-[3px] border-white -ml-3 first:ml-0"
         [style.z-index]="10 - i">
      <img [src]="item.avatar" class="w-full h-full rounded-full object-cover"/>
    </div>
  }
  @if (items.length > 4) {
    <div class="w-10 h-10 rounded-full border-[3px] border-white -ml-3
                bg-zinc-600 text-white text-xs font-bold
                flex items-center justify-center">
      +{{ items.length - 4 }}
    </div>
  }
</div>
```

### Patrones Anti-Web (Evitar)

| ❌ Patrón Web Tradicional | ✅ Patrón App-Like |
|---------------------------|-------------------|
| Páginas con mucho scroll vertical | Secciones colapsables y tabs |
| Formularios largos en una página | Formularios paso a paso (wizard) |
| Dropdowns/selects nativos | Bottom sheets o pickers custom |
| Modales centrados grandes | Sheets que emergen desde abajo |
| Hover states como única interacción | Estados active/pressed para touch |
| Breadcrumbs | Navegación con back button |
| Sidebars siempre visibles | Menús que se ocultan/muestran |
| Links de texto subrayados | Botones y cards tocables |

### Ejemplo de Estructura de Página App-Like

```html
<section class="flex flex-col h-full">
  <!-- Header fijo compacto -->
  <header class="sticky top-0 z-50 shrink-0">...</header>

  <!-- Contenido scrolleable -->
  <main class="flex-1 overflow-y-auto px-4 pb-safe">
    <!-- Hero/Card principal compacto -->
    <article class="rounded-3xl overflow-hidden mb-4">...</article>

    <!-- Quick actions siempre visibles -->
    <section class="grid grid-cols-4 gap-2 mb-4">...</section>

    <!-- Info cards en grid compacto -->
    <section class="grid grid-cols-2 gap-3 mb-4">...</section>

    <!-- Secciones colapsables para contenido secundario -->
    <section class="rounded-3xl overflow-hidden">
      <header (click)="toggle()">...</header>
      @if (expanded) { <div>...</div> }
    </section>
  </main>

  <!-- Navegación inferior (si aplica) -->
  <nav class="sticky bottom-0 shrink-0 pb-safe">...</nav>
</section>
```

---

## 7. Animaciones y Transiciones

### Transiciones Estándar

```css
/* Transición suave para hover */
transition: all 0.2s ease;

/* Transición para transformaciones */
transition: transform 0.3s ease, box-shadow 0.3s ease;

/* Transición para imágenes */
transition: transform 0.5s ease;
```

### Animación de Entrada (Fade + Scale)

```css
@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.element-enter {
  animation: fadeInScale 0.3s ease-out;
}
```

### Animación Aurora (Ondas de Fondo)

```css
@keyframes auroraFloat {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.6;
  }
  25% {
    transform: translate(5%, 10%) scale(1.1);
    opacity: 0.8;
  }
  50% {
    transform: translate(-5%, 5%) scale(0.95);
    opacity: 0.7;
  }
  75% {
    transform: translate(3%, -5%) scale(1.05);
    opacity: 0.85;
  }
}
```

### Fondo Animado con Burbujas

```css
.kengoBackground span {
  width: 70vmin;
  height: 70vmin;
  border-radius: 70vmin;
  position: absolute;
  animation: move 39s linear infinite;
  color: #f9b87e;
}

@keyframes move {
  100% {
    transform: translate3d(0, 0, 1px) rotate(360deg);
  }
}
```

### Interacciones de Hover

```css
/* Tarjeta: elevación + zoom imagen */
.card:hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.card:hover .card-image {
  transform: scale(1.05);
}

/* Botón: elevación */
.button:hover {
  transform: translateY(-2px);
}

/* Presionado */
.card:active {
  transform: scale(0.98);
}
```

### Spinner de Carga

```css
.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 8. Iconografía

### Sistema de Iconos

- **Librería principal**: Material Symbols (Google)
- **Estilo**: Outlined por defecto, Filled para estados activos
- **Tamaños**: 1.25rem (navegación), 1.5rem (acciones), 1.75rem (destacados)

### Iconos Rellenos (Filled)

```css
.relleno {
  font-variation-settings:
    "FILL" 1,
    "wght" 400,
    "GRAD" 0,
    "opsz" 24;
}
```

### Iconos con Color de Marca

```css
mat-icon {
  color: #e75c3e; /* Primary */
}

/* Sobre fondos oscuros */
mat-icon.on-dark {
  color: white;
}
```

### Filtro para Logo/Imágenes

```css
/* Convertir imagen a color primario */
.logo {
  filter: brightness(0) saturate(100%)
          invert(42%) sepia(93%) saturate(636%)
          hue-rotate(338deg) brightness(97%) contrast(89%);
}
```

---

## 9. Modo Oscuro

### Activación

```css
/* Clase .dark en el elemento raíz */
.dark {
  /* Sobrescribir variables de tema */
}

/* O mediante media query del sistema */
@media (prefers-color-scheme: dark) {
  :root {
    /* Variables oscuras */
  }
}
```

### Ajustes Clave

```css
.dark {
  /* Superficies */
  --background: #151313;
  --surface: #151313;

  /* Colores primarios más suaves */
  --primary: #ffb4a4;
  --tertiary: #efc048;

  /* Texto */
  --on-surface: #e7e1e0;

  /* Glassmorphism ajustado */
  .tarjeta-kengo {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.1);
  }
}
```

---

## 10. Código CSS de Referencia Completo

### Variables CSS Globales

```css
:root {
  /* Colores principales */
  --color-primary: #e75c3e;
  --color-tertiary: #efc048;
  --color-background: #fef8f7;
  --color-surface: #fef8f7;
  --color-on-primary: #ffffff;
  --color-on-surface: #1d1b1b;
  --color-neutral: #64748b;
  --color-error: #d10b00;

  /* Tipografía */
  --font-brand: "kengoFont", sans-serif;
  --font-ui: "Galvji", "Helvetica Neue", sans-serif;
  --font-weight-bold: 700;
  --font-weight-medium: 500;
  --font-weight-regular: 400;

  /* Espaciado */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Bordes */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.3);
  --shadow-primary: 0 4px 12px rgba(231, 92, 62, 0.35);

  /* Transiciones */
  --transition-fast: 0.2s ease;
  --transition-medium: 0.3s ease;
  --transition-slow: 0.5s ease;

  /* Blur para glassmorphism */
  --blur-sm: 8px;
  --blur-md: 12px;
  --blur-lg: 20px;
}
```

### Clases Utilitarias

```css
/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Sombra primaria */
.shadow-primary {
  box-shadow: var(--shadow-primary);
}

/* Texto con color primario */
.text-primary {
  color: var(--color-primary);
}

/* Fuente de marca */
.font-brand {
  font-family: var(--font-brand);
}

/* Ocultar scrollbar */
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
```

---

## 11. Recursos y Assets

### Fuentes Requeridas

1. **FieldGothic-45.otf** - Para el logo y títulos de marca
2. **Galvji** (Regular, Bold, Oblique, Bold-Oblique) - Para toda la UI

### Dependencias CSS/JS

- **Tailwind CSS 4** - Framework de utilidades
- **Angular Material 20** - Componentes base
- Material Symbols (Google Fonts) - Iconografía

### Imágenes de Ejemplo

- Fondos con gradientes cálidos
- Ilustraciones de línea simple
- Iconos monocromáticos que se pueden colorear con filtros CSS

---

## 12. Implementación con Tailwind CSS

### Filosofía Tailwind-First

**IMPORTANTE**: Todos los estilos deben implementarse prioritariamente con clases de Tailwind CSS. Solo se debe recurrir a CSS personalizado cuando:

1. Tailwind no tenga una utilidad equivalente (ej: `backdrop-filter`, gradientes complejos)
2. Se necesiten animaciones con `@keyframes`
3. Se requieran pseudo-elementos complejos (`:before`, `:after`)
4. Estilos que dependan de variables CSS dinámicas

### Equivalencias Tailwind para Estilos Kengo

#### Glassmorphism

```html
<!-- Tarjeta Kengo en Tailwind -->
<div class="bg-white/50 backdrop-blur-md border border-white/20 rounded-3xl shadow-xl">
  <!-- contenido -->
</div>

<!-- Con hover -->
<div class="bg-white/50 backdrop-blur-md border border-white/20 rounded-3xl
            shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl">
  <!-- contenido -->
</div>
```

#### Colores de Marca (usar valores arbitrarios)

```html
<!-- Primary coral -->
<button class="bg-[#e75c3e] text-white hover:bg-[#c94a2f]">
  Botón primario
</button>

<!-- Tertiary gold -->
<span class="text-[#efc048]">Completado</span>

<!-- Background cálido -->
<div class="bg-[#fef8f7]">...</div>
```

#### Tipografía

```html
<!-- Título de marca -->
<h1 class="titulo-kengo text-[#e75c3e] text-2xl">Mi Título</h1>

<!-- Texto UI -->
<p class="text-sm font-medium text-zinc-700">Texto normal</p>

<!-- Caption -->
<span class="text-xs font-medium text-zinc-400 uppercase tracking-wide">Label</span>
```

#### Botones

```html
<!-- CTA Primary -->
<button class="inline-flex items-center justify-center gap-2
               px-6 py-3 rounded-xl
               bg-gradient-to-br from-[#e75c3e] to-[#c94a2f]
               text-white font-semibold
               shadow-[0_4px_12px_rgba(231,92,62,0.35)]
               transition-all hover:-translate-y-0.5 hover:shadow-lg
               active:scale-[0.98]">
  <span class="material-symbols-outlined">check</span>
  Confirmar
</button>

<!-- Secondary/Ghost -->
<button class="inline-flex items-center justify-center gap-2
               px-4 py-2.5 rounded-xl
               bg-transparent border-[1.5px] border-[#e75c3e]/30
               text-[#e75c3e] text-sm font-medium
               transition-all hover:bg-[#e75c3e]/10 hover:border-[#e75c3e]">
  Cancelar
</button>
```

#### Layout Responsivo

```html
<!-- Grid responsivo 1-2-3 columnas -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  <!-- cards -->
</div>

<!-- Padding con safe areas -->
<main class="px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-8">
  <!-- contenido -->
</main>
```

#### Cards de Información

```html
<div class="flex items-center gap-3 p-3.5
            bg-white/50 border border-white/40 rounded-2xl
            transition-all hover:bg-white/70 hover:-translate-y-0.5">
  <div class="w-10 h-10 rounded-xl bg-[#e75c3e]/10
              flex items-center justify-center shrink-0">
    <span class="material-symbols-outlined text-xl text-[#e75c3e]">phone</span>
  </div>
  <div class="flex flex-col min-w-0">
    <span class="text-[0.7rem] font-medium text-zinc-400 uppercase tracking-wide">Teléfono</span>
    <span class="text-sm font-medium text-zinc-700 truncate">+34 612 345 678</span>
  </div>
</div>
```

#### Avatares

```html
<!-- Avatar con imagen -->
<div class="w-12 h-12 rounded-full overflow-hidden border-[3px] border-white shadow-md">
  <img src="..." class="w-full h-full object-cover" alt="..."/>
</div>

<!-- Avatar con iniciales -->
<div class="w-12 h-12 rounded-full
            bg-gradient-to-br from-[#e75c3e] to-[#efc048]
            flex items-center justify-center
            text-white font-bold text-lg
            border-[3px] border-white shadow-md">
  AB
</div>
```

### Cuándo Usar CSS Personalizado

Reservar CSS custom (en archivos `.component.css`) para:

```css
/* 1. Animaciones complejas */
@keyframes auroraFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, 40px) scale(1.15); }
}

/* 2. Gradientes que no se pueden expresar en Tailwind */
.hero-gradient {
  background: linear-gradient(
    135deg,
    var(--clinic-color, #e75c3e) 0%,
    #f9b87e 50%,
    #efc048 100%
  );
}

/* 3. Efectos especiales */
.status-dot {
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
  animation: pulse 2s ease-in-out infinite;
}

/* 4. Fuentes personalizadas */
.titulo-kengo {
  font-family: "kengoFont", sans-serif;
}
```

### Estructura Recomendada de Archivos CSS

```css
@reference "tailwindcss";

/* === Variables CSS (solo las necesarias) === */
:host {
  --kengo-primary: #e75c3e;
  --kengo-tertiary: #efc048;
}

/* === Animaciones === */
@keyframes fadeInUp { ... }
@keyframes shimmer { ... }

/* === Clases que requieren CSS puro === */
.titulo-kengo { font-family: "kengoFont", sans-serif; }
.gradient-primary { background: linear-gradient(135deg, #e75c3e, #c94a2f); }

/* === El resto debe estar en el HTML con Tailwind === */
```

---

## Resumen de la Identidad Visual

| Aspecto | Descripción |
|---------|-------------|
| **Estilo** | Glassmorphism moderno con paleta cálida |
| **Sensación** | Profesional pero acogedor, como una clínica premium |
| **Color dominante** | Coral (#e75c3e) con acentos dorados |
| **Tipografía** | Sans-serif geométrica, limpia y legible |
| **Componente estrella** | Tarjetas con backdrop-blur y bordes translúcidos |
| **Animaciones** | Sutiles, orgánicas (aurora waves), transiciones suaves |
| **Responsive** | Mobile-first con grid adaptativo 1-2-3 columnas |

---

*Documento generado como referencia de diseño para el proyecto Kengo. Última actualización: Enero 2026.*
