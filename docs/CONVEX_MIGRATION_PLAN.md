# Plan Maestro: Migración de Directus a Convex — Kengo Healthcare Platform

## Contexto

Kengo es una plataforma de gestión de fisioterapia construida con Angular 20 que actualmente depende de **Directus CMS** como backend principal (autenticación, CRUD, almacenamiento de archivos) y un **backend Node.js/Express custom** con 37+ endpoints para lógica de negocio. El frontend consume ambos backends via REST.

**Objetivo**: Migrar gradualmente todo el backend a **Convex** (self-hosted en Railway), eliminando la dependencia de Directus y del backend Node.js. Al final de la migración, Convex será la única fuente de datos y lógica de negocio.

**Estado actual**: Fase 0 completada. Convex instalado, schema definido, `ConvexService` Angular creado, instancia desplegada en Railway en `https://convex-backend-production-5324.up.railway.app`.

---

## Inventario completo del sistema actual

### Endpoints por origen (63 totales)

| Origen | Endpoints | Método |
|--------|-----------|--------|
| Directus REST (`/directus/`) | 46 | GET/POST/PATCH/DELETE sobre `/items/*`, `/auth/*`, `/users/*`, `/files`, `/assets/*` |
| Backend custom (`/api/`) | 17 | Registro, auth custom, clínicas, cumplimiento, notificaciones, PDF, email, dashboard, métricas |

### Servicios Angular que consumen datos (17 servicios)

| Servicio | Archivo | Endpoints | Usa httpResource |
|----------|---------|-----------|-----------------|
| AuthService | `core/auth/services/auth.service.ts` | 12 | No |
| SessionService | `core/auth/services/session.service.ts` | 2 | No |
| EmailVerificationService | `core/auth/services/email-verification.service.ts` | 2 | No |
| PlanesService | `features/planes/data-access/planes.service.ts` | 8 | Sí |
| PlanBuilderService | `features/planes/data-access/plan-builder.service.ts` | 5+ | No |
| EjerciciosService | `features/ejercicios/data-access/ejercicios.service.ts` | 6 | Sí (2) |
| RutinasService | `features/rutinas/data-access/rutinas.service.ts` | 7 | Sí |
| ClinicasService | `features/clinica/data-access/clinicas.service.ts` | 2 | Sí (2) |
| ClinicaGestionService | `features/clinica/data-access/clinica-gestion.service.ts` | 8 | No |
| RegistroSesionService | `features/sesion/data-access/registro-sesion.service.ts` | 6 | No |
| CumplimientoService | `features/pacientes/data-access/cumplimiento.service.ts` | 1 | No |
| ComentariosPacienteService | `features/pacientes/data-access/comentarios-paciente.service.ts` | 3 | No |
| AsignacionesService | `features/pacientes/data-access/asignaciones.service.ts` | 3 | No |
| MetricasPacientesService | `features/pacientes/data-access/metricas-pacientes.service.ts` | 1 | No |
| DashboardFisioService | `features/dashboard/data-access/dashboard-fisio.service.ts` | 1 | No |
| RachaPacienteService | `features/dashboard/data-access/racha-paciente.service.ts` | 1 | No |
| ActividadHoyService | `features/actividad/data-access/actividad-hoy.service.ts` | 2 | No |
| NotificacionesService | `core/services/notificaciones.service.ts` | 3 | No |

### Tablas MySQL (datos actuales)

| Tabla | Filas | Descripción |
|-------|-------|-------------|
| directus_users | 256 | Usuarios del sistema |
| clinicas | 4 | Clínicas registradas |
| usuarios_clinicas | 43 | Relación usuario-clínica con puesto |
| Puestos | 4 | Tipos de puesto (fisio=1, paciente=2, admin=4) |
| ejercicios | 322 | Catálogo de ejercicios |
| categorias | 24 | Categorías de ejercicios |
| ejercicios_categorias | 651 | M2M ejercicio-categoría |
| ejercicios_favoritos | 23 | Favoritos por usuario |
| Planes | 59 | Planes de tratamiento |
| planes_ejercicios | 137 | Ejercicios dentro de planes |
| planes_registros | 232 | Registros de ejecución |
| sesiones | 68 | Sesiones de ejercicio |
| rutinas | 15 | Plantillas de rutinas |
| rutinas_ejercicios | 55 | Ejercicios dentro de rutinas |
| cumplimiento_diario | 2446 | Cumplimiento calculado diariamente |
| notificaciones_fisio | ~100+ | Notificaciones para fisios |
| codigos_acceso | 11 | Códigos de acceso a clínicas |
| tokens_acceso_usuario | ~20+ | Tokens de acceso (QR/magic link) |
| asignaciones_responsable | 8 | Asignación fisio-paciente |
| codigos_recuperacion | ~50+ | Códigos de recuperación de contraseña |
| codigos_verificacion_email | ~30+ | Códigos de verificación de email |

### Cron jobs actuales (3 jobs diarios)

| Job | Hora (UTC) | Archivo | Descripción |
|-----|-----------|---------|-------------|
| Planes expirados | 00:05 | `jobs/planes-expirados.ts` | Marca planes activos con fecha_fin < hoy como "completado" |
| Cumplimiento diario | 00:10 | `jobs/cumplimiento-diario.ts` | Calcula ejercicios esperados vs completados por paciente/plan/día |
| Notificaciones fisio | 00:15 | `jobs/notificaciones-fisio.ts` | Genera notificaciones de comentarios/dolor para fisios |

### Emails enviados (via Resend)

| Tipo | Cuándo | Contenido |
|------|--------|-----------|
| Welcome | Registro de usuario | Bienvenida con CTA de login |
| Código de acceso | Generación de código | Código grande + instrucciones |
| Magic link | Envío de enlace de acceso | Botón + URL |
| Password reset | Solicitud de recuperación | Código 6 dígitos, expira 15 min |
| Verificación email | Solicitud de verificación | Código 6 dígitos, expira 15 min |
| Plan PDF | Envío de plan por email | HTML + PDF adjunto |

---

## Fases de migración

---

## FASE 1: Ejercicios + Categorías + Favoritos

**Prioridad**: Primera porque es read-heavy, aislada, y valida todo el pipeline.

### 1.1 Seed de datos

**Crear script de migración** (`convex/migrations/seedExercises.ts`):

1. Exportar de MySQL los 322 ejercicios, 24 categorías y 651 relaciones M2M
2. Para cada ejercicio:
   - Insertar en tabla `exercises` de Convex con campo `legacyId` = `id_ejercicio` original
   - Si tiene `portada` o `video` (UUID de Directus), **NO migrar archivos aún** — guardar el UUID de Directus como string temporal y resolver URLs via Directus durante la transición
3. Insertar las 24 categorías con `legacyId`
4. Insertar las 651 relaciones `exerciseCategories` mapeando IDs legacy a IDs Convex

**Decisión sobre archivos**: Los archivos de ejercicios (portadas y videos) están almacenados en un **bucket S3** gestionado por Directus. Durante la Fase 1, mantener Directus como proxy de archivos. Los componentes Angular seguirán construyendo URLs de asset como `${DIRECTUS_URL}/assets/${uuid}`. En la Fase 8 se migrarán todos los archivos de S3 a **Cloudflare R2** con dominio custom `assets.kengoapp.com`, lo que permitirá URLs estables, transformaciones de imagen via Cloudflare Image Resizing, y cero costes de egress.

**Formato del script**: Convex action con `"use node"` que lee un JSON exportado y hace inserts batch.

### 1.2 Migrar EjerciciosService

**Archivo**: `apps/app/src/app/features/ejercicios/data-access/ejercicios.service.ts`

**Endpoints actuales a reemplazar**:
| Actual | Convex replacement |
|--------|-------------------|
| `GET /directus/items/categorias` | `api.exercises.queries.listCategories` |
| `GET /directus/items/ejercicios` (paginado, filtros) | `api.exercises.queries.listExercises` |
| `GET /directus/items/ejercicios/{id}` | `api.exercises.queries.getExerciseById` |
| `GET /directus/items/ejercicios_favoritos` | `api.exercises.queries.listFavorites` |
| `POST /directus/items/ejercicios_favoritos` | `api.exercises.mutations.toggleFavorite` |
| `DELETE /directus/items/ejercicios_favoritos/{id}` | `api.exercises.mutations.toggleFavorite` |

**Cambios clave en el servicio**:
- Reemplazar `httpResource()` por `ConvexService.watchQuery()` para listas
- Reemplazar `HttpClient.get()` por `ConvexService.query()` para detalle
- Eliminar la lógica de construir filtros Directus (`_and`, `_icontains`, `_in`)
- Los favoritos se gestionan con un solo `toggleFavorite` en vez de POST+GET+DELETE separados
- **Beneficio tiempo real**: los favoritos se sincronizan automáticamente entre tabs sin `reload()`

**Funciones Convex a completar**:
- `convex/exercises/queries.ts` — Añadir `listFavorites(userId)` y paginación real con `ctx.db.query().paginate()`
- `convex/exercises/mutations.ts` — Ya existe `toggleFavorite`

**Punto crítico — URLs de assets**: Mientras los archivos permanezcan en Directus, el servicio necesita una función helper que construya la URL de asset:
```typescript
// En el servicio migrado, para portada/video:
getAssetUrl(ejercicio: Exercise): string {
  // Si tiene portada como storageId de Convex → usar Convex storage URL
  // Si tiene legacyPortadaId (UUID Directus) → usar DIRECTUS_URL/assets/{uuid}
}
```

### 1.3 Componentes afectados

- `EjerciciosComponent` (lista/galería) — consume `EjerciciosService`
- `EjercicioDetailComponent` — consume `EjerciciosService.getEjercicioById()`
- `PlanBuilderComponent` — usa `EjerciciosService` para seleccionar ejercicios
- `RutinaBuilderComponent` — usa `EjerciciosService` para seleccionar ejercicios

