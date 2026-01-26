import { Router } from "express";
import { usuarioController } from "../controllers/usuario";
import { pdfController } from "../controllers/pdf";
import { registroController } from "../controllers/registro";
import { clinicaController } from "../controllers/clinica";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Registro de usuarios (no requiere auth)
router.post("/registro", registroController.registrar);

router.post("/getUsuarioById", usuarioController.getUsuarioById);

//Magic Link:
router.post("/crearMagicLink", usuarioController.crearMagicLink);
router.post("/consumirMagicLink", usuarioController.consumirMagicLink);

//PDF:
router.get("/plan/:id/pdf", authMiddleware, pdfController.generarPlanPDF);

// Clínicas (requiere auth)
router.post("/clinica/vincular", authMiddleware, clinicaController.vincularUsuarioClinica);
router.post("/clinica/crear", authMiddleware, clinicaController.crearClinica);
router.post("/clinica/codigo/generar", authMiddleware, clinicaController.generarCodigo);
router.get("/clinica/:id/codigos", authMiddleware, clinicaController.listarCodigos);
router.patch("/clinica/codigo/:id/desactivar", authMiddleware, clinicaController.desactivarCodigoAcceso);

export default router;
