import { Request, Response, NextFunction } from "express";
import jwt, { decode } from "jsonwebtoken";
import env from "dotenv";
import { AuthenticatedRequest } from "../types";
env.config();

const JWT_SECRET = process.env.JWT || "code";

interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken: any = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT as string);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: `Authorization header missing or invalid` });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };

    if (!decode || decoded.role !== "ADMIN") {
      return res.status(401).json({ error: `Forbidden: Admins only` });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error(`Admin authentication error: ${error}`);

    return res.status(401).json({
      error: `Invalid or expired token`,
    });
  }
}

// export const optionalAuthentication = (
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   const authHeader = req.headers["authorization"];
//   const token = authHeader && authHeader.split(" ")[1];

//   // If no token provided, continue without authentication (guest user)
//   if (!token) {
//     req.user = null;
//     return next();
//   }

//   try {
//     // If token is provided, verify it
//     const decoded = jwt.verify(token, process.env.JWT as string) as any;
//     req.user = decoded;
//     next();
//   } catch (error) {
//     // If token is invalid, treat as guest user instead of throwing error
//     console.warn("Invalid token provided, treating as guest user:", error);
//     req.user = null;
//     next();
//   }
// };

export const optionalAuthentication = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // If no token provided, continue without authentication (guest user)
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // If token is provided, verify it
    const decoded = jwt.verify(token, process.env.JWT as string) as any;
    req.user = decoded;
    next();
  } catch (error) {
    // If token is invalid, treat as guest user instead of throwing error
    console.warn("Invalid token provided, treating as guest user:", error);
    req.user = null;
    next();
  }
};