Los componentes NO necesitan cambios si el servicio mantiene la misma interfaz de signals.

### 1.4 Verificación Fase 1

- [ ] Las 24 categorías aparecen en el selector de filtro
- [ ] Los 322 ejercicios se listan con portadas (via Directus CDN)
- [ ] La búsqueda por nombre funciona (search index)
- [ ] El filtro por categoría funciona
- [ ] Toggle de favoritos funciona y se refleja inmediatamente
- [ ] El detalle de ejercicio muestra descripción, video y portada
- [ ] El plan builder puede seleccionar ejercicios del catálogo
- [ ] El rutina builder puede seleccionar ejercicios del catálogo

---

## FASE 2: Rutinas

**Prioridad**: Self-contained, solo depende de ejercicios (Fase 1).

### 2.1 Seed de datos

- Migrar 15 rutinas y 55 rutinas_ejercicios
- Mapear `autor` (UUID Directus) a ID de usuario Convex via `legacyDirectusId`
- **Problema**: Los usuarios aún no están en Convex. **Solución**: Crear entries mínimos en tabla `users` de Convex para los autores de rutinas (solo los campos necesarios: externalId, email, firstName, lastName). Estos se enriquecerán en la Fase 3 (auth).

### 2.2 Migrar RutinasService

**Archivo**: `apps/app/src/app/features/rutinas/data-access/rutinas.service.ts`

**Endpoints actuales a reemplazar**:
| Actual | Convex replacement |
|--------|-------------------|
| `GET /directus/items/rutinas` (filtrado complejo) | `api.routines.queries.list` |
| `GET /directus/items/rutinas/{id}` | `api.routines.queries.getById` |
| `POST /directus/items/rutinas` + `POST /items/rutinas_ejercicios` | `api.routines.mutations.create` (atómico) |
| `PATCH /directus/items/rutinas/{id}` + DELETE + POST ejercicios | `api.routines.mutations.update` (atómico) |
| `DELETE /directus/items/rutinas/{id}` | `api.routines.mutations.remove` |

**Mejora**: Las operaciones multi-step actuales (crear rutina → crear ejercicios, o actualizar → borrar ejercicios → crear nuevos) se convierten en **una sola mutation atómica** en Convex. Esto elimina estados inconsistentes.

**Lógica de visibilidad a replicar**:
- `privado`: Solo rutinas del usuario actual
- `clinica`: Rutinas de autores que comparten clínica con el usuario
- `todas`: Propias + clínica

Esta lógica requiere que la query de Convex tenga acceso a `clinicMemberships` para determinar qué clínicas comparte el usuario. Implementar en `convex/routines/queries.ts`.

### 2.3 Verificación Fase 2

- [ ] Listar rutinas propias (filtro "privado")
- [ ] Listar rutinas de clínica (filtro "clinica")
- [ ] Crear rutina nueva con ejercicios
- [ ] Editar rutina existente (cambiar ejercicios)
- [ ] Eliminar rutina propia
- [ ] Duplicar rutina (crear copia como "privado")
- [ ] Usar rutina como plantilla al crear un plan

---

## FASE 3: Autenticación

**Prioridad**: Punto de inflexión crítico. Esta es la fase más compleja y delicada.

### 3.1 Estrategia de autenticación

**Opción recomendada: Convex Auth** (built-in) con email/password provider.

Convex Auth soporta:
- Email/password (replica el UX actual)
- Gestión de sesiones automática
- Token refresh automático (elimina el timer de 13 minutos)
- Integración directa con `ctx.auth` en funciones Convex

**Alternativa: Clerk** — Más features (MFA, social login) pero añade otra dependencia externa y coste.

### 3.2 Migración de usuarios

**Paso 1 — Exportar usuarios de Directus**:
```
SELECT id, first_name, last_name, email, password, email_verified,
       telefono, direccion, postal, numero_colegiado, avatar
FROM directus_users
WHERE status = 'active'
```

**Paso 2 — Importar a Convex**:
- Crear usuario en Convex Auth con email/password
- **Problema con passwords**: Directus usa argon2 para hashear passwords. Convex Auth usa bcrypt. **No se pueden migrar hashes directamente**.
- **Solución**: 
  1. Crear usuarios en Convex con un password temporal aleatorio
  2. Marcar `passwordMigrated: false` en la tabla users
  3. En el primer login, si el login de Convex falla y `passwordMigrated === false`:
     - Intentar validar contra Directus (`POST /directus/auth/login`)
     - Si Directus valida OK → actualizar password en Convex con el password proporcionado
     - Marcar `passwordMigrated: true`
  4. Este flujo es transparente para el usuario — no necesita "resetear" su contraseña

**Paso 3 — Migrar relaciones**:
- `usuarios_clinicas` → `clinicMemberships` (mapear IDs)
- `detalle_usuario` → `userDetails`
- `ejercicios_favoritos` → ya migrados en Fase 1

### 3.3 Migrar AuthService

**Archivo**: `apps/app/src/app/core/auth/services/auth.service.ts`

**Endpoints actuales a reemplazar**:
| Actual | Convex replacement |
|--------|-------------------|
| `POST /directus/auth/login` | Convex Auth `signIn()` |
| `POST /directus/auth/logout` | Convex Auth `signOut()` |
| `POST /directus/auth/refresh` | **Automático** — Convex client gestiona tokens |
| `POST /api/auth/refrescar-sesion` | **Eliminado** — no necesario |
| `GET /directus/users/me` (checkSession) | `api.users.queries.me` |
| `POST /api/registro` | `api.auth.mutations.register` (Convex action) |
| `POST /api/auth/recuperar-password` | `api.auth.actions.requestPasswordReset` |
| `POST /api/auth/reset-password` | `api.auth.actions.resetPassword` |
| `POST /api/auth/establecer-password` | `api.auth.mutations.setPassword` |
| `POST /api/auth/enviar-verificacion` | `api.auth.actions.sendVerificationCode` |
| `POST /api/auth/verificar-email` | `api.auth.mutations.verifyEmail` |
| `POST /directus/users/invite/accept` | **Eliminar** — flujo cambia con Convex Auth |

**Cambios fundamentales**:
1. **Eliminar el timer de refresh proactivo** (cada 13 min) — Convex client gestiona tokens automáticamente
2. **Eliminar el `authInterceptor`** — ya no hay cookies httpOnly; Convex client añade auth via WebSocket
3. **Eliminar la lógica de `limpiarSesionExpirada()`** — no hay cookies que limpiar
4. **Simplificar `checkSession()`** — se convierte en `convex.query(api.users.queries.me)`

### 3.4 Migrar SessionService

**Archivo**: `apps/app/src/app/core/auth/services/session.service.ts`

- `cargarMiUsuario()` → `convex.watchQuery(api.users.queries.me)` — **tiempo real**, se actualiza automáticamente
- `transformarUsuarioDirectus()` → **Eliminar** — los datos ya vienen en formato dominio desde Convex
- `uploadFile()` → usar Convex storage API directamente
- Signals y computed values se mantienen, pero alimentados por la suscripción Convex

### 3.5 Migrar AuthGuard y FisioGuard

**Archivos**: `core/guards/auth.guard.ts`, `core/guards/fisio.guard.ts`, `core/guards/admin.guard.ts`

- AuthGuard: Verificar `ConvexService.isAuthenticated()` (señal del estado de auth de Convex)
- FisioGuard y AdminGuard: Sin cambios funcionales, solo actualizan la fuente de datos del usuario

### 3.6 Flujo de registro con código de clínica

El registro actual tiene esta lógica compleja en el backend:
1. Validar email único
2. Validar código de clínica (si se proporciona)
3. Crear usuario en Directus con rol
4. Crear relación usuarios_clinicas
5. Incrementar uso del código
6. Enviar email de bienvenida

**En Convex**: Esto se convierte en una **action** (no mutation, porque necesita enviar email):
```
convex/auth/actions.ts → register()
1. Crear usuario via Convex Auth
2. Insertar en tabla users
3. Si código: validar + crear clinicMembership + incrementar uso
4. Enviar email via Resend (action con "use node")
```

### 3.7 Flujo de access tokens (QR / magic link)

**Endpoints actuales**:
| Actual | Convex replacement |
|--------|-------------------|
| `POST /api/usuario/token-acceso` (crear) | `api.accessTokens.mutations.create` |
| `POST /api/auth/token-acceso` (consumir) | `api.accessTokens.actions.consume` |
| `GET /api/usuario/:id/tokens-acceso` (listar) | `api.accessTokens.queries.listByUser` |
| `DELETE /api/usuario/token-acceso/:id` (revocar) | `api.accessTokens.mutations.revoke` |
| `POST /api/usuario/:id/token-acceso/enviar-email` | `api.accessTokens.actions.sendByEmail` |

**Flujo de consumo**: El token de acceso actualmente crea una sesión Directus directamente en MySQL (`directus_sessions`). En Convex:
1. Validar token (activo, no expirado, no agotado)
2. Incrementar uso
3. Crear sesión de Convex Auth programáticamente para el usuario asociado
4. Devolver token de sesión al cliente

**Punto crítico**: Convex Auth debe soportar la creación programática de sesiones (sin email/password). Verificar que el provider permite `signIn` sin credenciales cuando se valida un access token.

### 3.8 Sincronización temporal con Directus

**Durante la transición de la Fase 3**, habrá un periodo donde:
- Algunos usuarios ya usan Convex Auth
- El backend Node.js aún necesita validar sesiones para endpoints no migrados

**Solución de transición**: Mantener el backend Node.js con un middleware dual:
1. Intentar validar via Directus (método actual)
2. Si falla, intentar validar via Convex (nuevo)

**Duración**: Esta sincronización se elimina cuando todas las fases posteriores (4-7) estén completadas.

### 3.9 Verificación Fase 3

