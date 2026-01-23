# Esquema de Base de Datos - Kengo

Este documento describe la estructura de la base de datos MySQL utilizada por Kengo, incluyendo las tablas de la aplicación y las tablas del sistema Directus CMS.

## Diagrama de Relaciones

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│ directus_users  │────<│  usuarios_clinicas   │>────│   clinicas  │
└────────┬────────┘     └──────────┬───────────┘     └──────┬──────┘
         │                         │                        │
         │              ┌──────────┴───────────┐            │
         │              │usuarios_clinicas_    │            │
         │              │      Puestos         │            │
         │              └──────────┬───────────┘     ┌──────┴──────┐
         │                         │                 │clinicas_files│
         │              ┌──────────┴───────────┐     └─────────────┘
         │              │       Puestos        │
         │              └──────────────────────┘
         │
    ┌────┴────┐
    │         │
┌───┴───┐ ┌───┴───┐
│Planes │ │rutinas│
└───┬───┘ └───┬───┘
    │         │
┌───┴────────┐│    ┌────────────┐     ┌───────────────────┐
│planes_     ││    │ ejercicios │────<│ejercicios_        │
│ejercicios  │├───>│            │     │    categorias     │
└─────┬──────┘│    └────────────┘     └─────────┬─────────┘
      │       │                                 │
      │    ┌──┴─────────────┐          ┌────────┴─────────┐
      │    │rutinas_        │          │    categorias    │
      │    │   ejercicios   │          └──────────────────┘
      │    └────────────────┘
┌─────┴──────────┐
│planes_registros│
└────────────────┘
```

---

## Tablas de la Aplicación

### clinicas

Almacena la información de las clínicas de fisioterapia.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_clinica` | INT UNSIGNED (PK) | Identificador único |
| `user_created` | CHAR(36) | Usuario que creó el registro |
| `date_created` | TIMESTAMP | Fecha de creación |
| `user_updated` | CHAR(36) | Usuario que actualizó el registro |
| `date_updated` | TIMESTAMP | Fecha de actualización |
| `nombre` | VARCHAR(255) | Nombre de la clínica |
| `telefono` | VARCHAR(255) | Teléfono de contacto |
| `email` | VARCHAR(255) | Email de contacto |
| `direccion` | VARCHAR(255) | Dirección física |
| `postal` | VARCHAR(255) | Código postal |
| `nif` | VARCHAR(255) | NIF de la clínica |
| `logo` | CHAR(36) | FK a `directus_files` |
| `color_primario` | VARCHAR(255) | Color primario de branding |
| `color_secundario` | VARCHAR(255) | Color secundario de branding |

---

### usuarios_clinicas

Tabla de relación muchos-a-muchos entre usuarios y clínicas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `id_usuario` | CHAR(36) | FK a `directus_users` |
| `id_clinica` | INT UNSIGNED | FK a `clinicas` |

---

### Puestos

Catálogo de puestos/roles dentro de una clínica.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `puesto` | VARCHAR(255) | Nombre del puesto (ej: Fisioterapeuta, Recepcionista) |

---

### usuarios_clinicas_Puestos

Tabla de relación muchos-a-muchos entre usuarios_clinicas y puestos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `usuarios_clinicas_id` | INT UNSIGNED | FK a `usuarios_clinicas` |
| `Puestos_id` | INT UNSIGNED | FK a `Puestos` |

---

### detalle_usuario

