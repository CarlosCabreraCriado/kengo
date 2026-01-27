import { Request, Response } from "express";
import Usuarios from "../models/usuarios";
import "dotenv/config";

export class usuarioController {
  static async getUsuarioById(req: Request, res: Response) {
    const idSolicitado = req.body.id_usuario;
    const usuario = await Usuarios.getUsuarioById(idSolicitado);
    res.send(usuario[0]);
  }
}
