import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

import apiKengo from "./routes/apiKengo";

const app = express();
const PORT = 3000;

// CORS configurado para cookies
app.use(cors({
  origin: [
    'https://kengoapp.com',
    'https://www.kengoapp.com',
    'https://app.kengoapp.com',
    'https://admin.kengoapp.com',
    'http://localhost:4200'
  ],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.use("/", apiKengo);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
