import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import cron from "node-cron";

import apiKengo from "./routes/apiKengo";
import { actualizarPlanesExpirados } from "./jobs/planes-expirados";
import { calcularCumplimientoDiario } from "./jobs/cumplimiento-diario";
import { generarNotificacionesComentarios } from "./jobs/notificaciones-fisio";

const app = express();
const PORT = parseInt(process.env.KENGO_PORT_API || '4201', 10);

// Cron job: auto-completar planes expirados (diario a las 00:05)
cron.schedule("5 0 * * *", async () => {
  console.log("[cron] Ejecutando job de planes expirados...");
  await actualizarPlanesExpirados();
});

// Cron job: calcular cumplimiento diario (diario a las 00:10, después de planes expirados)
cron.schedule("10 0 * * *", async () => {
  console.log("[cron] Calculando cumplimiento diario...");
  await calcularCumplimientoDiario();
});

// Cron job: generar notificaciones de comentarios (diario a las 00:15, después de cumplimiento)
cron.schedule("15 0 * * *", async () => {
  console.log("[cron] Generando notificaciones de comentarios...");
  await generarNotificacionesComentarios();
});

// CORS configurado para cookies
app.use(cors({
  origin: [
    'https://kengoapp.com',
    'https://www.kengoapp.com',
    'https://app.kengoapp.com',
    'https://admin.kengoapp.com',
    `http://localhost:${process.env.KENGO_PORT_APP || '4200'}`,
    'https://kengo.localhost'
  ],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.use("/", apiKengo);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
