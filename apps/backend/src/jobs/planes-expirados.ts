import pool from "../utils/database";

export async function actualizarPlanesExpirados(): Promise<number> {
  try {
    const [result] = await pool.execute(
      `UPDATE Planes
       SET estado = 'completado', date_updated = NOW()
       WHERE estado = 'activo'
         AND fecha_fin IS NOT NULL
         AND fecha_fin < NOW()`
    );

    const affectedRows = (result as any).affectedRows || 0;
    console.log(`[planes-expirados] ${affectedRows} plan(es) actualizado(s) a 'completado'`);
    return affectedRows;
  } catch (error) {
    console.error("[planes-expirados] Error actualizando planes expirados:", error);
    throw error;
  }
}
