# Análisis de Kengo para Landing Page

## 1. Propósito de la Aplicación

**Kengo es una plataforma de gestión de tratamientos de fisioterapia** que conecta a fisioterapeutas con sus pacientes, permitiendo crear planes de ejercicios personalizados, guiar su ejecución y hacer seguimiento del progreso.

### Problema que resuelve

- Los fisioterapeutas necesitan una forma eficiente de prescribir y monitorizar ejercicios fuera de consulta
- Los pacientes olvidan los ejercicios o no los realizan correctamente en casa
- No existe feedback sobre adherencia al tratamiento ni sobre el nivel de dolor/dificultad
- La comunicación fisio-paciente entre sesiones es limitada

### Propuesta de valor

> "Tu fisio, siempre contigo. Planes de ejercicios personalizados con vídeos guiados, seguimiento de progreso y feedback en tiempo real."

---

## 2. Funcionalidades Principales

### Para Fisioterapeutas

| Funcionalidad | Descripción | Beneficio |
|---------------|-------------|-----------|
| **Catálogo de ejercicios** | +500 ejercicios con vídeo profesional, organizados por categorías | Encuentra el ejercicio perfecto en segundos |
| **Constructor de planes** | Creador visual drag & drop con asignación por días de la semana | Planes personalizados en minutos, no horas |
| **Plantillas reutilizables** | Guarda planes exitosos como rutinas para futuros pacientes | Estandariza tratamientos, ahorra tiempo |
| **Gestión de pacientes** | Lista de pacientes, historial de planes, datos de contacto | Todo organizado en un solo lugar |
| **Seguimiento de adherencia** | Métricas de cumplimiento, racha de días, escala de dolor | Datos objetivos para ajustar tratamientos |
| **Generación de códigos QR** | Invita pacientes con un código único de 8 caracteres | Onboarding sin fricciones |

### Para Pacientes

| Funcionalidad | Descripción | Beneficio |
|---------------|-------------|-----------|
| **Actividad diaria** | Vista clara de ejercicios del día con progreso visual | Sabe exactamente qué hacer hoy |
| **Sesiones guiadas** | Vídeo de cada ejercicio + contador de series + temporizador de descanso | Como tener al fisio en casa |
| **Registro de feedback** | Escala de dolor, dificultad percibida, notas personales | El fisio sabe cómo te sientes |
| **Calendario semanal** | Vista de próximos 7 días con ejercicios asignados | Planifica tu semana de recuperación |
| **Historial de progreso** | Sesiones completadas, evolución del dolor, racha actual | Visualiza tu mejora día a día |

### Para Clínicas

| Funcionalidad | Descripción | Beneficio |
|---------------|-------------|-----------|
| **Multi-clínica** | Un usuario puede pertenecer a varias clínicas | Flexibilidad para profesionales |
| **Gestión de equipo** | Administra fisioterapeutas y pacientes de tu clínica | Control centralizado |
| **Códigos de acceso** | Genera invitaciones para fisios (admin) o pacientes (admin/fisio) | Escala tu equipo de forma segura |
| **Personalización** | Logo, colores corporativos, datos de la clínica | Tu marca, tu identidad |

---

## 3. Modelo de Usuarios y Roles

### Tres tipos de usuarios

```
                    ┌──────────────────┐
                    │   ADMINISTRADOR  │
                    │   de Clínica     │
                    └────────┬─────────┘
                             │ genera códigos
              ┌──────────────┴──────────────┐
              ▼                              ▼
    ┌─────────────────┐            ┌─────────────────┐
    │ FISIOTERAPEUTA  │───crea────▶│    PACIENTE     │
    │                 │   planes   │                 │
    └─────────────────┘            └─────────────────┘
              │                              │
              │ genera códigos               │ ejecuta planes
              │ de paciente                  │ da feedback
              ▼                              ▼
```

### Flujo típico de uso

1. **Fisioterapeuta** se registra y crea su clínica (se convierte en admin automáticamente)
2. **Genera un código** de acceso tipo "paciente"
3. **Paciente** se registra con el código → queda vinculado a la clínica
4. **Fisio crea un plan** personalizado con ejercicios asignados por días
5. **Paciente ve su actividad diaria** y realiza la sesión guiada
6. **Registra feedback** (dolor, dificultad, notas)
7. **Fisio monitoriza** adherencia y ajusta el plan según necesidad

---

## 4. Tono y Espíritu de la Marca

### Identidad visual

| Elemento | Valor | Significado |
|----------|-------|-------------|
| **Color primario** | `#e75c3e` (coral/naranja) | Calidez, energía, vitalidad, salud |
| **Color secundario** | `#efc048` (dorado) | Logro, celebración, progreso |
| **Fondos** | Degradados cálidos melocotón + glassmorfismo | Premium pero accesible, moderno y luminoso |
| **Tipografía** | FieldGothic (títulos) + Galvji (cuerpo) | Moderna, confiable, legible |

### Personalidad de marca

- **Cálido y cercano**: No es software médico frío, es tu compañero de recuperación
- **Motivador sin ser condescendiente**: Celebra logros ("¡Felicidades!") pero respeta al usuario
- **Profesional pero accesible**: Lenguaje claro, sin jerga técnica innecesaria
- **Orientado al progreso**: Métricas, porcentajes, rachas → visualizar la mejora
- **Respetuoso con el descanso**: Reconoce los "días de descanso" como parte del proceso

### Mensajes clave (copy inspiracional)

