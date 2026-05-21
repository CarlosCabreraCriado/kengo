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
    dni: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    sexo: v.optional(
      v.union(v.literal("M"), v.literal("F"), v.literal("otro")),
    ),
    // Texto denormalizado (lower-cased) para búsqueda full-text. Se mantiene
    // sincronizado en upsertFromAuth, updateProfile, updatePatient.
    searchableText: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .searchIndex("search_users", {
      searchField: "searchableText",
    }),

  // === PUSH TOKENS (FCM) ===
  // Un registro por (usuario, dispositivo). El cliente Capacitor obtiene un
  // FCM token unificado iOS/Android vía @capacitor-firebase/messaging y lo
  // upserta aquí en cada arranque y cada vez que FCM rota el token.
  // `deviceId` proviene de `Device.getId()` y es estable por instalación.
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    deviceId: v.string(),
    updatedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deviceId", ["userId", "deviceId"])
    .index("by_token", ["token"]),

  // === CLÍNICAS ===
  clinics: defineTable({
    nombre: v.string(),
    /** Nombre comercial abreviado (máx. 15 caracteres) usado en piezas de UI con espacio reducido. */
    nombreComercial: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    web: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    // R2 key: `logos/<uuid>.<ext>`
    logo: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
    createdBy: v.id("users"),
  }),

  clinicFiles: defineTable({
    clinicId: v.id("clinics"),
    // R2 key: `clinic-files/<uuid>.<ext>`
    fileId: v.string(),
  }).index("by_clinicId", ["clinicId"]),

  clinicMemberships: defineTable({
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    puesto: v.union(
      v.literal("fisio"),
      v.literal("paciente"),
      v.literal("admin"),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_clinicId", ["clinicId"])
    .index("by_userId_clinicId", ["userId", "clinicId"]),

  // === EJERCICIOS (catálogo) ===
  // Catálogo gestionado desde Directus (CMS). El cron `directus-catalog-sync`
  // (04:00 UTC, ver `convex/sync/`) replica altas/cambios/bajas detectadas por
  // `date_updated` en Directus. `directusId` enlaza con `ejercicios.id_ejercicio`
  // y `archivado` permite ocultar del catálogo sin romper FKs en planes/rutinas.
  exercises: defineTable({
    nombreEjercicio: v.string(),
    descripcion: v.optional(v.string()),
    seriesDefecto: v.optional(v.number()),
    repeticionesDefecto: v.optional(v.number()),
    video: v.optional(v.string()),
    portada: v.optional(v.string()),
    directusId: v.optional(v.number()),
    archivado: v.optional(v.boolean()),
    directusUpdatedAt: v.optional(v.number()),
  })
    .searchIndex("search_nombre", { searchField: "nombreEjercicio" })
    .index("by_directusId", ["directusId"]),

  categories: defineTable({
    nombreCategoria: v.string(),
    directusId: v.optional(v.number()),
    directusUpdatedAt: v.optional(v.number()),
  }).index("by_directusId", ["directusId"]),

  exerciseCategories: defineTable({
    exerciseId: v.id("exercises"),
    categoryId: v.id("categories"),
    directusId: v.optional(v.number()),
  })
    .index("by_exerciseId", ["exerciseId"])
    .index("by_categoryId", ["categoryId"])
    .index("by_directusId", ["directusId"]),

  exerciseFavorites: defineTable({
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_exerciseId", ["userId", "exerciseId"]),

  // === PLANES DE TRATAMIENTO ===
  // `clinicId` es obligatorio tras el backfill (ver migrations/
  // backfillPlanClinicId*.ts). Todo plan creado a partir de aquí pertenece
  // estrictamente a una clínica; las queries y mutations validan acceso
  // contra esa clínica.
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
    clinicId: v.id("clinics"),
    planAnterior: v.optional(v.id("plans")),
    version: v.number(),
  })
    .index("by_fisioId", ["fisioId"])
    .index("by_pacienteId", ["pacienteId"])
    .index("by_estado", ["estado"])
    .index("by_fisioId_estado", ["fisioId", "estado"])
    .index("by_pacienteId_estado", ["pacienteId", "estado"])
    .index("by_clinicId_estado", ["clinicId", "estado"])
    .index("by_clinicId_fisioId_estado", ["clinicId", "fisioId", "estado"]),

  planExercises: defineTable({
    planId: v.id("plans"),
    exerciseId: v.id("exercises"),
    sort: v.number(),
    series: v.optional(v.number()),
    repeticiones: v.optional(v.number()),
    duracionSeg: v.optional(v.number()),
    descansoSeg: v.optional(v.number()),
    diasSemana: v.optional(v.array(diaSemana)),
    instruccionesPaciente: v.optional(v.string()),
    notasFisio: v.optional(v.string()),
  })
    .index("by_planId", ["planId"])
    .index("by_planId_sort", ["planId", "sort"]),

  // === SESIONES ===
  sessions: defineTable({
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
    fecha: v.string(), // YYYY-MM-DD (Europe/Madrid)
    fechaInicio: v.string(), // ISO timestamp de apertura
    fechaFin: v.optional(v.string()),
    estado: v.union(
      v.literal("en_curso"),
      v.literal("completada"),
      v.literal("completada_parcial"),
    ),
    planIds: v.optional(v.array(v.id("plans"))),
    motivoCierre: v.optional(
      v.union(v.literal("auto_completitud"), v.literal("cron_nocturno")),
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
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_clinicId_fecha", ["clinicId", "fecha"])
    .index("by_pacienteId_estado", ["pacienteId", "estado"]),

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
  // `clinicId` opcional durante el periodo de migración; al recalcularse cada
  // rollup pasa a llevar la clínica de los ejercicios contabilizados. Los
  // rollups antiguos quedan sin `clinicId` hasta su próxima regeneración.
  dailyPatientRollup: defineTable({
    pacienteId: v.id("users"),
    clinicId: v.optional(v.id("clinics")),
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
  })
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_clinicId_fecha", ["clinicId", "fecha"]),

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
  // Reglas:
  //   - `visibilidad === "privado"` → `clinicId` debe ser `undefined`
  //     (rutina personal del autor).
  //   - `visibilidad === "clinica"` → `clinicId` es obligatorio, pero
  //     se declara opcional mientras dura el backfill (ver
  //     `convex/migrations/backfillRoutineClinicId.ts`). Las mutations son
  //     las que aplican la regla a partir del deploy de la migración.
  routines: defineTable({
    nombre: v.string(),
    descripcion: v.optional(v.string()),
    autorId: v.id("users"),
    visibilidad: v.union(v.literal("privado"), v.literal("clinica")),
    clinicId: v.optional(v.id("clinics")),
  })
    .index("by_autorId", ["autorId"])
    .index("by_visibilidad", ["visibilidad"])
    .index("by_clinicId", ["clinicId"])
    .searchIndex("search_nombre", { searchField: "nombre" }),

  routineExercises: defineTable({
    routineId: v.id("routines"),
    exerciseId: v.id("exercises"),
    sort: v.number(),
    series: v.optional(v.number()),
    repeticiones: v.optional(v.number()),
    duracionSeg: v.optional(v.number()),
    descansoSeg: v.optional(v.number()),
    diasSemana: v.optional(v.array(diaSemana)),
    instruccionesPaciente: v.optional(v.string()),
    notasFisio: v.optional(v.string()),
  })
    .index("by_routineId", ["routineId"])
    .index("by_routineId_sort", ["routineId", "sort"]),

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

  // === MENSAJERÍA (chat 1-1 fisio↔paciente dentro de una clínica) ===
  // `archivedAt` se rellena cuando uno de los dos participantes pierde la
  // membresía de la clínica (cascada en `clinicMemberships.remove`). Las
  // conversaciones archivadas dejan de aparecer en `listMyConversations`
  // pero no se borran para preservar el historial accesible si se
  // restaurara la membresía.
  conversations: defineTable({
    pacienteId: v.id("users"),
    fisioId: v.id("users"),
    clinicId: v.id("clinics"),
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessageSenderId: v.optional(v.id("users")),
    pacienteUnreadCount: v.number(),
    fisioUnreadCount: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_pacienteId_lastMessageAt", ["pacienteId", "lastMessageAt"])
    .index("by_fisioId_lastMessageAt", ["fisioId", "lastMessageAt"])
    .index("by_paciente_fisio_clinic", [
      "pacienteId",
      "fisioId",
      "clinicId",
    ]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
    readAt: v.optional(v.number()),
  }).index("by_conversationId", ["conversationId"]),

  // === BILLING / SUSCRIPCIONES STRIPE ===
  // Cache local del estado de suscripción de cada clínica. El componente
  // @convex-dev/stripe persiste customer/subscription/invoices en sus propias
  // tablas; aquí guardamos campos custom (gracia local, banderas) y un espejo
  // del estado para queries rápidas y gating sin race conditions.
  clinicBilling: defineTable({
    clinicId: v.id("clinics"),
    estadoLocal: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("unpaid"),
      v.literal("none"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    trialEnd: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    graceUntil: v.optional(v.number()),
    cantidadFisios: v.optional(v.number()),
    requiereContactoVentas: v.optional(v.boolean()),
    actualizadoEn: v.number(),
  }).index("by_clinicId", ["clinicId"]),

  // === ESTADO DE SINCRONIZACIÓN DIRECTUS ===
  // Una fila por colección Directus sincronizada. `lastSyncedAt` es la cota
  // superior (max date_updated visto) usada como filtro `_gt` en el siguiente
  // pull. Se actualiza solo si la run termina ok.
  directusSyncState: defineTable({
    collection: v.union(
      v.literal("ejercicios"),
      v.literal("categorias"),
      v.literal("ejercicios_categorias"),
    ),
    lastSyncedAt: v.number(),
    lastRunAt: v.number(),
    lastRunStatus: v.union(v.literal("ok"), v.literal("error")),
    lastError: v.optional(v.string()),
    itemsCreated: v.number(),
    itemsUpdated: v.number(),
    itemsArchived: v.number(),
  }).index("by_collection", ["collection"]),
});