Información adicional del usuario (datos personales).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_detalle_usuario` | INT UNSIGNED (PK) | Identificador único |
| `id_usuario` | CHAR(36) | FK a `directus_users` |
| `dni` | VARCHAR(255) | Documento de identidad |
| `fecha_nacimiento` | DATETIME | Fecha de nacimiento |
| `direccion` | VARCHAR(255) | Dirección del usuario |
| `postal` | VARCHAR(255) | Código postal |
| `telefono` | VARCHAR(255) | Teléfono |
| `sexo` | VARCHAR(255) | Sexo del usuario |

---

### clinicas_files

Tabla de relación para archivos asociados a clínicas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `clinicas_id_clinica` | INT UNSIGNED | FK a `clinicas` |
| `directus_files_id` | CHAR(36) | FK a `directus_files` |

---

### ejercicios

Catálogo de ejercicios disponibles para planes y rutinas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_ejercicio` | INT UNSIGNED (PK) | Identificador único |
| `nombre_ejercicio` | VARCHAR(255) | Nombre del ejercicio |
| `series_defecto` | VARCHAR(255) | Series por defecto (default: "3") |
| `repeticiones_defecto` | VARCHAR(255) | Repeticiones por defecto (default: "15") |
| `video` | CHAR(36) | FK a `directus_files` (video explicativo) |
| `descripcion` | TEXT | Descripción del ejercicio |
| `portada` | CHAR(36) | FK a `directus_files` (imagen de portada) |

---

### categorias

Catálogo de categorías para clasificar ejercicios.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_categoria` | INT UNSIGNED (PK) | Identificador único |
| `nombre_categoria` | VARCHAR(255) | Nombre de la categoría |

---

### ejercicios_categorias

Tabla de relación muchos-a-muchos entre ejercicios y categorías.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `ejercicios_id_ejercicio` | INT UNSIGNED | FK a `ejercicios` |
| `categorias_id_categoria` | INT UNSIGNED | FK a `categorias` |

---

### Planes

Planes de tratamiento asignados a pacientes.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_plan` | INT UNSIGNED (PK) | Identificador único |
| `user_created` | CHAR(36) | Usuario que creó el registro |
| `date_created` | TIMESTAMP | Fecha de creación |
| `user_updated` | CHAR(36) | Usuario que actualizó el registro |
| `date_updated` | TIMESTAMP | Fecha de actualización |
| `titulo` | VARCHAR(255) | Título del plan |
| `descripcion` | VARCHAR(255) | Descripción del plan |
| `estado` | VARCHAR(255) | Estado del plan (default: "borrador") |
| `fecha_inicio` | DATETIME | Fecha de inicio del plan |
| `fecha_fin` | DATETIME | Fecha de finalización del plan |
| `paciente` | CHAR(36) | FK a `directus_users` (paciente asignado) |
| `fisio` | CHAR(36) | FK a `directus_users` (fisioterapeuta responsable) |

---

### planes_ejercicios

Ejercicios incluidos en un plan de tratamiento.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `sort` | INT | Orden del ejercicio en el plan |
| `date_created` | TIMESTAMP | Fecha de creación |
| `date_updated` | TIMESTAMP | Fecha de actualización |
| `plan` | INT UNSIGNED | FK a `Planes` |
| `ejercicio` | INT UNSIGNED | FK a `ejercicios` |
| `instrucciones_paciente` | VARCHAR(255) | Instrucciones para el paciente |
| `notas_fisio` | VARCHAR(255) | Notas del fisioterapeuta |
| `series` | INT | Número de series (default: 1) |
| `repeticiones` | INT | Número de repeticiones (default: 1) |
| `duracion_seg` | INT | Duración en segundos |
| `descanso_seg` | INT | Descanso entre series en segundos |
| `veces_dia` | INT | Veces por día (default: 1) |
| `dias_semana` | JSON | Días de la semana programados |

---

### planes_registros

Registro de ejercicios completados por pacientes.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_registro` | INT UNSIGNED (PK) | Identificador único |
| `date_created` | TIMESTAMP | Fecha de creación |
| `plan_item` | INT UNSIGNED | FK a `planes_ejercicios` |
| `paciente` | CHAR(36) | FK a `directus_users` |
| `fecha_hora` | DATETIME | Fecha y hora de realización |
| `completado` | TINYINT(1) | Si se completó (default: 1) |
| `repeticiones_realizadas` | INT | Repeticiones realizadas |
| `duracion_real_seg` | INT | Duración real en segundos |
| `dolor_escala` | INT | Escala de dolor (0-10, default: 0) |
| `esfuerzo_escala` | INT | Escala de esfuerzo (0-10, default: 0) |
| `nota_paciente` | TEXT | Notas del paciente |

---

### rutinas

Plantillas de rutinas reutilizables.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_rutina` | INT UNSIGNED (PK) | Identificador único |
| `user_created` | CHAR(36) | Usuario que creó el registro |
| `date_created` | TIMESTAMP | Fecha de creación |
| `user_updated` | CHAR(36) | Usuario que actualizó el registro |
| `date_updated` | TIMESTAMP | Fecha de actualización |
| `nombre` | VARCHAR(255) | Nombre de la rutina |
| `descripcion` | VARCHAR(255) | Descripción de la rutina |
| `autor` | CHAR(36) | FK a `directus_users` |
| `visibilidad` | VARCHAR(255) | Visibilidad (default: "privado") |