- [ ] Login con email/password funciona
- [ ] Logout limpia el estado correctamente
- [ ] Registro de nuevo usuario (fisio y paciente) funciona
- [ ] Registro con código de clínica vincula al usuario correctamente
- [ ] Password recovery (solicitar código → verificar → resetear) funciona
- [ ] Email verification funciona
- [ ] Refresh de sesión es automático (sin timer visible)
- [ ] AuthGuard protege rutas correctamente
- [ ] FisioGuard restringe acceso a fisios
- [ ] AdminGuard restringe acceso a admins
- [ ] Magic link / QR token: crear → consumir → sesión activa
- [ ] Usuario existente con password Directus puede hacer login (migración transparente)
- [ ] SessionService.usuario() se actualiza en tiempo real

---

## FASE 4: Planes + Registros + Sesiones

**Prioridad**: Core del negocio. Mayor volumen de lógica y datos.

### 4.1 Seed de datos

- Migrar 59 planes con relaciones a paciente/fisio (mapear UUIDs via `legacyDirectusId`)
- Migrar 137 planes_ejercicios con relaciones a ejercicios (mapear via `legacyId`)
- Migrar 232 planes_registros
- Migrar 68 sesiones

**Importante**: Los campos `paciente` y `fisio` en Planes son UUIDs de Directus. Deben mapearse a `Id<"users">` de Convex. Usar el índice `by_legacyDirectusId` para la resolución.

### 4.2 Migrar PlanesService

**Archivo**: `apps/app/src/app/features/planes/data-access/planes.service.ts`

**Endpoints a reemplazar (8)**:
| Actual | Convex replacement |
|--------|-------------------|
| `GET /directus/items/Planes` (lista filtrada) | `api.plans.queries.listByFisio` / `listByPaciente` |
| `GET /directus/items/Planes/{id}` (detalle) | `api.plans.queries.getById` |
| `GET /directus/items/Planes` (activos hoy) | `api.plans.queries.getActiveForPatientToday` |
| `GET /directus/items/Planes` (activos/futuros) | `api.plans.queries.getActiveAndFuture` |
| `GET /directus/items/Planes` (por paciente) | `api.plans.queries.listByPaciente` |
| `PATCH /directus/items/Planes/{id}` (estado) | `api.plans.mutations.updateEstado` |
| `PATCH /directus/items/Planes/{id}` (metadata) | `api.plans.mutations.update` |
| `DELETE /directus/items/Planes/{id}` | `api.plans.mutations.remove` |

**Transformaciones a eliminar**:
- `transformPlan()`, `transformPlanCompleto()`, `transformEjercicioPlan()` — Los datos ya vendrán en formato dominio desde las queries Convex
- `transformUsuario()` — Ya no necesario, los usuarios están desnormalizados (`pacienteNombre`, `fisioNombre`)
- `getAssetUrl()` — Se simplifica porque los ejercicios ya tienen URLs resueltas

**Lógica compleja de filtros actuales**:
```
Directus: filter={ _and: [{fisio: {_eq}}, {estado?}, {paciente?}, {titulo: {_icontains}}] }
```
En Convex: usar índices compuestos (`by_fisioId_estado`) + filtrado en memoria para búsqueda por título.

### 4.3 Migrar PlanBuilderService

**Archivo**: `apps/app/src/app/features/planes/data-access/plan-builder.service.ts`

Este servicio maneja la creación/edición de planes con su lista de ejercicios. Actualmente hace:
1. `POST /directus/items/Planes` (crear plan)
2. Para cada ejercicio: `POST /directus/items/planes_ejercicios`
3. Para edición: `PATCH` plan + `DELETE` ejercicios viejos + `POST` nuevos

**En Convex**: Una sola mutation `api.plans.mutations.create` o `api.plans.mutations.update` que maneja todo atómicamente.

### 4.4 Migrar RegistroSesionService

**Archivo**: `apps/app/src/app/features/sesion/data-access/registro-sesion.service.ts`

Este es el servicio más complejo del sistema. Gestiona:
- Estado de sesión activa (plan, ejercicio actual, serie actual, pantalla)
- Persistencia local en localStorage (TTL 24h)
- Registros pendientes de subir
- Creación de sesiones y registros batch
- Recálculo de cumplimiento (fire-and-forget)
- Generación de notificaciones (fire-and-forget)

**Endpoints a reemplazar**:
| Actual | Convex replacement |
|--------|-------------------|
| `GET /directus/items/planes_registros` (hoy) | `api.records.queries.listByPacienteAndDate` |
| `POST /directus/items/sesiones` (crear sesión) | `api.sessions.mutations.create` |
| `PATCH /directus/items/sesiones/{id}` (finalizar) | `api.sessions.mutations.complete` |
| `POST /directus/items/planes_registros` (batch) | `api.records.mutations.createBatch` |
| `POST /api/cumplimiento/recalcular-hoy` | `api.compliance.mutations.recalculateToday` (internal) |
| `POST /api/notificaciones/generar-comentarios` | `api.notifications.mutations.generateForPatient` (internal) |

**Punto importante**: Las llamadas fire-and-forget actuales (`recalcular-hoy`, `generar-comentarios`) se ejecutan como **scheduled functions** o **mutations internas** que se disparan después de crear registros. Convex no tiene "fire-and-forget" directamente, pero una mutation puede encolar trabajo via `ctx.scheduler.runAfter()`.

### 4.5 Migrar ActividadHoyService

**Archivo**: `features/actividad/data-access/actividad-hoy.service.ts`

Depende de PlanesService y RegistroSesionService. Con Convex, la actividad del día se puede calcular como una **query reactiva** que combina planes activos + registros de hoy. Se actualiza automáticamente cuando el paciente completa ejercicios.

### 4.6 Migrar RachaPacienteService

**Archivo**: `features/dashboard/data-access/racha-paciente.service.ts`

Usa datos de cumplimiento (últimos 14 días). Se migra a query Convex que lee `dailyCompliance`.

### 4.7 Verificación Fase 4

- [ ] Lista de planes del fisio con filtros (estado, paciente, búsqueda)
- [ ] Detalle de plan con lista de ejercicios
- [ ] Crear plan nuevo con ejercicios
- [ ] Editar plan existente (cambiar ejercicios, metadatos)
- [ ] Cambiar estado del plan (borrador → activo → completado)
- [ ] Eliminar plan
- [ ] Sesión de ejercicios: iniciar → completar ejercicios → feedback → finalizar
- [ ] Registros batch se crean correctamente
- [ ] Persistencia local de sesión activa (refresh de página mantiene progreso)
- [ ] Multi-plan session funciona
- [ ] Actividad del día se muestra correctamente para el paciente
- [ ] Racha y cumplimiento semanal se calculan correctamente
- [ ] Recálculo de cumplimiento se dispara después de completar sesión

---

## FASE 5: Clínicas + Membresías + Códigos de acceso + Asignaciones

### 5.1 Seed de datos

- Migrar 4 clínicas con logos y archivos
- Migrar 43 usuarios_clinicas → clinicMemberships
- Migrar 11 codigos_acceso → accessCodes
- Migrar 8 asignaciones_responsable → assignments

### 5.2 Migrar ClinicasService

**Archivo**: `features/clinica/data-access/clinicas.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /directus/items/clinicas` (mis clínicas) | `api.clinics.queries.myClinicsList` |
| `GET /directus/users` (fisios en mis clínicas) | `api.clinics.queries.getMembers` filtrado por puesto |

### 5.3 Migrar ClinicaGestionService

**Archivo**: `features/clinica/data-access/clinica-gestion.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `POST /api/clinica/vincular` | `api.accessCodes.mutations.consume` |
| `POST /api/clinica/crear` | `api.clinics.mutations.create` |
| `PATCH /directus/items/clinicas/{id}` | `api.clinics.mutations.update` |
| `POST /api/clinica/codigo/generar` | `api.accessCodes.mutations.create` + action email |
| `GET /api/clinica/{id}/codigos` | `api.accessCodes.queries.listByClinic` |
| `PATCH /api/clinica/codigo/{id}/desactivar` | `api.accessCodes.mutations.deactivate` |
| `PATCH /api/clinica/codigo/{id}/reactivar` | `api.accessCodes.mutations.reactivate` |
| `POST /directus/files` (upload logo) | Convex storage upload |

**Permisos a replicar** en las mutations de Convex:
- Admin (puesto=4): Puede generar códigos fisio y paciente, gestionar clínica
- Fisio (puesto=1): Solo puede generar códigos de paciente
- Paciente (puesto=2): Sin permisos de gestión

### 5.4 Migrar AsignacionesService

**Archivo**: `features/pacientes/data-access/asignaciones.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/clinica/{id}/asignaciones` | `api.assignments.queries.listByClinic` |
| `PUT /api/clinica/{id}/asignaciones/bulk` | `api.assignments.mutations.bulkAssign` |
| `GET /api/paciente/{id}/fisio-responsable` | `api.assignments.queries.getFisioResponsable` |

### 5.5 Migrar ThemeService

**Archivo**: `core/services/theme.service.ts`

Este servicio lee la clínica seleccionada para aplicar colores y logo. Con Convex:
- `ClinicasService.selectedClinica()` ahora viene de suscripción Convex
- Las URLs de logo se construyen desde Convex storage (o Directus CDN durante transición)
- La lógica de cache en localStorage se mantiene sin cambios

### 5.6 Verificación Fase 5

- [ ] Lista de mis clínicas aparece correctamente
- [ ] Crear nueva clínica (creator se asigna como admin)
- [ ] Editar datos de clínica (nombre, contacto, logo)
- [ ] Generar código de acceso (fisio y paciente)
- [ ] Listar códigos de la clínica
- [ ] Activar/desactivar códigos
- [ ] Vincular usuario a clínica via código
- [ ] Código con email específico solo funciona para ese email
- [ ] Código con límite de usos se agota correctamente
- [ ] Lista de fisios de la clínica
- [ ] Asignación de fisio responsable
- [ ] Bulk assign funciona
- [ ] Auto-assign cuando paciente no tiene fisio asignado
- [ ] Theme de clínica (colores, logo) se aplica correctamente

---

## FASE 6: Cumplimiento + Notificaciones + Dashboard + Métricas

### 6.1 Seed de datos

- Migrar 2446 registros de cumplimiento_diario
- Migrar notificaciones_fisio existentes

### 6.2 Migrar Cron Jobs a Convex

**Archivo**: `convex/crons.ts`

Los 3 cron jobs actuales deben replicarse fielmente:

#### Job 1: Planes expirados
**Lógica actual**: `UPDATE Planes SET estado='completado' WHERE estado='activo' AND fecha_fin < NOW()`

**En Convex** (`convex/plans/internal.ts`):
```
1. Query plans con index by_estado = 'activo'
2. Filtrar por fechaFin < hoy
3. Patch cada plan a estado 'completado'
```
Ya implementado en el archivo actual. Verificar que la lógica es correcta.

#### Job 2: Cumplimiento diario
**Lógica actual** (COMPLEJA — 200+ líneas):
```
1. Obtener fecha de ayer (timezone Madrid)
2. Obtener día de la semana (L,M,X,J,V,S,D)
3. Para cada plan activo/completado que incluya esa fecha:
   a. Filtrar ejercicios cuyo dias_semana incluya el día
   b. Contar ejercicios_esperados (1 por planExercise programado ese día)
   c. Para cada ejercicio:
      - Contar registros completados ese día
      - Si completados >= 1 → ejercicio cumplido
   d. Calcular dolor_promedio de todos los registros
   e. Determinar es_dia_descanso (0 ejercicios esperados)
