import { User } from "./node_modules/.prisma/client/index.d";
import { Request } from "express";
import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      User?: {
        userId: string;
        role: string;
      };
    }
  }
}
