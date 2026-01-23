import { Request, Response, NextFunction } from "express";
import "dotenv/config";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookies = req.headers.cookie;

  if (!cookies) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  try {
    // Validar sesión con Directus reenviando las cookies
    const response = await fetch(`${process.env.DIRECTUS_URL}/users/me`, {
      headers: {
        Cookie: cookies,
      },
    });

    if (!response.ok) {
      res.status(401).json({ error: "Sesión inválida" });
      return;
    }

    const { data: user } = await response.json();
    req.user = user;
    next();
  } catch (error) {
    console.error("Error en authMiddleware:", error);
    res.status(401).json({ error: "Error de autenticación" });
  }
}