4. INSERT INTO cumplimiento_diario ON DUPLICATE KEY UPDATE
```

**En Convex** (`convex/compliance/internal.ts`):
- Misma lógica pero usando queries Convex en vez de SQL
- **Punto crítico**: Convex no tiene `ON DUPLICATE KEY UPDATE`. Usar `ctx.db.query().withIndex().unique()` para verificar existencia y hacer `patch` o `insert` según corresponda.
- **Timezone**: Usar `Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid' })` para calcular el día correctamente.

#### Job 3: Notificaciones fisio
**Lógica actual**:
```
1. Buscar registros de últimos 7 días con nota_paciente != NULL
2. Excluir los que ya tienen notificación (LEFT JOIN)
3. Para cada registro:
   - Determinar clínica del paciente
   - Crear notificación con tipo 'comentario'
4. También buscar sesiones con observaciones
```

**En Convex** (`convex/notifications/internal.ts`):
- Query planRecords con `notaPaciente !== undefined` de últimos 7 días
- Para cada uno, verificar si existe notificación con `by_recordId` index
- Si no existe, crear con datos desnormalizados (pacienteNombre, tituloPlan, etc.)

### 6.3 Migrar CumplimientoService

**Archivo**: `features/pacientes/data-access/cumplimiento.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/paciente/{id}/cumplimiento` | `api.compliance.queries.getByPaciente` |

**Nota**: El servicio actual también calcula cumplimiento de "hoy" en el cliente (`getCumplimientoHoy()`). Esta lógica podría moverse a una query Convex para que sea reactiva.

### 6.4 Migrar NotificacionesService

**Archivo**: `core/services/notificaciones.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/notificaciones/mis-notificaciones` | `api.notifications.queries.myNotifications` |
| `PATCH /api/notificacion/{id}/revisar` | `api.notifications.mutations.markAsRead` |
| `PATCH /api/notificaciones/revisar-todas` | `api.notifications.mutations.markAllAsRead` |

**Beneficio tiempo real**: Las notificaciones se actualizan en vivo. Cuando un paciente completa un ejercicio con comentario, el fisio ve la notificación aparecer en el badge sin polling.

### 6.5 Migrar ComentariosPacienteService

**Archivo**: `features/pacientes/data-access/comentarios-paciente.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/paciente/{id}/comentarios` | `api.notifications.queries.listByPatient` |
| `PATCH /api/notificacion/{id}/revisar` | `api.notifications.mutations.markAsRead` |
| `PATCH /api/paciente/{id}/comentarios/revisar-todos` | `api.notifications.mutations.markAllReadForPatient` |

### 6.6 Migrar DashboardFisioService

**Archivo**: `features/dashboard/data-access/dashboard-fisio.service.ts`

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/dashboard/fisio/resumen` | `api.dashboard.queries.fisioSummary` |

**Datos del dashboard**:
- `pacientes_activos`: Count de pacientes con planes activos del fisio
- `adherencia_promedio`: Promedio de cumplimiento de los últimos 7 días
- `planes_por_vencer`: Planes con fecha_fin en los próximos 7 días

### 6.7 Migrar MetricasPacientesService

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/pacientes/metricas` | `api.dashboard.queries.patientMetrics` |

### 6.8 Verificación Fase 6

- [ ] Cron de planes expirados marca planes correctamente
- [ ] Cron de cumplimiento calcula correctamente para cada paciente/plan
- [ ] Cron de notificaciones genera notificaciones de comentarios
- [ ] Dashboard fisio muestra datos correctos (pacientes, adherencia, planes por vencer)
- [ ] Métricas bulk de pacientes se cargan correctamente
- [ ] Notificaciones aparecen en el badge del fisio
- [ ] Marcar notificación como leída funciona (optimistic update)
- [ ] Marcar todas como leídas funciona
- [ ] Comentarios del paciente se listan correctamente
- [ ] Cumplimiento histórico se muestra en calendario
- [ ] Cumplimiento de hoy se calcula en tiempo real

---

## FASE 7: PDF + Email (Actions con Node.js)

### 7.1 Migrar generación de PDF

**Archivo actual**: `apps/backend/src/services/pdfGenerator.ts`

**En Convex**: `convex/pdf/actions.ts` con `"use node"`

El PDF actual incluye:
- Header con logo de clínica (fetch desde Directus assets)
- Info del plan (título, descripción, período)
- Cards de paciente y fisio
- Lista de ejercicios con imagen de portada, configuración, instrucciones
- QR code con magic link
- Footer con nombre de clínica y fecha

**Dependencias a instalar**:
- `pdfkit` (ya en package.json)
- `qrcode` (ya en package.json)

**Punto crítico**: Las actions de Convex con `"use node"` tienen un timeout de 10 segundos por defecto. La generación de PDF con imágenes puede tardar más. Verificar límites y optimizar si es necesario.

**Flujo**:
1. Action recibe `planId`
2. Query para obtener plan completo + ejercicios + clínica + paciente + fisio
3. Generar PDF con PDFKit
4. Almacenar en Convex storage → obtener `storageId`
5. Devolver URL temporal del PDF

### 7.2 Migrar servicio de email

**Archivo actual**: `apps/backend/src/services/email.service.ts`

**En Convex**: `convex/email/actions.ts` con `"use node"`

**Dependencia**: `resend` (ya en package.json)

**Configuración**: `RESEND_API_KEY` como variable de entorno en el dashboard de Convex.

**Emails a implementar**:
1. `sendWelcomeEmail({ email, nombre, tipo })` — Registro
2. `sendCodigoAccesoEmail({ email, codigo, nombreClinica, tipo })` — Código de clínica
3. `sendAccessLinkEmail({ email, nombre, accessUrl })` — Magic link
4. `sendPasswordResetEmail({ email, codigo, nombre })` — Recuperación
5. `sendEmailVerificationCode({ email, codigo })` — Verificación
6. `sendPlanPdfEmail({ email, pdfStorageId, nombrePaciente, tituloPlan })` — Plan PDF

**Templates HTML**: Copiar los templates existentes de `email.service.ts`. Son HTML inline con branding Kengo (gradiente naranja en header).

### 7.3 Migrar endpoints de PDF

| Actual | Convex replacement |
|--------|-------------------|
| `GET /api/plan/{id}/pdf` | `api.pdf.actions.generatePlanPdf` → devuelve URL de storage |
| `POST /api/plan/{id}/pdf/enviar` | `api.pdf.actions.generateAndSendPlanPdf` |

### 7.4 Migrar contacto

| Actual | Convex replacement |
|--------|-------------------|
| `POST /api/contacto` | `api.email.actions.sendContactForm` |

### 7.5 Verificación Fase 7

- [ ] Generar PDF de un plan muestra correctamente: header, ejercicios, QR, footer
- [ ] PDF incluye imágenes de portada de ejercicios
- [ ] PDF incluye logo de clínica
- [ ] Enviar PDF por email llega correctamente con adjunto
- [ ] Email de bienvenida se envía al registrarse
- [ ] Email de código de acceso se envía al generar código con email
- [ ] Email de magic link se envía correctamente
- [ ] Email de password reset llega con código válido
- [ ] Email de verificación llega con código válido
- [ ] Formulario de contacto envía email

---

## FASE 8: Migración de archivos de S3 (Directus) a Cloudflare R2

### 8.1 Estado actual de archivos

Los archivos de Directus están almacenados en un **bucket de Amazon S3** configurado como storage adapter de Directus. Actualmente se acceden via `${DIRECTUS_URL}/assets/${uuid}` que internamente hace proxy al S3.

**Archivos a migrar**:
- ~322 portadas de ejercicios (imágenes)
- ~50+ videos de ejercicios
- Avatares de usuario
- Logos de clínicas
- Imágenes de galería de clínicas

### 8.2 Estrategia: Migrar a Cloudflare R2

**Destino: Cloudflare R2** en vez de Convex storage nativo.

**Razones**:
- R2 es compatible con la API de S3, lo que simplifica la migración
- R2 no tiene costes de egress (transferencia de salida gratuita)
- Permite transformaciones de imagen via **Cloudflare Images** / **Image Resizing** (reemplaza las transformaciones on-the-fly de Directus)
- URLs públicas estables y cacheable via Cloudflare CDN
- Mejor rendimiento global via la red edge de Cloudflare
- Convex storage nativo tiene limitaciones: URLs temporales, sin transforms, sin CDN edge

### 8.3 Configuración de R2