- "¿Qué quieres hacer hoy?" → Empoderamiento
- "Tu actividad de hoy" → Personalización
- "¡Felicidades!" (al completar) → Celebración
- "Día de descanso" → Cuidado integral
- "Siguiente: [ejercicio]" → Guía paso a paso

### Metáforas visuales

- **Bonsái** como elemento decorativo → Crecimiento, cuidado, paciencia, bienestar
- **Tarjetas glassmórficas** → Ligereza, transparencia, modernidad
- **Animaciones suaves** → Fluidez, movimiento (apropiado para una app de ejercicio)

---

## 5. Contenidos Destacados para Landing Page

### Hero Section

**Headline principal:**
> "Tu tratamiento de fisioterapia, siempre contigo"

**Subheadline:**
> "Planes de ejercicios personalizados con vídeos guiados, seguimiento de progreso y conexión directa con tu fisioterapeuta"

**CTA principal:** "Empieza gratis" / "Regístrate como fisioterapeuta"

---

### Sección de Beneficios (3 columnas)

#### Para Pacientes
- Ejercicios con vídeo HD profesional
- Sabe exactamente qué hacer cada día
- Registra cómo te sientes
- Tu fisio siempre informado

#### Para Fisioterapeutas
- Crea planes en minutos, no horas
- +500 ejercicios en el catálogo
- Monitoriza adherencia real
- Plantillas reutilizables

#### Para Clínicas
- Gestión centralizada del equipo
- Códigos de acceso seguros
- Tu marca, tu identidad
- Escala sin complicaciones

---

### Sección "Cómo funciona" (4 pasos)

1. **El fisio crea tu plan** → Selecciona ejercicios personalizados para tu lesión
2. **Recibes tu actividad diaria** → Ve qué ejercicios tocan hoy con vídeo incluido
3. **Realizas la sesión guiada** → Sigue el vídeo, las series y los descansos
4. **Das feedback** → Tu fisio sabe cómo evolucionas entre consultas

---

### Sección de Features (con iconos)

| Feature | Icono sugerido | Descripción corta |
|---------|----------------|-------------------|
| Vídeos profesionales | 🎬 | Más de 500 ejercicios grabados por fisioterapeutas |
| Planes personalizados | 📋 | Ejercicios adaptados a tu lesión y horario |
| Seguimiento de dolor | 📊 | Registra cómo te sientes en cada sesión |
| Recordatorios | 🔔 | Nunca olvides tu rutina de ejercicios |
| Multi-clínica | 🏥 | Un fisio puede gestionar varias clínicas |
| Códigos de acceso | 🔐 | Invita pacientes de forma segura |

---

### Sección de Social Proof (testimonios)

**Tipos de testimonios a buscar:**
- Paciente que mejoró su adherencia
- Fisioterapeuta que ahorró tiempo
- Clínica que escaló su servicio

---

### Sección de Precios (si aplica)

Sugerencia de estructura:
- **Gratis**: 1 fisio, X pacientes, funciones básicas
- **Pro**: Ilimitado, plantillas, estadísticas avanzadas
- **Clínica**: Multi-fisio, branding, soporte prioritario

---

### Footer CTA

**Headline:**
> "Empieza a mejorar la adherencia de tus pacientes hoy"

**CTA:** "Crear cuenta gratuita"

---

## 6. Diferenciadores Clave vs Competencia

1. **Experiencia móvil nativa** → Diseñado mobile-first, no adaptado después
2. **Glassmorfismo y diseño premium** → No parece "software médico aburrido"
3. **Catálogo de ejercicios integrado** → No necesitas subir tus propios vídeos
4. **Feedback bidireccional** → El paciente no solo ejecuta, también comunica
5. **Multi-rol flexible** → Un fisio puede ser también paciente en otra clínica
6. **Sistema de códigos** → Onboarding sin emails, sin fricción

---

## 7. Palabras Clave para SEO

- Fisioterapia online
- Ejercicios de fisioterapia en casa
- App para fisioterapeutas
- Gestión de pacientes fisioterapia
- Planes de ejercicios personalizados
- Seguimiento de tratamiento fisioterapia
- Software para clínicas de fisioterapia
- Rehabilitación guiada
- Adherencia al tratamiento

---

## 8. Elementos Visuales Sugeridos

### Screenshots a destacar

1. **Dashboard del paciente** → Actividad diaria con progreso
2. **Constructor de planes** → Drag & drop de ejercicios
3. **Sesión guiada** → Vídeo + contador de series
4. **Lista de pacientes** → Vista de tarjetas con avatares
5. **Detalle de ejercicio** → Vídeo expandido con descripción

### Ilustraciones/iconos

- Persona haciendo ejercicio con tablet
- Fisioterapeuta revisando métricas
- Conexión fisio-paciente (flechas bidireccionales)
- Calendario con ejercicios marcados

---

## Resumen Ejecutivo

**Kengo** es una plataforma de fisioterapia que:

- **Conecta** fisioterapeutas y pacientes fuera de consulta
- **Guía** la ejecución de ejercicios con vídeos profesionales
- **Monitoriza** la adherencia y el dolor en tiempo real
- **Escala** para clínicas con gestión de equipos y códigos de acceso

**Tono de marca:** Cálido, profesional, motivador, orientado al progreso

**Colores:** Coral (#e75c3e) + Dorado (#efc048) + Gradientes melocotón

**Target primario:** Fisioterapeutas que quieren mejorar la adherencia de sus pacientes

**Target secundario:** Pacientes que quieren hacer bien sus ejercicios en casa
