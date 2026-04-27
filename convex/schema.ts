import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { diaSemana } from "./_helpers/validators";

export default defineSchema({
  // === USUARIOS ===
  users: defineTable({
    externalId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.string(),
    lastName: v.string(),
    // R2 key: `avatars/<uuid>.<ext>` (formato heredado: `<uuid>.webp` en raíz del bucket)
    avatar: v.optional(v.string()),
    telefono: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    numeroColegiado: v.optional(v.string()),
    // Campos personales (consolidados desde la antigua tabla userDetails).
    dni: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    sexo: v.optional(v.string()),
    legacyDirectusId: v.optional(v.string()),
    // Texto denormalizado (lower-cased) para búsqueda full-text. Se mantiene
    // sincronizado en upsertFromAuth, updateProfile, updatePatient.
    searchableText: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .index("by_legacyDirectusId", ["legacyDirectusId"])
    .searchIndex("search_users", {
      searchField: "searchableText",
    }),

  // DEPRECADO: tabla mantenida para compatibilidad durante migración.
  // Los nuevos datos se escriben directamente en `users`. Ejecutar la
  // internal mutation `users.migration.migrateUserDetailsToUsers` para
  // copiar los datos legacy y luego eliminar esta tabla.
  userDetails: defineTable({
    userId: v.id("users"),
    dni: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    sexo: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    telefono: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // === CLÍNICAS ===
  clinics: defineTable({
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    // R2 key: `logos/<uuid>.<ext>`
    logo: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
    createdBy: v.id("users"),
    legacyId: v.optional(v.number()),
  }).index("by_legacyId", ["legacyId"]),

  clinicFiles: defineTable({
    clinicId: v.id("clinics"),
    // R2 key: `clinic-files/<uuid>.<ext>`
    fileId: v.string(),
  }).index("by_clinicId", ["clinicId"]),

  // puesto: literal "fisio" | "paciente" | "admin" (números legacy 1/2/4
  // se aceptan transitoriamente para no romper datos existentes; el cron
  // de mantenimiento + migrateRolesToLiterals los convierte).
  clinicMemberships: defineTable({
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    puesto: v.union(
      v.number(),
      v.literal("fisio"),
      v.literal("paciente"),
      v.literal("admin"),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_clinicId", ["clinicId"])
    .index("by_userId_clinicId", ["userId", "clinicId"]),

  // === EJERCICIOS (catálogo) ===
  exercises: defineTable({
    nombreEjercicio: v.string(),
    descripcion: v.optional(v.string()),
    seriesDefecto: v.optional(v.string()),
    repeticionesDefecto: v.optional(v.string()),
    video: v.optional(v.string()),
    portada: v.optional(v.string()),
    legacyId: v.optional(v.number()),
  })
    .index("by_legacyId", ["legacyId"])
    .searchIndex("search_nombre", { searchField: "nombreEjercicio" }),

  categories: defineTable({
    nombreCategoria: v.string(),
    legacyId: v.optional(v.number()),
  }).index("by_legacyId", ["legacyId"]),

  exerciseCategories: defineTable({
    exerciseId: v.id("exercises"),
    categoryId: v.id("categories"),
  })
    .index("by_exerciseId", ["exerciseId"])
    .index("by_categoryId", ["categoryId"]),

  exerciseFavorites: defineTable({
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_exerciseId", ["userId", "exerciseId"]),

  // === PLANES DE TRATAMIENTO ===
  plans: defineTable({
    titulo: v.string(),
    descripcion: v.optional(v.string()),
    estado: v.union(
      v.literal("borrador"),
      v.literal("activo"),
      v.literal("completado"),
      v.literal("cancelado"),
    ),
    fechaInicio: v.optional(v.string()),
    fechaFin: v.optional(v.string()),
    pacienteId: v.id("users"),
    fisioId: v.id("users"),
    planAnterior: v.optional(v.id("plans")),
    version: v.number(),
    pacienteNombre: v.optional(v.string()),
    fisioNombre: v.optional(v.string()),
    legacyId: v.optional(v.number()),
  })
    .index("by_fisioId", ["fisioId"])
    .index("by_pacienteId", ["pacienteId"])
    .index("by_estado", ["estado"])
    .index("by_fisioId_estado", ["fisioId", "estado"])
    .index("by_pacienteId_estado", ["pacienteId", "estado"])
    .index("by_legacyId", ["legacyId"]),

  planExercises: defineTable({
    planId: v.id("plans"),
    exerciseId: v.id("exercises"),
    sort: v.number(),
    series: v.optional(v.number()),
    repeticiones: v.optional(v.number()),
    duracionSeg: v.optional(v.number()),
    descansoSeg: v.optional(v.number()),
    vecesDia: v.optional(v.number()),
    diasSemana: v.optional(v.array(diaSemana)),
    instruccionesPaciente: v.optional(v.string()),
    notasFisio: v.optional(v.string()),
    ejercicioNombre: v.optional(v.string()),
    legacyId: v.optional(v.number()),
  })
    .index("by_planId", ["planId"])
    .index("by_planId_sort", ["planId", "sort"])
    .index("by_legacyId", ["legacyId"]),

  // === SESIONES ===
  // Tabla en proceso de rediseño: los campos sin v.optional son legacy y se
  // mantienen mientras conviva el modelo antiguo (`sessions.mutations.create`/
  // `complete`). Los campos nuevos (clinicId, planIds, fecha, estado, agregados,
  // motivoCierre, observacionesPaciente, esSintetica) se rellenarán por las
  // mutations nuevas en `sessions/internal.ts` durante Fase 1 funcional.
  sessions: defineTable({
    pacienteId: v.id("users"),
    fechaInicio: v.string(),
    fechaFin: v.optional(v.string()),
    // Campos legacy pendientes de limpieza vía
    // `migrations/cleanup.ts:cleanupLegacySessionFields`. Se eliminarán del
    // schema en el commit posterior, una vez el cleanup haya pasado en
    // producción.
    observacionesGenerales: v.optional(v.string()),
    completada: v.optional(v.boolean()),
    legacyId: v.optional(v.number()),

    // Campos nuevos (rediseño): opcionales durante coexistencia.
    clinicId: v.optional(v.id("clinics")),
    planIds: v.optional(v.array(v.id("plans"))),
    fecha: v.optional(v.string()), // YYYY-MM-DD (Europe/Madrid)
    estado: v.optional(
      v.union(
        v.literal("en_curso"),
        v.literal("completada"),
        v.literal("completada_parcial"),
      ),
    ),
    motivoCierre: v.optional(
      v.union(
        v.literal("auto_completitud"),
        v.literal("cron_nocturno"),
      ),
    ),
    totalEsperados: v.optional(v.number()),
    totalCompletados: v.optional(v.number()),
    duracionTotalSeg: v.optional(v.number()),
    dolorMin: v.optional(v.number()),
    dolorMax: v.optional(v.number()),
    dolorPromedio: v.optional(v.number()),
    esfuerzoPromedio: v.optional(v.number()),
    observacionesPaciente: v.optional(v.string()),
    esSintetica: v.optional(v.boolean()),
  })
    .index("by_pacienteId", ["pacienteId"])
    .index("by_legacyId", ["legacyId"])
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_clinicId_fecha", ["clinicId", "fecha"])
    .index("by_estado_fechaInicio", ["estado", "fechaInicio"]),

  // === EJECUCIONES DE EJERCICIO (rediseño — sustituye a `planRecords`) ===
  // Cada ejecución pertenece a una sesión. Sin denormalizaciones de nombre
  // (se obtienen vía `planExercises`/`exercises` cuando hace falta).
  exerciseExecutions: defineTable({
    sessionId: v.id("sessions"),
    planExerciseId: v.id("planExercises"),
    pacienteId: v.id("users"),
    planId: v.id("plans"),
    clinicId: v.id("clinics"),
    fecha: v.string(), // YYYY-MM-DD
    fechaHora: v.string(), // ISO timestamp
    completado: v.boolean(),
    repeticionesRealizadas: v.optional(v.number()),
    duracionRealSeg: v.optional(v.number()),
    dolorEscala: v.optional(v.number()),
    esfuerzoEscala: v.optional(v.number()),
    notaPaciente: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_planExerciseId", ["planExerciseId"])
    .index("by_clinicId_fecha", ["clinicId", "fecha"])
    .index("by_planExerciseId_fecha", ["planExerciseId", "fecha"]),

  // === ROLLUPS DIARIOS POR PACIENTE (rediseño — sustituye a `dailyCompliance`) ===
  dailyPatientRollup: defineTable({
    pacienteId: v.id("users"),
    fecha: v.string(), // YYYY-MM-DD
    planAggregates: v.array(
      v.object({
        planId: v.id("plans"),
        esperados: v.number(),
        completados: v.number(),
        dolorMedio: v.optional(v.number()),
      }),
    ),
    totalEsperados: v.number(),
    totalCompletados: v.number(),
    dolorPromedio: v.optional(v.number()),
    esfuerzoPromedio: v.optional(v.number()),
    estadoDia: v.union(
      v.literal("completado"),
      v.literal("parcial"),
      v.literal("fallido"),
      v.literal("descanso"),
      v.literal("sin_plan"),
    ),
    sessionIds: v.array(v.id("sessions")),
    actualizadoEn: v.number(),
  }).index("by_pacienteId_fecha", ["pacienteId", "fecha"]),

  // === ROLLUPS SEMANALES POR PACIENTE ===
  weeklyPatientRollup: defineTable({
    pacienteId: v.id("users"),
    anioSemana: v.string(), // ISO 8601: "2026-W17"
    diasCompletados: v.number(),
    diasParciales: v.number(),
    diasFallidos: v.number(),
    diasDescanso: v.number(),
    adherencia: v.number(),
    dolorMedio: v.optional(v.number()),
    dolorMax: v.optional(v.number()),
    rachaMaxima: v.number(),
    sesionesCount: v.number(),
    actualizadoEn: v.number(),
    stale: v.boolean(),
  })
    .index("by_pacienteId_anioSemana", ["pacienteId", "anioSemana"])
    .index("by_stale", ["stale"]),

  // === ROLLUPS MENSUALES POR PACIENTE ===
  monthlyPatientRollup: defineTable({
    pacienteId: v.id("users"),
    anioMes: v.string(), // "2026-04"
    diasCompletados: v.number(),
    diasParciales: v.number(),
    diasFallidos: v.number(),
    diasDescanso: v.number(),
    adherencia: v.number(),
    dolorMedio: v.optional(v.number()),
    dolorMax: v.optional(v.number()),
    rachaMaxima: v.number(),
    sesionesCount: v.number(),
    tendenciaAdherencia: v.optional(v.number()), // delta vs mes anterior
    actualizadoEn: v.number(),
    stale: v.boolean(),
  })
    .index("by_pacienteId_anioMes", ["pacienteId", "anioMes"])
    .index("by_stale", ["stale"]),

  // === SNAPSHOTS POR PACIENTE (para tabla de pacientes / dashboard) ===
  // Ventanas decididas para esta iteración: 7d y 30d (sin 365d).
  patientMetricsSnapshot: defineTable({
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
    fisioId: v.id("users"),
    ventana: v.union(v.literal("7d"), v.literal("30d")),
    adherencia: v.number(),
    dolorPromedio: v.optional(v.number()),
    ultimaActividad: v.optional(v.string()), // YYYY-MM-DD
    inactividadDias: v.number(),
    rachaActual: v.number(),
    riskScore: v.number(), // 0-100
    actualizadoEn: v.number(),
  })
    .index("by_clinicId_ventana_riskScore", [
      "clinicId",
      "ventana",
      "riskScore",
    ])
    .index("by_fisioId_ventana_adherencia", [
      "fisioId",
      "ventana",
      "adherencia",
    ])
    .index("by_pacienteId_ventana", ["pacienteId", "ventana"]),

  // === SNAPSHOTS POR CLÍNICA (sustituye a `clinicMetrics`) ===
  clinicMetricsSnapshot: defineTable({
    clinicId: v.id("clinics"),
    ventana: v.union(v.literal("7d"), v.literal("30d")),
    pacientesActivos: v.number(),
    adherenciaPromedio: v.number(),
    dolorMedio: v.optional(v.number()),
    sesionesUltimos7d: v.number(),
    tendenciaAdherencia: v.optional(v.number()),
    alertasPendientes: v.number(),
    actualizadoEn: v.number(),
  }).index("by_clinicId_ventana", ["clinicId", "ventana"]),

  // === USO DE EJERCICIOS POR CLÍNICA (rollup mensual) ===
  exerciseUsageRollup: defineTable({
    clinicId: v.id("clinics"),
    exerciseId: v.id("exercises"),
    anioMes: v.string(), // "2026-04"
    vecesPrescrito: v.number(),
    vecesCompletado: v.number(),
    vecesParcial: v.number(),
    dolorMedio: v.optional(v.number()),
    dolorMax: v.optional(v.number()),
    pacientesUnicos: v.number(),
    actualizadoEn: v.number(),
  })
    .index("by_clinicId_anioMes", ["clinicId", "anioMes"])
    .index("by_exerciseId_anioMes", ["exerciseId", "anioMes"]),

  // === ALERTAS PARA FISIOS (sustituye/extiende a `physioNotifications`) ===
  physioAlerts: defineTable({
    tipo: v.union(
      v.literal("comentario"),
      v.literal("dolor_alto"),
      v.literal("inactividad"),
      v.literal("adherencia_baja"),
      v.literal("tendencia_negativa"),
    ),
    severidad: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("alta"),
    ),
    estado: v.union(
      v.literal("pendiente"),
      v.literal("revisada"),
      v.literal("descartada"),
    ),
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
    generadoPor: v.union(
      v.literal("manual"),
      v.literal("evento_sesion"),
      v.literal("regla_diaria"),
    ),
    sessionId: v.optional(v.id("sessions")),
    exerciseExecutionId: v.optional(v.id("exerciseExecutions")),
    texto: v.optional(v.string()),
    dolorEscala: v.optional(v.number()),
    inactividadDias: v.optional(v.number()),
    adherenciaPct: v.optional(v.number()),
    pacienteNombre: v.string(),
    fechaGeneracion: v.string(), // ISO
    fechaRevision: v.optional(v.string()),
    revisadaPor: v.optional(v.id("users")),
  })
    .index("by_clinicId_estado", ["clinicId", "estado"])
    .index("by_clinicId_estado_severidad", ["clinicId", "estado", "severidad"])
    .index("by_pacienteId_estado", ["pacienteId", "estado"]),

  // === RUTINAS ===
  routines: defineTable({
    nombre: v.string(),
    descripcion: v.optional(v.string()),
    autorId: v.id("users"),
    visibilidad: v.union(v.literal("privado"), v.literal("clinica")),
    legacyId: v.optional(v.number()),
  })
    .index("by_autorId", ["autorId"])
    .index("by_visibilidad", ["visibilidad"])
    .index("by_legacyId", ["legacyId"])
    .searchIndex("search_nombre", { searchField: "nombre" }),

  routineExercises: defineTable({
    routineId: v.id("routines"),
    exerciseId: v.id("exercises"),
    sort: v.number(),
    series: v.optional(v.number()),
    repeticiones: v.optional(v.number()),
    duracionSeg: v.optional(v.number()),
    descansoSeg: v.optional(v.number()),
    vecesDia: v.optional(v.number()),
    diasSemana: v.optional(v.array(diaSemana)),
    instruccionesPaciente: v.optional(v.string()),
    notasFisio: v.optional(v.string()),
    ejercicioNombre: v.optional(v.string()),
  }).index("by_routineId", ["routineId"]),

  // === CÓDIGOS DE ACCESO ===
  accessCodes: defineTable({
    clinicId: v.id("clinics"),
    codigo: v.string(),
    tipo: v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
    activo: v.boolean(),
    usosMaximos: v.optional(v.number()),
    usosActuales: v.number(),
    fechaExpiracion: v.optional(v.string()),
    email: v.optional(v.string()),
    creadoPor: v.id("users"),
  })
    .index("by_clinicId", ["clinicId"])
    .index("by_codigo", ["codigo"]),

  // === ASIGNACIONES FISIO-PACIENTE ===
  assignments: defineTable({
    pacienteId: v.id("users"),
    fisioId: v.id("users"),
    clinicId: v.id("clinics"),
  })
    .index("by_clinicId", ["clinicId"])
    .index("by_pacienteId_clinicId", ["pacienteId", "clinicId"])
    .index("by_fisioId_clinicId", ["fisioId", "clinicId"]),

  // === TOKENS DE ACCESO (QR login) ===
  accessTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    usosActuales: v.number(),
    usosMaximos: v.optional(v.number()),
    fechaExpiracion: v.optional(v.string()),
    ultimoUso: v.optional(v.string()),
    activo: v.boolean(),
    creadoPor: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // === CÓDIGOS RECUPERACIÓN / VERIFICACIÓN ===
  recoveryCodes: defineTable({
    email: v.string(),
    codigo: v.string(),
    expiration: v.string(),
    usado: v.boolean(),
    intentos_fallidos: v.number(),
  })
    .index("by_email_codigo", ["email", "codigo"])
    .index("by_email", ["email"]),

  verificationCodes: defineTable({
    userId: v.id("users"),
    codigo: v.string(),
    expiration: v.string(),
    usado: v.boolean(),
    intentos_fallidos: v.number(),
  }).index("by_userId", ["userId"]),

});