1. **Crear bucket R2** en el dashboard de Cloudflare
   - Nombre sugerido: `kengo-assets`
   - Región: Auto (Cloudflare elige la mejor)

2. **Configurar dominio custom** para el bucket:
   - Subdominio: `assets.kengoapp.com`
   - Esto da URLs públicas estables: `https://assets.kengoapp.com/{key}`

3. **Habilitar Cloudflare Image Resizing** (si se necesitan transforms):
   - Permite: `https://assets.kengoapp.com/{key}?width=200&height=200&fit=cover&format=webp`
   - Reemplaza exactamente las transformaciones de Directus

4. **Generar credenciales S3-compatible** para acceso programático:
   - Access Key ID + Secret Access Key
   - Endpoint: `https://{account_id}.r2.cloudflarestorage.com`

### 8.4 Script de migración S3 → R2

Dado que R2 es S3-compatible, se puede usar el **AWS SDK** (o `@aws-sdk/client-s3`) para ambos lados:

```
1. Listar todos los objetos del bucket S3 de Directus
2. Para cada objeto:
   a. Descargar del S3 de Directus (o copiar directamente si S3-to-S3 transfer)
   b. Subir al bucket R2 de Cloudflare
   c. Mantener la misma key (UUID del archivo)
3. Actualizar las tablas de Convex:
   - exercises.portada → URL en R2 (string, no Id<"_storage">)
   - exercises.video → URL en R2
   - users.avatar → URL en R2
   - clinics.logo → URL en R2
```

**Alternativa más rápida**: Usar `rclone` para copiar todo el bucket de una vez:
```bash
rclone copy s3-directus:bucket-name r2-kengo:kengo-assets --progress
```

### 8.5 Cambios en el schema de Convex

El schema actual usa `v.id("_storage")` para archivos. Con R2, cambia a `v.string()` (URLs directas):

**Tablas afectadas**:
- `exercises`: `portada` y `video` → `v.optional(v.string())` (URL de R2)
- `users`: `avatar` → `v.optional(v.string())` (URL de R2)
- `clinics`: `logo` → `v.optional(v.string())` (URL de R2)
- `clinicFiles`: `fileId` → `v.string()` (URL de R2)

**Nota**: Este cambio de schema debe hacerse **antes** del seed de la Fase 1, o en la Fase 1 directamente, para que los ejercicios se creen con URLs de R2 desde el principio.

### 8.6 Helper de asset URL

Con R2 + dominio custom, las URLs son directas y estables:

```typescript
// Antes (Directus con transforms)
`${DIRECTUS_URL}/assets/${uuid}?width=200&height=200&fit=cover&format=webp`

// Después (R2 con Cloudflare Image Resizing)
`https://assets.kengoapp.com/${key}?width=200&height=200&fit=cover&format=webp`

