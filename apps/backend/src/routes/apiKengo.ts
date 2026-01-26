import { Router } from "express";
import { usuarioController } from "../controllers/usuario";
import { pdfController } from "../controllers/pdf";
import { registroController } from "../controllers/registro";
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

export default router;
