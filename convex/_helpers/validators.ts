import { v } from "convex/values";

export const diaSemana = v.union(
  v.literal("L"),
  v.literal("M"),
  v.literal("X"),
  v.literal("J"),
  v.literal("V"),
  v.literal("S"),
  v.literal("D"),
);

export const estadoPlan = v.union(
  v.literal("borrador"),
  v.literal("activo"),
  v.literal("completado"),
  v.literal("cancelado"),
);

export const tipoCodigo = v.union(
  v.literal("fisioterapeuta"),
  v.literal("paciente"),
);

export const visibilidadRutina = v.union(
  v.literal("privado"),
  v.literal("clinica"),
);

