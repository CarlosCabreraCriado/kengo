import db from "../utils/database";

export default class Usuarios {
  constructor() {}

  static getUsuarioById(idUsuario: number) {
    return db.execute("SELECT * FROM usuario WHERE id_usuario = ?", [
      idUsuario,
    ]);
  }
}