// O sin transforms (CSS resize)
`https://assets.kengoapp.com/${key}`
```

### 8.7 Subida de nuevos archivos

Para archivos nuevos (avatar, logo, portadas) subidos por usuarios después de la migración:

1. **Opción A — Subir desde el frontend** a R2 via presigned URL:
   - Convex action genera presigned URL de R2
   - Frontend sube directamente a R2 (sin pasar por Convex)
   - Convex guarda la URL resultante

2. **Opción B — Subir via Convex action**:
   - Frontend envía el archivo a una Convex action (`"use node"`)
   - La action sube a R2 usando AWS SDK
   - Guarda la URL en la tabla

**Recomendación**: Opción A (presigned URLs) para archivos grandes (videos). Opción B para archivos pequeños (avatares, logos).

### 8.8 Transformación de imágenes

Con Cloudflare Image Resizing habilitado en el dominio custom:
- Las transformaciones son **idénticas** a las de Directus (`?width=200&height=200&fit=cover&format=webp`)
- Sin coste adicional de procesamiento (incluido en el plan de Cloudflare)
- Cache automática en el edge de Cloudflare
- No necesita pre-generar thumbnails

### 8.9 Verificación Fase 8

- [ ] Bucket R2 creado con dominio custom `assets.kengoapp.com`
- [ ] Credenciales S3-compatible generadas
- [ ] Migración de archivos S3 → R2 completada
- [ ] Todas las portadas de ejercicios se muestran via R2
- [ ] Videos de ejercicios se reproducen via R2
- [ ] Avatares de usuario se muestran via R2
- [ ] Logos de clínicas se aplican correctamente
- [ ] Transformaciones de imagen funcionan (width, height, fit, format)
- [ ] Subida de nuevos archivos funciona (presigned URL o action)
- [ ] No hay referencias rotas a Directus/S3 assets
- [ ] Schema actualizado de `v.id("_storage")` a `v.string()` donde corresponda

---

## FASE 9: Cleanup y eliminación de Directus

### 9.1 Eliminar código Directus del frontend

1. Eliminar `authInterceptor` de `app.config.ts`
2. Eliminar `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))` (si ya no se usa HttpClient para nada)
3. Eliminar archivos:
   - `core/http/interceptors/auth.interceptor.ts`
4. Eliminar de environments:
   - `DIRECTUS_URL`
   - `API_URL`
5. Eliminar tipos Directus de shared library:
   - `libs/shared/models/src/lib/directus/` (todo el directorio)
   - Actualizar barrel exports
6. Eliminar dependencia `@directus/sdk` de `package.json`

### 9.2 Eliminar backend Node.js

1. Eliminar `apps/backend/` completamente
2. Eliminar scripts de backend en `package.json`:
   - `start:backend`, `build:backend`, `dev:backend`
   - `railway:build:backend`, `railway:start:backend`
3. Eliminar configuración de proxy (`proxy.conf.js` — rutas `/directus` y `/api`)
4. Actualizar Caddy config para eliminar reverse proxy a backend

### 9.3 Limpiar shared types

- Eliminar `lib/database/*.db.ts` — ya no hay MySQL
- Mantener `lib/domain/*.ts` — los tipos de dominio siguen siendo válidos
- Actualizar `lib/payloads/*.ts` — adaptar a los args de mutations/actions de Convex
- Eliminar `lib/types/common.ts` campos obsoletos (DirectusAuditFields)

### 9.4 Eliminar infraestructura Directus

1. Dar de baja el servicio de Directus en Railway/hosting
2. Hacer backup final de la base MySQL
3. Eliminar la base MySQL

### 9.5 Verificación Fase 9

- [ ] `npm run build` compila sin errores
- [ ] `npm run lint` pasa sin errores nuevos
- [ ] Toda la app funciona sin Directus corriendo
- [ ] No hay referencias a `/directus/` en el código
- [ ] No hay referencias a `/api/` (backend custom) en el código
- [ ] La app funciona completamente con Convex como único backend

---

## Consideraciones transversales

### Manejo de errores

Convex lanza excepciones que se propagan al cliente. El patrón actual de `try/catch` con `HttpErrorResponse` cambia a:

```typescript
// Antes (Directus)
try {
  await this.http.post('/directus/items/Planes', data).toPromise();
} catch (error) {
  if (error.status === 403) { ... }
}

// Después (Convex)
try {
  await this.convex.mutation(api.plans.mutations.create, data);
} catch (error) {
  // Convex errors son ConvexError con message y data
  if (error.data?.code === 'PERMISSION_DENIED') { ... }
}
```

### Optimistic updates

El servicio actual tiene optimistic updates en:
- `NotificacionesService` — marcar como leída
- `EjerciciosService` — toggle favorito

En Convex, las suscripciones reactivas actualizan automáticamente después de la mutation. Para UX instantáneo, se puede:
1. Usar signals locales para actualizar inmediatamente
2. La suscripción Convex confirma (o revierte) automáticamente

### Persistencia local (localStorage)

- `RegistroSesionService`: Sesión activa con TTL 24h → **Mantener sin cambios**. Es estado local del cliente.
- `ThemeService`: Cache de tema con TTL 30 días → **Mantener sin cambios**.
- `SessionService`: `lastFisioId` → **Mantener sin cambios**.

### Constraint de unicidad

Convex no tiene constraints UNIQUE nativos. Para replicar:
- `codigos_acceso.codigo` UNIQUE → Verificar existencia antes de insert en la mutation
- `cumplimiento_diario (fecha, paciente, plan)` UNIQUE → Query con index compuesto antes de insert
- `notificaciones_fisio (id_registro, tipo)` UNIQUE → Query antes de insert
- `directus_users.email` UNIQUE → Query con index `by_email` antes de insert

### Cascade deletes

Convex no tiene CASCADE. Al eliminar:
- Un plan → Eliminar manualmente planExercises y planRecords asociados
- Un usuario → Eliminar memberships, favorites, records, sessions, tokens
- Una clínica → Eliminar memberships, accessCodes, assignments, clinicFiles

Implementar helpers en `convex/_helpers/cascadeDelete.ts` para cada caso.

### Paginación

El patrón actual usa `limit` + `offset` (Directus). Convex usa **cursor-based pagination** via `.paginate()`. Los servicios Angular que manejan paginación (PlanesService, EjerciciosService, RutinasService) deben adaptarse:

```typescript
// Antes: page signal + computed offset
const offset = computed(() => (this.page() - 1) * this.pageSize());

// Después: cursor-based
const { results, continueCursor, isDone } = await ctx.db
  .query("plans")
  .withIndex("by_fisioId", q => q.eq("fisioId", userId))
  .paginate({ cursor, numItems: 20 });
```

### Variables de entorno en Convex

Configurar en el dashboard de Convex (o via CLI `npx convex env set`):
- `RESEND_API_KEY` — Para envío de emails
- `APP_URL` — URL del frontend (para magic links, emails)
- Variables adicionales según necesidad

---

## Orden de ejecución resumido

```
FASE 0  ✅ Setup Convex (completada)
  │
FASE 1  ── Ejercicios + Categorías + Favoritos
  │         (seed data, migrar EjerciciosService)
  │
FASE 2  ── Rutinas
  │         (seed data, migrar RutinasService)
  │
FASE 3  ── Autenticación ⚠️ CRÍTICA
  │         (Convex Auth, migración usuarios, migración transparente de passwords,
  │          AuthService, SessionService, Guards, Registro, Magic Links)
  │
FASE 4  ── Planes + Registros + Sesiones
  │         (PlanesService, PlanBuilder, RegistroSesionService, ActividadHoy, Racha)
  │
FASE 5  ── Clínicas + Membresías + Códigos + Asignaciones
  │         (ClinicasService, ClinicaGestion, Asignaciones, Theme)
  │
FASE 6  ── Cumplimiento + Notificaciones + Dashboard
  │         (Cron jobs, NotificacionesService, DashboardFisio, Métricas)
  │
FASE 7  ── PDF + Email
  │         (Actions con "use node", PDFKit, Resend)
  │
FASE 8  ── Migración de archivos
  │         (Directus assets → Convex storage)
  │
FASE 9  ── Cleanup
            (Eliminar Directus, backend Node.js, tipos obsoletos)
```

### Dependencias entre fases

```
Fase 1 ← ninguna
Fase 2 ← Fase 1 (ejercicios)
Fase 3 ← ninguna (pero afecta todas las demás)
Fase 4 ← Fase 1 (ejercicios) + Fase 3 (auth/usuarios)
Fase 5 ← Fase 3 (auth/usuarios)
Fase 6 ← Fase 4 (planes/registros) + Fase 5 (clínicas)
Fase 7 ← Fase 4 (planes) + Fase 5 (clínicas)
Fase 8 ← Fase 1-7 (todos los datos migrados)
Fase 9 ← Fase 8 (archivos migrados)
```

**Nota**: Fase 3 (auth) puede ejecutarse en paralelo con Fase 1 y 2, pero debe completarse antes de Fase 4 y 5.

---

## Checklist de progreso

### FASE 0: Setup Convex
- [x] Instalar dependencia `convex`
- [x] Añadir scripts `convex:dev` y `convex:deploy` a package.json
- [x] Crear estructura de directorios `convex/`
- [x] Definir schema completo en `convex/schema.ts`
- [x] Crear funciones de ejemplo por dominio
- [x] Crear `ConvexService` wrapper en Angular
- [x] Crear `provideConvex()` provider
- [x] Integrar en `app.config.ts`
- [x] Configurar `CONVEX_URL` en environments
- [x] Desplegar instancia self-hosted en Railway
- [x] Verificar que `npx convex dev` conecta correctamente
- [x] Verificar que Angular compila sin errores

### FASE 1: Ejercicios + Categorias + Favoritos
- [x] Exportar ejercicios de MySQL a JSON
- [x] Exportar categorias de MySQL a JSON
- [x] Exportar relaciones ejercicio-categoria de MySQL a JSON
- [x] Crear script de seed `convex/migrations/seedExercises.ts`
- [x] Ejecutar seed y verificar datos en Convex
- [x] Completar `convex/exercises/queries.ts` (paginacion, favoritos)
- [x] Migrar `EjerciciosService` a Convex
- [x] Implementar helper de asset URL (hibrido Directus/Convex)
- [ ] Verificar lista de ejercicios con portadas
- [ ] Verificar busqueda por nombre (search index)
- [ ] Verificar filtro por categoria
- [ ] Verificar toggle de favoritos
- [ ] Verificar detalle de ejercicio
- [ ] Verificar seleccion de ejercicios en plan builder
- [ ] Verificar seleccion de ejercicios en rutina builder

### FASE 2: Rutinas
- [x] Crear usuarios minimos en Convex para autores de rutinas
- [x] Exportar rutinas y rutinas_ejercicios de MySQL
- [x] Crear script de seed para rutinas
- [x] Ejecutar seed y verificar datos
- [x] Completar `convex/routines/queries.ts` (logica de visibilidad)
- [x] Completar `convex/routines/mutations.ts` (create/update atomico)
- [x] Migrar `RutinasService` a Convex
- [ ] Verificar lista de rutinas (privadas)
- [ ] Verificar lista de rutinas (clinica)
- [ ] Verificar crear rutina nueva
- [ ] Verificar editar rutina
- [ ] Verificar eliminar rutina
- [ ] Verificar duplicar rutina
- [ ] Verificar usar rutina como plantilla en plan builder

### FASE 3: Autenticacion
- [x] Configurar Convex Auth con Better-Auth (email/password provider)
- [x] Exportar usuarios de Directus (backup JSON en docs/backup_directus/)
- [x] Crear script de migracion de usuarios a Convex (convex/seed/seedUsers.ts — 256 usuarios activos)
- [x] Implementar flujo de migracion transparente de passwords (schema `users.passwordMigrated`, endpoint HTTP `/api/auth/migrate-password`, mutation `markPasswordMigrated`, AuthService.login llama migrateConvexPassword cuando Convex falla y Directus OK)
- [x] Migrar relaciones usuarios_clinicas (convex/seed/seedClinicMemberships.ts — 36 membresias)
- [x] Migrar detalle_usuario (`convex/seed/seedUserDetails.ts` ejecutado, 7 registros en tabla `userDetails`; `convex/users/details.ts` con getForCurrentUser + upsertForCurrentUser)
- [x] Crear `convex/auth/actions.ts` (register, password reset, email verification)
- [x] Crear HTTP endpoints para reset/set password en Better-Auth (`convex/http.ts`: `/api/auth/convex-reset-password`, `/api/auth/convex-set-password`)
- [x] Implementar `convex/email/templates.ts` con templates HTML (welcome, passwordReset, emailVerification, accessLink)
- [x] Implementar `convex/email/actions.ts` con Resend SDK (internalAction)
- [x] Migrar `AuthService` a Convex Auth (login Convex-primary con fallback Directus, register, recovery, reset, setPassword)
- [x] Migrar `SessionService` a queries Convex reactivas (dual-source: Convex prioritario, Directus fallback)
- [x] Migrar `EmailVerificationService` (dual-source: Convex-primary, backend fallback)
- [x] Migrar `AuthGuard` (ya usa signals de SessionService, no requiere cambios)
- [x] Migrar `FisioGuard` (ya usa signals de SessionService, no requiere cambios)
- [x] Migrar `AdminGuard` (ya usa signals de SessionService, no requiere cambios)
- [x] Implementar flujo de access tokens (QR/magic link) — creación/listado/revocación/envío por email migrados (`convex/accessTokens/*`)
- [x] Consumo de access token en Convex — plugin `magicLink` de Better-Auth + endpoint HTTP `/api/auth/consume-access-token`. Angular `consumirTokenAcceso` llama `authClient.$fetch('/magic-link/verify')` para establecer sesión.
- [x] Eliminar `tokenAcceso.ts` del backend Node (completo)
- [x] Eliminar `sessionRefresh.ts` + ruta `/auth/refrescar-sesion` del backend Node
- [x] Eliminar helpers Directus de tokens+sesiones (createDirectusSessionForUser, renewSessionJWT, getTokensUsuario, validarTokenAcceso, registrarUsoToken, revocarToken) de `models/directus.ts`
- [x] Eliminar dependencia `jsonwebtoken` del código (no se instaló, se retiró el código que la requería)
- [ ] Verificar login con email/password
- [ ] Verificar logout
- [ ] Verificar registro fisio
- [ ] Verificar registro paciente
- [ ] Verificar registro con codigo de clinica
- [ ] Verificar password recovery
- [ ] Verificar email verification
- [ ] Verificar refresh automatico de sesion
- [ ] Verificar guards (auth, fisio, admin)
- [ ] Verificar magic link / QR token (sigue via Directus)

#### Sub-tareas completadas (Fase 3 — Sesion 1: Dual-source)
- [x] Enriquecer `users.queries.me()` con roles, legacy IDs y nombres de puesto
- [x] Crear mutation `users.mutations.setLegacyDirectusId`
- [x] Agregar `convexId?: string` a interfaz `Usuario`
- [x] Crear `transformarUsuarioConvex()` en SessionService
- [x] Hacer `cargarMiUsuario()` dual-source (Convex-first, Directus fallback)
- [x] Vincular `legacyDirectusId` automaticamente en el bridge de auth

#### Sub-tareas completadas (Fase 3 — Sesion 2: Login Convex-primary)
- [x] Agregar signal `authSource` (none/convex/directus/both) a AuthService
- [x] Hacer `checkSession()` dual-source paralelo (Promise.allSettled)
- [x] Reordenar `iniciarApp()`: restaurarConvexAuth → checkSession → cargarMiUsuario
- [x] Login Convex-primary paralelo (BetterAuth + Directus simultáneo)
- [x] Condicionar timer de refresh Directus a existencia de sesion Directus activa
- [x] Degradación graceful: si Directus expira con auth=both, degrada a convex-only sin logout
- [x] Actualizar interceptor con awareness de authSource
- [x] Actualizar logout() y consumirTokenAcceso() con authSource

#### Sub-tareas completadas (Fase 3 — Sesion 3: Auth actions en Convex)
- [x] Añadir `intentos_fallidos` a tablas `recoveryCodes` y `verificationCodes` en schema
- [x] Añadir índice `by_email` a `recoveryCodes`
- [x] Crear `convex/email/templates.ts` con 4 templates HTML (welcome, passwordReset, emailVerification, accessLink)
- [x] Implementar `convex/email/actions.ts` con Resend SDK (internalAction)
- [x] Crear `convex/auth/queries.ts` (emailExists, findUserByEmail, findUserByExternalId, findAccessCode, rate limiting queries)
- [x] Crear `convex/auth/mutations.ts` (createRecoveryCode, validateAndConsumeRecoveryCode, createVerificationCode, validateAndConsumeVerificationCode, markEmailVerified, createMembershipFromCode)
- [x] Crear `convex/auth/actions.ts` con 6 actions: register, requestPasswordReset, resetPassword, sendVerificationCode, verifyEmail, establecerPassword
- [x] Actualizar `AuthService` con dual-source en register, solicitarRecuperacion, resetPassword, establecerPassword
- [x] Actualizar `EmailVerificationService` con dual-source en enviarCodigo, verificarEmail
- [x] Verificar compilación Convex (`npx convex dev --once`)
- [x] Verificar compilación Angular (`npx nx build app`)

#### Pendiente (Fase 3 — Sesion 4: Verificación y flujos restantes)
- [ ] Verificar login con email/password (dual-source)
- [ ] Verificar cold start con ambas sesiones
- [ ] Verificar cold start solo Directus
- [ ] Verificar cold start solo Convex
- [ ] Verificar degradación graceful mid-session
- [ ] Verificar magic link / QR token

#### Sesión 5 (2026-04-25) — Full Convex-only consolidation
- [x] Crear queries/mutations Convex faltantes: `users.queries.listPatientsByClinic/listFisiosByClinic`, `users.mutations.updateProfile/updateAvatar/updatePatient/upsertPatientWithMembership`, `users.actions.createPatient`, `clinicMemberships/queries+mutations`, `plans.queries.listExercisesByPlanId`, `records.queries.listByPacienteAndDateExpanded/InRange/SinceDate`, `storage/mutations+queries`
- [x] Crear `apps/app/.../core/services/storage.service.ts` (helper Convex storage temporal hasta R2)
- [x] Migrar 10 componentes residuales a Convex (perfil, add-paciente, sesion-detail, asignacion-responsable, pacientes-list, paciente-detail, actividad-estadisticas, selector-paciente, plan-builder.service, clinica-gestion.service)
- [x] Eliminar `modificar-perfil.component` (código muerto)
- [x] Reescribir `AuthService` Convex-only: eliminar dual-source, timer refresh, authSource signal, código muerto (aceptarInvitacion, migrateConvexPassword, loginDirectus, checkDirectusSession), fallbacks HTTP a Directus/API
- [x] Reescribir `SessionService` Convex-only: eliminar `cargarDesdeDirectus`, `transformarUsuarioDirectus` (alias), `uploadFile` muerto, `updateMe` comentado
- [x] Simplificar `EmailVerificationService`: eliminar fallbacks HTTP
- [x] Eliminar `auth.interceptor.ts` y referencia en `app.config.ts` + `core/index.ts`
- [x] Eliminar controllers Node migrados: `registro.ts`, `passwordReset.ts`, `emailVerification.ts` y rutas en `apiKengo.ts`
- [x] Verificar `npx convex dev --once` (compila OK)
- [x] Verificar `npx nx build app` (build OK)
- [x] Verificar `npx nx build backend` (build OK)
- [ ] Verificar funcionalmente login/logout/registro/recovery/magic link (manual)
- [ ] Verificar funcionalmente perfil/cambio avatar/cambio password (manual)
- [ ] Verificar funcionalmente add-paciente/edit-paciente (manual)
- [ ] Verificar funcionalmente sesion-detail, paciente-detail, pacientes-list (manual)
- [ ] Verificar Network tab: 0 calls a `/directus/items` o `/api/{registro,auth/recuperar,auth/reset}`

### FASE 4: Planes + Registros + Sesiones
- [x] Exportar planes, planes_ejercicios, planes_registros, sesiones de MySQL (backup JSON en docs/backup_directus/)
- [x] Crear script de seed con mapeo de IDs legacy (convex/seed/seedPlans.ts — 5 tablas, batch inserts con resolución de IDs)
- [x] Ejecutar seed y verificar datos (86 planes, 242 ejercicios, 168 sesiones, 498 registros, 1241 cumplimiento)
- [x] Completar `convex/plans/queries.ts` (listByFisio, listByPaciente, getById, getByLegacyId, getActiveForPatientToday, getActiveAndFuture, checkPlanHasActivity)
- [x] Completar `convex/plans/mutations.ts` (create, updateEstado, update, remove, version)
- [x] Completar `convex/records/mutations.ts` (create + createBatch)
- [ ] Implementar `ctx.scheduler.runAfter()` para recalculo de cumplimiento
- [x] Migrar `PlanesService` a Convex (watchQuery reactivo + idMap + mappers)
- [x] Migrar `PlanBuilderService` a Convex (createPlanDeep, updatePlan, versionPlan, loadPlanForEdit, checkPlanHasActivity → mutations atómicas)
- [x] Migrar `RegistroSesionService` a Convex (6 HTTP methods → Convex mutations/queries, fire-and-forget mantenido en Node.js)
- [x] Migrar `ActividadHoyService` a Convex (sin cambios — consume PlanesService + RegistroSesionService migrados)
- [x] Migrar `RachaPacienteService` a Convex (sin cambios — consume CumplimientoService migrado)
- [x] Migrar `CumplimientoService` a Convex (getCumplimiento → compliance.queries.getByPaciente)
- [x] Resolver IDs de paciente en queries Convex (UUID Directus → Convex ID via `resolvePacienteId` helper en plans, records, compliance queries)
- [ ] Verificar lista de planes del fisio (con filtros)
- [ ] Verificar detalle de plan
- [ ] Verificar crear plan nuevo
- [ ] Verificar editar plan
- [ ] Verificar cambiar estado del plan
- [ ] Verificar eliminar plan
- [ ] Verificar sesion de ejercicios completa
- [ ] Verificar registros batch
- [ ] Verificar persistencia local (refresh pagina)
- [ ] Verificar multi-plan session
- [ ] Verificar actividad del dia
- [ ] Verificar racha y cumplimiento semanal

### FASE 5: Clinicas + Membresias + Codigos + Asignaciones
- [x] Completar `convex/clinics/queries.ts` (getMembers ya existia)
- [x] Completar `convex/clinics/mutations.ts` (update con permisos de admin)
- [x] Completar `convex/accessCodes/mutations.ts` (consume con validacion completa + create devuelve codigo)
- [x] Completar `convex/assignments/mutations.ts` (assign individual para auto-asignacion)
- [x] Completar `convex/assignments/queries.ts` (getFisioResponsable acepta legacy IDs)
- [x] Agregar `convex/users/queries.ts` getByLegacyId (resolver usuarios por Directus UUID)
- [x] Seed de datos: usuarios (256), clinicas (4), membresias (36), codigos (10), asignaciones (29) — via `npx convex run seed/seedPhase5:seedPhase5`
- [x] Migrar `ClinicasService` a Convex (watchQuery reactivo + fisios por clinica)
- [x] Migrar `ClinicaGestionService` a Convex (vincular, crear, actualizar, codigos)
- [x] Migrar `AsignacionesService` a Convex (con Observable wrappers para compatibilidad)
- [x] ThemeService: sin cambios necesarios (consume selectedClinica que mantiene interfaz Clinica)
- [ ] Verificar lista de clinicas
- [ ] Verificar crear clinica
- [ ] Verificar editar clinica
- [ ] Verificar generar codigo de acceso
- [ ] Verificar listar/activar/desactivar codigos
- [ ] Verificar vincular via codigo
- [ ] Verificar validacion de email en codigo
- [ ] Verificar limite de usos
- [ ] Verificar lista de fisios
- [ ] Verificar asignaciones
- [ ] Verificar bulk assign
- [ ] Verificar theme de clinica

### FASE 6: Cumplimiento + Notificaciones + Dashboard
- [x] Exportar cumplimiento_diario de MySQL (incluido en seed Fase 4: 1241 registros)
- [ ] Exportar notificaciones_fisio de MySQL (diferido: las notificaciones se regeneran con el cron)
- [ ] Crear script de seed para notificaciones (diferido: se regeneran al ejecutar el cron por primera vez)
- [x] Implementar cron job: planes expirados (`convex/plans/internal.ts` — ya implementado)
- [x] Implementar cron job: cumplimiento diario (`convex/compliance/internal.ts` — portado de backend Node)
- [x] Implementar cron job: notificaciones fisio (`convex/notifications/internal.ts` — comentarios + observaciones de sesión)
- [x] Implementar scheduler post-sesión (`convex/records/mutations.ts` + `convex/sessions/mutations.ts` con `ctx.scheduler.runAfter`)
- [x] Añadir `patientMetrics` a `convex/dashboard/queries.ts` (bulk por paciente)
- [x] Reescribir `fisioSummary` con shape compatible (pacientes_activos, adherencia_promedio, planes_por_vencer)
- [x] Añadir `listForCurrentFisio` y `listCommentsByPatient` a `convex/notifications/queries.ts`
- [x] Añadir `markAllAsReadForCurrentFisio` y `markAllReadForPatient` a `convex/notifications/mutations.ts`
- [x] Migrar `CumplimientoService` a Convex (getCumplimiento → compliance.queries.getByPaciente, migrado en Fase 4b)
- [x] Migrar `NotificacionesService` a Convex (watchQuery reactivo + optimistic overrides)
- [x] Migrar `ComentariosPacienteService` a Convex
- [x] Migrar `DashboardFisioService` a Convex (watchQuery reactivo)
- [x] Migrar `MetricasPacientesService` a Convex (Observable wrapper preservado)
- [x] Eliminar fire-and-forget HTTP del `RegistroSesionService` (reemplazado por `ctx.scheduler`)
- [ ] Verificar cron de planes expirados
- [ ] Verificar cron de cumplimiento diario
- [ ] Verificar cron de notificaciones
- [ ] Verificar dashboard fisio
- [ ] Verificar metricas de pacientes
- [ ] Verificar notificaciones en tiempo real
- [ ] Verificar marcar como leida
- [ ] Verificar comentarios del paciente
- [ ] Verificar cumplimiento historico
- [ ] Verificar cumplimiento de hoy reactivo

### FASE 7: PDF + Email
- [x] Instalar dependencia `resend` en Convex
- [x] Implementar `convex/email/actions.ts` con Resend SDK (internalAction, migrado en Fase 3)
- [x] Implementar `convex/email/templates.ts` con templates de auth (welcome, passwordReset, emailVerification, accessLink)
- [x] Añadir templates `planPdfEmailTemplate` y `contactFormTemplate` a `convex/email/templates.ts`
- [x] Añadir actions `sendPlanPdfEmail` y `sendContactForm` a `convex/email/actions.ts`
- [x] Implementar `convex/pdf/internal.ts` (getPlanDataForPdf, getOrCreateAccessTokenForPdf)
- [x] Implementar `convex/pdf/actions.ts` con PDFKit (generatePlanPdf, generateAndSendPlanPdf)
- [x] Implementar `convex/contact/actions.ts` (sendContactMessage) y endpoint HTTP `/api/contact/send`
- [x] Configurar `RESEND_API_KEY` en env vars de Convex
- [x] Configurar `APP_URL` en env vars de Convex
- [x] Migrar endpoint de generacion de PDF (`paciente-detail.descargarInforme`, `dialogo-pdf.component`)
- [x] Migrar endpoint de envio de PDF por email (`dialogo-pdf.component.enviarEmail`)
- [x] Migrar formulario de contacto (`landingpage/footer.component` → `/api/contact/send`)
- [x] Eliminar controllers Node ya migrados (dashboard, metricas-pacientes, notificaciones, cumplimiento, pdf, contacto, pdfGenerator)
- [x] Eliminar rutas Node migradas de `apiKengo.ts`
- [x] Desactivar crons Node duplicados (los ejecuta Convex)
- [x] Eliminar `sendPlanPdfEmail` y `sendContactEmail` de `email.service.ts`
- [ ] Verificar generacion de PDF completo
- [ ] Verificar envio de PDF por email
- [ ] Verificar email de bienvenida
- [ ] Verificar email de codigo de acceso
- [ ] Verificar email de magic link
- [ ] Verificar email de password reset
- [ ] Verificar email de verificacion
- [ ] Verificar formulario de contacto

### FASE 8: Migracion de archivos S3 → Cloudflare R2
**Preparación ya ejecutada** (Sesión G preparatoria):
- [x] Helper centralizado `apps/app/src/app/core/utils/asset-url.ts` con `assetUrl(key, opts)`, `thumbnailUrl`, `rawAssetUrl`
- [x] Env var `ASSETS_URL` añadida a `environment.ts` / `environment.prod.ts` (apunta a Directus CDN actual)
- [x] 25 archivos migrados: todas las ocurrencias `${env.DIRECTUS_URL}/assets/${uuid}?...` sustituidas por `assetUrl(uuid, {...})`. 0 referencias residuales.
- [x] Convex `convex/pdf/actions.ts#fetchAsset` parametrizado con `ASSETS_URL` env (fallback a DIRECTUS_URL/assets)

**Cutover ejecutado (2026-04-25)**:
- [x] Crear bucket R2 `kengo-assets` en Cloudflare
- [x] Configurar dominio custom `assets.kengoapp.com`
- [x] Copiar archivos de S3 (Directus) a R2 vía **Super Slurper** (herramienta nativa de Cloudflare desde el dashboard, sin scripts locales)
- [x] Verificar URLs reales en R2 (10 portadas + 5 videos via curl, 200 OK)
- [x] Detectar patrón de keys: imágenes `<uuid>.webp`, vídeos `<uuid>.mp4` (heredado de Directus storage)
- [x] Actualizar helper `apps/app/.../core/utils/asset-url.ts`:
  - Default extension `.webp` para imágenes (auto-detección si la key ya trae extensión conocida)
  - Nuevo helper `videoUrl(key)` con extensión `.mp4`
  - `rawAssetUrl` mantiene compat (default `.webp`)
- [x] Actualizar `convex/pdf/actions.ts#fetchAsset` con la misma lógica de extensión
- [x] Migrar 2 callsites de vídeo a `videoUrl()`:
  - `apps/app/.../features/sesion/data-access/registro-sesion.service.ts → getVideoUrl`
  - `apps/app/.../features/actividad/pages/actividad-hoy/actividad-hoy.component.ts → previewEjercicio.videoUrl`
- [x] Flip switch `ASSETS_URL` en `environment.ts` y `environment.prod.ts` → `https://assets.kengoapp.com`
- [x] Configurar env var `ASSETS_URL=https://assets.kengoapp.com` en Convex (`npx convex env set`)
- [x] Verificar build Angular y compilación Convex (OK)

**Paso B ejecutado (2026-04-25) — Subida directa a R2 vía presigned URLs**:
- [x] Generar credenciales R2 (Account API token con Object R&W limitado a `kengo-assets`) y configurar 6 env vars en Convex (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL`)
- [x] Instalar deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- [x] Crear `convex/storage/r2Client.ts` (S3Client + helpers `r2Bucket`, `r2PublicUrl`)
- [x] Crear `convex/storage/actions.ts` con `generateUploadUrl` (action `"use node"`, presigned PUT 5 min, prefix obligatorio: `avatars`/`logos`/`clinic-files`, UUID server-side, extensión derivada de filename o contentType) y `deleteObject`
- [x] Eliminar `convex/storage/mutations.ts` y `queries.ts` antiguos (Convex storage interno ya no necesario)
- [x] Schema migration `convex/schema.ts`: `users.avatar`, `clinics.logo`, `clinicFiles.fileId` de `v.id("_storage")` a `v.string()` (sin migración de datos: campos vacíos en producción)
- [x] Actualizar mutations consumidoras: `users/mutations.updateAvatar({ key })` y `clinics/mutations.update` (logo acepta `string | null` para borrar)
- [x] Reescribir `apps/app/.../core/services/storage.service.ts` con `upload(file, prefix)` que devuelve `{ key, url }`. PUT directo a R2 vía presigned URL.
- [x] Adaptar 3 call sites: `perfil.component.ts:251` (avatars), `clinica-gestion.service.ts:307` (uploadFile añade arg prefix), `editar-clinica-dialog.component.ts:268,282` (logos + clinic-files)
- [x] Verificar build Convex y Angular (OK)
- [ ] Verificar funcionalmente: subir avatar → R2 dashboard → carpeta `avatars/`
- [ ] Verificar funcionalmente: subir logo de clínica → R2 dashboard → carpeta `logos/`
- [ ] Verificar funcionalmente: subir imagen de galería → R2 dashboard → carpeta `clinic-files/`

**Pendiente (post-cutover)**:
- [ ] Habilitar Cloudflare Image Resizing en el dominio (requiere plan Pro $20/mes — opcional)
- [ ] Configurar Cache Rules en Cloudflare para `assets.kengoapp.com` (Edge TTL 1 mes, Browser TTL 1 día)
- [ ] Esperar 1-2 semanas con bucket S3 origen vivo como rollback
- [ ] Configurar CORS policy en R2 si el navegador bloquea PUT desde `localhost:4200`
- [ ] Apagar bucket S3 origen y desactivar storage adapter de Directus

### FASE 9: Cleanup
**Ejecutado (2026-04-25)**:
- [x] Eliminar `authInterceptor` de `app.config.ts` (ya hecho en Fase 3 sesión auth)
- [x] Eliminar `DIRECTUS_URL` y `API_URL` de environments (`environment.ts` y `environment.prod.ts`)
- [x] Eliminar directorios `libs/shared/models/src/lib/database/` (entero) y archivos huérfanos `lib/directus/clinics.directus.ts`, `routines.directus.ts`. Mantener `users.directus.ts`, `exercises.directus.ts`, `plans.directus.ts` (los 3 tienen tipos en uso como contratos de datos)
- [x] Actualizar barrel exports `libs/shared/models/src/index.ts`: eliminar re-exports de `database/` y de `directus/{clinics,routines}`. Mover `VisibilidadRutina` a `payloads/routines.payload.ts`
- [x] Eliminar `DirectusAuditFields` de `lib/types/common.ts` (sin uso)
- [x] Limpiar `apps/app/src/types/global.ts`: eliminar re-exports de tipos `*DB` y de `*Directus` huérfanos. Mantener `UsuarioDirectus`, `EjercicioDirectus`, `RegistroEjercicioDirectus`, `EstadoPlan`, `VisibilidadRutina`
- [x] Eliminar `transformarUsuarioDirectus` alias muerto de `session.service.ts`
- [x] Limpiar `pacientes-list.component.ts:223` cast residual a `UsuarioDirectus`
- [x] Eliminar fallback `process.env.DIRECTUS_URL` de `convex/pdf/actions.ts → fetchAsset` y header `DIRECTUS_STATIC_TOKEN`
- [x] Eliminar `@directus/sdk` y deps Node-only (`cookie-parser`, `cors`, `mysql2`, `node-cron`, `nodemon`, `@types/cookie-parser`, `@types/cors`, `@types/node-cron`) de `package.json`
- [x] Eliminar `apps/backend/` completamente
- [x] Eliminar scripts de backend (`start:backend`, `build:backend`, `dev:backend`, `railway:build:backend`, `railway:start:backend`) de `package.json`
- [x] Eliminar `apps/app/proxy.conf.js` y la referencia `proxyConfig` en `apps/app/project.json`
- [x] Verificar `npx convex dev --once` (OK)
- [x] Verificar `npx nx build app` (OK)
- [x] Verificar `npx nx build landingpage` (OK)
- [x] Verificar `npx nx lint app` (mismo nivel de errores que baseline; cero regresiones)

**Pendiente (acciones de infraestructura externas, fuera del repo)**:
- [ ] Backup final MySQL antes de dar de baja Directus
- [ ] Dar de baja servicio Directus en Railway/hosting
- [ ] Apagar bucket S3 origen tras 1-2 semanas de rodaje en R2
- [ ] (Futuro opcional) Renombrar tipos `*Directus` residuales (`UsuarioDirectus` → `UsuarioRecord`, etc.) y unificar con tipos de dominio
- [ ] Backup final de MySQL
- [ ] Dar de baja servicio Directus
- [ ] Eliminar base MySQL
