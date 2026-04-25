import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const diaSemana = v.union(
  v.literal("L"),
  v.literal("M"),
  v.literal("X"),
  v.literal("J"),
  v.literal("V"),
  v.literal("S"),
  v.literal("D"),
);

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
    legacyDirectusId: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .index("by_legacyDirectusId", ["legacyDirectusId"]),

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

  // puesto: 1=fisioterapeuta, 2=paciente, 4=administrador
  clinicMemberships: defineTable({
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    puesto: v.number(),
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

  planRecords: defineTable({
    planExerciseId: v.id("planExercises"),
    pacienteId: v.id("users"),
    sessionId: v.optional(v.id("sessions")),
    fechaHora: v.string(),
    fecha: v.string(),
    completado: v.boolean(),
    repeticionesRealizadas: v.optional(v.number()),
    duracionRealSeg: v.optional(v.number()),
    dolorEscala: v.optional(v.number()),
    esfuerzoEscala: v.optional(v.number()),
    notaPaciente: v.optional(v.string()),
  })
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_planExerciseId", ["planExerciseId"])
    .index("by_sessionId", ["sessionId"]),

  // === SESIONES ===
  sessions: defineTable({
    pacienteId: v.id("users"),
    fechaInicio: v.string(),
    fechaFin: v.optional(v.string()),
    observacionesGenerales: v.optional(v.string()),
    completada: v.boolean(),
    legacyId: v.optional(v.number()),
  })
    .index("by_pacienteId", ["pacienteId"])
    .index("by_legacyId", ["legacyId"]),

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
    .index("by_pacienteId_clinicId", ["pacienteId", "clinicId"]),

  // === CUMPLIMIENTO DIARIO ===
  dailyCompliance: defineTable({
    fecha: v.string(),
    pacienteId: v.id("users"),
    planId: v.id("plans"),
    ejerciciosEsperados: v.number(),
    ejerciciosCompletados: v.number(),
    esDiaDescanso: v.boolean(),
    dolorPromedio: v.optional(v.number()),
  })
    .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
    .index("by_pacienteId_planId_fecha", ["pacienteId", "planId", "fecha"]),

  // === NOTIFICACIONES FISIO ===
  physioNotifications: defineTable({
    tipo: v.union(v.literal("comentario"), v.literal("dolor_alto")),
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
    recordId: v.optional(v.id("planRecords")),
    sessionId: v.optional(v.id("sessions")),
    fechaRegistro: v.string(),
    tituloPlan: v.optional(v.string()),
    nombreEjercicio: v.optional(v.string()),
    texto: v.optional(v.string()),
    dolorEscala: v.optional(v.number()),
    revisada: v.boolean(),
    fechaRevision: v.optional(v.string()),
    pacienteNombre: v.optional(v.string()),
  })
    .index("by_clinicId_revisada", ["clinicId", "revisada"])
    .index("by_pacienteId", ["pacienteId"])
    .index("by_recordId", ["recordId"]),

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
