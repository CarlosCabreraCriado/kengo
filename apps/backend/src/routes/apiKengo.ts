import { Router } from "express";
import { usuarioController } from "../controllers/usuario";
import { pdfController } from "../controllers/pdf";
import { registroController } from "../controllers/registro";
import { clinicaController } from "../controllers/clinica";
import { tokenAccesoController } from "../controllers/tokenAcceso";
import { passwordResetController } from "../controllers/passwordReset";
import { emailVerificationController } from "../controllers/emailVerification";
import { sessionRefreshController } from "../controllers/sessionRefresh";
import { contactoController } from "../controllers/contacto";
import { authMiddleware } from "../middleware/auth";
import { actualizarPlanesExpirados } from "../jobs/planes-expirados";
import { calcularCumplimientoDiario, backfillCumplimiento, recalcularCumplimiento } from "../jobs/cumplimiento-diario";
import { cumplimientoController } from "../controllers/cumplimiento";

const router = Router();

// Contacto (no requiere auth)
router.post("/contacto", contactoController.enviarMensaje);

// Registro de usuarios (no requiere auth)
router.post("/registro", registroController.registrar);

// Refresh de sesion custom (no requiere auth - lee cookie directamente)
router.post("/auth/refrescar-sesion", sessionRefreshController.refrescarSesion);

// Recuperacion de contrasena (no requiere auth)
router.post("/auth/recuperar-password", passwordResetController.solicitarCodigo);
router.post("/auth/reset-password", passwordResetController.resetPassword);

// Establecer contrasena (requiere auth - para usuarios sin password)
router.post("/auth/establecer-password", authMiddleware, passwordResetController.establecerPassword);

// Verificacion de email (requiere auth)
router.post("/auth/enviar-verificacion", authMiddleware, emailVerificationController.enviarCodigo);
router.post("/auth/verificar-email", authMiddleware, emailVerificationController.verificarEmail);

router.post("/getUsuarioById", usuarioController.getUsuarioById);

// Tokens de acceso (reemplaza magic links)
router.post("/usuario/token-acceso", authMiddleware, tokenAccesoController.crearToken);
router.post("/auth/token-acceso", tokenAccesoController.consumirToken);
router.get("/usuario/:id/tokens-acceso", authMiddleware, tokenAccesoController.listarTokens);
router.delete("/usuario/token-acceso/:id", authMiddleware, tokenAccesoController.revocarToken);
router.post("/usuario/:id/token-acceso/enviar-email", authMiddleware, tokenAccesoController.enviarPorEmail);

//PDF:
router.get("/plan/:id/pdf", authMiddleware, pdfController.generarPlanPDF);
router.post("/plan/:id/pdf/enviar", authMiddleware, pdfController.enviarPlanPDF);

// Clínicas (requiere auth)
router.post("/clinica/vincular", authMiddleware, clinicaController.vincularUsuarioClinica);
router.post("/clinica/crear", authMiddleware, clinicaController.crearClinica);
router.post("/clinica/codigo/generar", authMiddleware, clinicaController.generarCodigo);
router.get("/clinica/:id/codigos", authMiddleware, clinicaController.listarCodigos);
router.patch("/clinica/codigo/:id/desactivar", authMiddleware, clinicaController.desactivarCodigoAcceso);
router.patch("/clinica/codigo/:id/reactivar", authMiddleware, clinicaController.reactivarCodigoAcceso);

// Cumplimiento
router.get("/paciente/:id/cumplimiento", authMiddleware, cumplimientoController.getCumplimiento);

// Jobs manuales
router.post("/jobs/planes-expirados", authMiddleware, async (_req, res) => {
  try {
    const actualizados = await actualizarPlanesExpirados();
    res.json({ ok: true, planesActualizados: actualizados });
  } catch (error) {
    console.error("Error ejecutando job de planes expirados:", error);
    res.status(500).json({ error: "Error actualizando planes expirados" });
  }
});

router.post("/jobs/cumplimiento-diario", authMiddleware, async (req, res) => {
  try {
    const { fecha } = req.body;
    const filas = await calcularCumplimientoDiario(fecha);
    res.json({ ok: true, fecha: fecha || "ayer", filasInsertadas: filas });
  } catch (error) {
    console.error("Error ejecutando job de cumplimiento diario:", error);
    res.status(500).json({ error: "Error calculando cumplimiento diario" });
  }
});

router.post("/jobs/cumplimiento-diario/backfill", authMiddleware, async (req, res) => {
  try {
    const { desde, hasta, paciente_id } = req.body;
    if (!desde) {
      res.status(400).json({ error: "Falta parámetro 'desde' (YYYY-MM-DD)" });
      return;
    }
    const resultado = await backfillCumplimiento(desde, hasta, paciente_id);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error ejecutando backfill:", error);
    res.status(500).json({ error: "Error en backfill de cumplimiento" });
  }
});

router.post("/jobs/cumplimiento-diario/recalcular", authMiddleware, async (req, res) => {
  try {
    const { desde, hasta, paciente_id } = req.body;
    if (!desde) {
      res.status(400).json({ error: "Falta parámetro 'desde' (YYYY-MM-DD)" });
      return;
    }
    const resultado = await recalcularCumplimiento(desde, hasta, paciente_id);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error ejecutando recalcular:", error);
    res.status(500).json({ error: "Error recalculando cumplimiento" });
  }
});

export default router;
