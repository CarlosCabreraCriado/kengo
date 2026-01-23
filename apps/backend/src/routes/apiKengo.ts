import { Router } from "express";
import { usuarioController } from "../controllers/usuario";
import { pdfController } from "../controllers/pdf";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/getUsuarioById", usuarioController.getUsuarioById);

//Magic Link:
router.post("/crearMagicLink", usuarioController.crearMagicLink);
router.post("/consumirMagicLink", usuarioController.consumirMagicLink);

//PDF:
router.get("/plan/:id/pdf", authMiddleware, pdfController.generarPlanPDF);

export default router;
