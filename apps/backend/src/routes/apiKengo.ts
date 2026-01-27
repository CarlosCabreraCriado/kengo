import { Router } from "express";
import { usuarioController } from "../controllers/usuario";
import { pdfController } from "../controllers/pdf";
import { registroController } from "../controllers/registro";
import { clinicaController } from "../controllers/clinica";
import { tokenAccesoController } from "../controllers/tokenAcceso";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Registro de usuarios (no requiere auth)
router.post("/registro", registroController.registrar);

router.post("/getUsuarioById", usuarioController.getUsuarioById);

// Tokens de acceso (reemplaza magic links)
router.post("/usuario/token-acceso", authMiddleware, tokenAccesoController.crearToken);
router.post("/auth/token-acceso", tokenAccesoController.consumirToken);
router.get("/usuario/:id/tokens-acceso", authMiddleware, tokenAccesoController.listarTokens);
router.delete("/usuario/token-acceso/:id", authMiddleware, tokenAccesoController.revocarToken);
router.post("/usuario/:id/token-acceso/enviar-email", authMiddleware, tokenAccesoController.enviarPorEmail);

//PDF:
router.get("/plan/:id/pdf", authMiddleware, pdfController.generarPlanPDF);

// Clínicas (requiere auth)
router.post("/clinica/vincular", authMiddleware, clinicaController.vincularUsuarioClinica);
router.post("/clinica/crear", authMiddleware, clinicaController.crearClinica);
router.post("/clinica/codigo/generar", authMiddleware, clinicaController.generarCodigo);
router.get("/clinica/:id/codigos", authMiddleware, clinicaController.listarCodigos);
router.patch("/clinica/codigo/:id/desactivar", authMiddleware, clinicaController.desactivarCodigoAcceso);
router.patch("/clinica/codigo/:id/reactivar", authMiddleware, clinicaController.reactivarCodigoAcceso);

export default router;
