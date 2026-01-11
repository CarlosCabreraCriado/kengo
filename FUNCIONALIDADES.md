# Kengo - Documentación de Funcionalidades

Kengo es una plataforma de gestión para fisioterapia diseñada para fisioterapeutas y pacientes. Permite gestionar catálogos de ejercicios, planes de tratamiento, seguimiento de progreso y administración de clínicas.

---

## Índice

1. [Autenticación y Seguridad](#1-autenticación-y-seguridad)
2. [Gestión de Usuarios y Roles](#2-gestión-de-usuarios-y-roles)
3. [Catálogo de Ejercicios](#3-catálogo-de-ejercicios)
4. [Planes de Tratamiento](#4-planes-de-tratamiento)
5. [Rutinas (Plantillas)](#5-rutinas-plantillas)
6. [Ejecución de Sesiones](#6-ejecución-de-sesiones)
7. [Actividad Diaria y Seguimiento](#7-actividad-diaria-y-seguimiento)
8. [Gestión de Pacientes](#8-gestión-de-pacientes)
9. [Gestión de Clínicas](#9-gestión-de-clínicas)
10. [Flujos Principales](#10-flujos-principales)

---

## 1. Autenticación y Seguridad

### 1.1 Métodos de Autenticación

| Método | Descripción |
|--------|-------------|
| **Email/Contraseña** | Login tradicional con credenciales |
| **Magic Link** | Autenticación sin contraseña mediante enlace mágico o código QR |
| **Invitaciones** | Aceptación de invitaciones de Directus con configuración de contraseña |

### 1.2 Gestión de Sesión

- Sesiones gestionadas mediante **cookies httpOnly** (seguridad mejorada)
- Verificación automática de sesión al navegar
- Interceptor HTTP que añade credenciales automáticamente a peticiones

### 1.3 Protección de Rutas

Rutas protegidas por `AuthGuard`:
- Verifica que el usuario esté autenticado
- Carga datos de usuario si no están disponibles
- Redirige a `/login` si no hay sesión válida

---

## 2. Gestión de Usuarios y Roles

### 2.1 Roles del Sistema

| Rol | Descripción | Capacidades |
|-----|-------------|-------------|
| **Fisioterapeuta** | Profesional sanitario | Crear planes, gestionar pacientes, configurar ejercicios |
| **Paciente** | Usuario que recibe tratamiento | Ejecutar planes asignados, registrar feedback |

### 2.2 Multi-Rol

Los usuarios pueden tener ambos roles simultáneamente:
- Toggle para cambiar entre modos fisio/paciente
- UI y servicios se adaptan al rol activo
- Listas de planes separadas según perspectiva

### 2.3 Perfil de Usuario

Datos gestionables:
- Nombre y apellidos
- Email y teléfono
- Avatar/foto de perfil
- Dirección y código postal
- Cambio de contraseña

---

## 3. Catálogo de Ejercicios

### 3.1 Funcionalidades del Catálogo

| Función | Descripción |
|---------|-------------|
| **Búsqueda** | Filtrado por texto con debounce de 500ms |
| **Categorías** | Filtrado múltiple por categorías |
| **Ordenación** | Por nombre (A-Z, Z-A) |
| **Paginación** | Configurable (24 items por defecto) |
| **Vistas** | Grid (viñetas) o lista |

### 3.2 Detalle de Ejercicio

Cada ejercicio contiene:
- Nombre y descripción
- Video demostrativo
- Imagen de portada
- Categorías asociadas
- Series y repeticiones por defecto

### 3.3 Gestión de Categorías

- Vista y gestión de categorías de ejercicios
- Asignación múltiple de categorías por ejercicio

---

## 4. Planes de Tratamiento

### 4.1 Estados del Plan

| Estado | Descripción |
|--------|-------------|
| `borrador` | Plan en preparación, no visible para paciente |
| `activo` | Paciente puede realizar los ejercicios |
| `completado` | Plan finalizado |
| `cancelado` | Plan descartado |

### 4.2 Configuración del Plan

Metadatos del plan:
- Título y descripción
- Paciente asignado
- Fecha de inicio y fin (opcional)
- Fisioterapeuta creador

### 4.3 Configuración por Ejercicio

Cada ejercicio en un plan tiene:

| Parámetro | Descripción | Default |
|-----------|-------------|---------|
| `series` | Número de series | 3 |
| `repeticiones` | Repeticiones por serie | 12 |
| `duracion_seg` | Duración si es temporizado | - |
| `descanso_seg` | Tiempo de descanso | 45s |
| `veces_dia` | Veces a realizar por día | 1 |
| `dias_semana` | Días programados | L, X, V |
| `instrucciones_paciente` | Notas para el paciente | - |
| `notas_fisio` | Notas internas del fisio | - |

### 4.4 Plan Builder

Constructor de planes con:
- **Carrito de ejercicios**: Metáfora de "carrito de compra" para añadir ejercicios
- **Drag & Drop**: Reordenación de ejercicios
- **Auto-guardado**: Persistencia en localStorage (TTL 7 días)
- **Restauración**: Recuperación automática de borradores

---

## 5. Rutinas (Plantillas)

### 5.1 Concepto

Las rutinas son plantillas reutilizables de ejercicios que pueden aplicarse a múltiples planes.

### 5.2 Visibilidad

| Tipo | Descripción |
|------|-------------|
| `privado` | Solo el autor puede usarla |
| `publico` | Disponible para todos los fisios de la organización |

### 5.3 Operaciones

- Crear rutina desde plan actual
- Cargar rutina como base para nuevo plan
- Duplicar rutinas existentes
- Editar nombre, descripción y visibilidad

---

## 6. Ejecución de Sesiones

### 6.1 Pantallas de Sesión

```
┌─────────────────────────────────────────────────────────────┐
│  RESUMEN  →  EJERCICIO  →  DESCANSO  →  FEEDBACK FINAL     │
└─────────────────────────────────────────────────────────────┘
```

| Pantalla | Descripción |
|----------|-------------|
| **Resumen** | Vista previa de ejercicios antes de comenzar |
| **Ejercicio Activo** | Video, temporizador/contador, instrucciones |
| **Descanso** | Timer de descanso con opción de saltar |
| **Feedback Final** | Escala de dolor y notas post-ejercicio |

### 6.2 Flujo de Ejercicio

1. Mostrar ejercicio con video e instrucciones
2. Usuario completa serie
3. Si hay más series → Descanso → Siguiente serie
4. Si es última serie → Siguiente ejercicio
5. Último ejercicio → Feedback final
6. Guardar registros en Directus

### 6.3 Persistencia de Sesión

- **Auto-guardado** en localStorage durante la sesión
- **TTL 24 horas** para recuperar sesiones interrumpidas
- **Restauración automática** al reabrir la app

### 6.4 Sesiones Multi-Plan

Permite ejecutar ejercicios de múltiples planes activos en una sola sesión.

---

## 7. Actividad Diaria y Seguimiento

### 7.1 Dashboard de Actividad

Vista del paciente que muestra:
- Planes activos para hoy
- Ejercicios programados según día de la semana
- Estado de completitud por ejercicio
- Progreso general del día

### 7.2 Indicadores de Estado

| Badge | Significado |
|-------|-------------|
| `pending` | Ejercicios pendientes (muestra cantidad) |
| `completed` | Todos completados |
| `rest` | Día de descanso |
| `loading` | Cargando datos |

### 7.3 Registro de Ejercicios

Cada ejecución registra:
- Fecha y hora de realización
- Repeticiones/duración realizadas
- Escala de dolor (0-10)
- Notas del paciente
- Estado de completitud

---

## 8. Gestión de Pacientes

### 8.1 Lista de Pacientes

- Vista de pacientes asociados al fisioterapeuta
- Búsqueda y filtrado
- Acceso rápido a planes del paciente

### 8.2 Detalle de Paciente

- Información de contacto
- Planes asignados (activos, completados, etc.)
- Historial de actividad
- Asignación de nuevos planes

### 8.3 Operaciones

| Acción | Descripción |
|--------|-------------|
| Ver planes | Listar todos los planes del paciente |
| Crear plan | Iniciar nuevo plan para el paciente |
| Editar plan | Modificar plan existente |
| Cancelar plan | Marcar plan como cancelado |

---

## 9. Gestión de Clínicas

### 9.1 Información de Clínica

Datos gestionables:
- Nombre y contacto
- Dirección y NIF
- Logo y color primario (branding)
- Galería de imágenes

### 9.2 Multi-Clínica

- Usuario puede pertenecer a múltiples clínicas
- Selector de clínica activa
- Puestos/roles diferentes por clínica

### 9.3 Equipo

- Lista de fisioterapeutas por clínica
- Directorio de profesionales
- Tarjetas de perfil de fisios

---

## 10. Flujos Principales

### 10.1 Flujo: Creación de Plan por Fisioterapeuta

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. Seleccionar paciente (/mis-pacientes)                           │
│                    ↓                                                 │
│  2. Navegar al catálogo (/ejercicios)                               │
│                    ↓                                                 │
│  3. Añadir ejercicios al carrito                                    │
│                    ↓                                                 │
│  4. Configurar cada ejercicio (series, días, instrucciones)         │
│                    ↓                                                 │
│  5. Configurar metadatos del plan (título, fechas)                  │
│                    ↓                                                 │
│  6. Revisar y enviar                                                │
│                    ↓                                                 │
│  7. Plan creado → Paciente puede empezar                            │
│                                                                      │
│  * Borrador auto-guardado localmente (7 días)                       │
│  * Recuperación automática si se interrumpe                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Flujo: Ejecución de Ejercicios por Paciente

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. Acceder a /mi-plan                                              │
│                    ↓                                                 │
│  2. Cargar plan activo                                              │
│                    ↓                                                 │
│  3. Ver resumen de ejercicios                                       │
│                    ↓                                                 │
│  4. Pulsar "Comenzar"                                               │
│                    ↓                                                 │
│  ┌────────────────────────────────────────┐                         │
│  │ Por cada ejercicio:                    │                         │
│  │   - Ver video + instrucciones          │                         │
│  │   - Completar series                   │                         │
│  │   - Descanso entre series              │                         │
│  └────────────────────────────────────────┘                         │
│                    ↓                                                 │
│  5. Feedback final (dolor + notas)                                  │
│                    ↓                                                 │
│  6. Guardar registros en servidor                                   │
│                    ↓                                                 │
│  7. Redirección a inicio                                            │
│                                                                      │
│  * Sesión auto-guardada (24 horas)                                  │
│  * Recuperación si se cierra la app                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.3 Flujo: Seguimiento Diario

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. Paciente accede a /actividad-diaria                             │
│                    ↓                                                 │
│  2. Sistema carga planes activos                                    │
│                    ↓                                                 │
│  3. Filtra ejercicios para hoy (según días_semana)                  │
│                    ↓                                                 │
│  4. Consulta registros del día                                      │
│                    ↓                                                 │
│  5. Calcula progreso (completados vs veces_dia)                     │
│                    ↓                                                 │
│  6. Muestra dashboard con:                                          │
│     - Badge de estado                                               │
│     - Porcentaje de progreso                                        │
│     - Lista de ejercicios pendientes                                │
│     - Opción de iniciar sesión                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.4 Flujo: Autenticación Magic Link

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. Usuario solicita magic link                                     │
│                    ↓                                                 │
│  2. Sistema genera token + código QR                                │
│                    ↓                                                 │
│  3. Usuario escanea QR o abre enlace                                │
│                    ↓                                                 │
│  4. Sistema consume token (/magic)                                  │
│                    ↓                                                 │
│  5. Sesión establecida sin contraseña                               │
│                    ↓                                                 │
│  6. Redirección a /inicio                                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Estructura de Navegación

```
/
├── login                    # Inicio de sesión
├── registro                 # Registro de usuario
├── magic                    # Handler de magic links
│
└── inicio/                  # Shell principal (protegido)
    ├── dashboard            # Panel principal
    ├── ejercicios           # Catálogo de ejercicios
    │   └── :id              # Detalle de ejercicio
    ├── mis-pacientes        # Lista de pacientes
    │   └── :id              # Detalle de paciente
    ├── mi-clinica           # Gestión de clínica
    ├── planes               # Gestión de planes
    │   ├── nuevo            # Crear plan
    │   ├── :id/editar       # Editar plan
    │   └── :id/resumen      # Ver plan
    ├── actividad-diaria     # Dashboard paciente (lazy)
    ├── mi-plan              # Ejecutar ejercicios (lazy)
    │   └── :planId          # Plan específico
    ├── perfil               # Configuración usuario
    ├── categorias           # Gestión categorías
    └── fisios               # Directorio fisios
```

---

## Tecnologías Clave

| Tecnología | Uso |
|------------|-----|
| **Angular 20** | Framework principal con standalone components |
| **Angular Material 20** | Componentes UI |
| **Tailwind CSS 4** | Estilos utility-first |
| **Signals** | Gestión de estado reactivo |
| **httpResource** | Caché y carga de datos HTTP |
| **Directus CMS** | Backend y gestión de contenido |
| **Node.js API** | Endpoints personalizados |
| **localStorage** | Persistencia de borradores y sesiones |

---

## Consideraciones de Rendimiento

- **Lazy Loading**: Módulos de actividad diaria y ejecución de planes
- **Debounce**: 500ms en búsqueda, 350ms en auto-guardado
- **Caché HTTP**: Mediante httpResource de Angular
- **Paginación**: Catálogo de ejercicios (24 items/página)
- **Responsive**: Detección desktop/móvil con BreakpointObserver
