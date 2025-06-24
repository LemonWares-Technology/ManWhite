import { User } from "./node_modules/.prisma/client/index.d";
import { Request } from "express";
import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      User?: {
        id: string;
        userId: string;
        role: string;
      };
    }
  }
}

// types/index.ts

export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    role?: string;
    [key: string]: any;
  } | null;
}