---

### rutinas_ejercicios

Ejercicios incluidos en una rutina.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT UNSIGNED (PK) | Identificador único |
| `sort` | INT | Orden del ejercicio |
| `date_created` | TIMESTAMP | Fecha de creación |
| `date_updated` | TIMESTAMP | Fecha de actualización |
| `rutina` | INT UNSIGNED | FK a `rutinas` |
| `ejercicio` | INT UNSIGNED | FK a `ejercicios` |
| `series` | INT | Número de series (default: 1) |
| `repeticiones` | INT | Número de repeticiones (default: 1) |
| `duracion_seg` | INT | Duración en segundos |
| `descanso_seg` | INT | Descanso en segundos |
| `veces_dia` | INT | Veces por día (default: 1) |
| `dias_semana` | JSON | Días de la semana |
| `instrucciones_paciente` | TEXT | Instrucciones para el paciente |
| `notas_fisio` | TEXT | Notas del fisioterapeuta |

---

## Tablas del Sistema Directus

Las siguientes tablas son gestionadas automáticamente por Directus CMS.

### directus_users

Tabla principal de usuarios del sistema (extendida con campos personalizados).

| Campo Personalizado | Tipo | Descripción |
|---------------------|------|-------------|
| `is_fisio` | TINYINT(1) | Es fisioterapeuta (default: 0) |
| `is_cliente` | TINYINT(1) | Es cliente/paciente (default: 0) |
| `telefono` | VARCHAR(255) | Teléfono del usuario |
| `direccion` | VARCHAR(255) | Dirección del usuario |
| `postal` | VARCHAR(255) | Código postal |
| `magic_link_url` | TEXT | URL del magic link para autenticación |

Los campos estándar de Directus incluyen: `id`, `first_name`, `last_name`, `email`, `password`, `status`, `role`, `token`, `avatar`, etc.

---

### directus_files

Almacena metadatos de archivos subidos (videos de ejercicios, logos, etc.).

Campos principales: `id`, `storage`, `filename_disk`, `filename_download`, `title`, `type`, `filesize`, `width`, `height`, `duration`.

---

### directus_roles

Roles de usuario del sistema.

Campos: `id`, `name`, `icon`, `description`, `parent`.

---

### Otras tablas de sistema Directus

- `directus_sessions` - Sesiones de usuario
- `directus_activity` - Log de actividad
- `directus_permissions` - Permisos por rol
- `directus_policies` - Políticas de acceso
- `directus_relations` - Definición de relaciones
- `directus_collections` - Metadatos de colecciones
- `directus_fields` - Metadatos de campos
- `directus_folders` - Carpetas de archivos
- `directus_settings` - Configuración del sistema

---

## Notas de Implementación

1. **UUIDs**: Las referencias a usuarios (`directus_users`) utilizan CHAR(36) para almacenar UUIDs.

2. **Auditoría**: Las tablas principales incluyen campos `user_created`, `date_created`, `user_updated`, `date_updated` para seguimiento de cambios.

3. **Soft Deletes**: Las claves foráneas usan `ON DELETE SET NULL` para mantener integridad referencial sin eliminar registros dependientes.

4. **JSON**: Los campos `dias_semana` almacenan arrays JSON para configurar días de la semana.

5. **Relaciones M2M**: Las tablas intermedias siguen el patrón `tabla1_tabla2` para relaciones muchos-a-muchos.
