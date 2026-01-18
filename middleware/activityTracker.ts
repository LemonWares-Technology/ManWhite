import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../types";

export const trackActivity: any = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.id) {
    // Fire and forget update to keep the request snappy
    prisma.user.update({
      where: { id: req.user.id },
      data: { lastActiveAt: new Date() }
    }).catch(err => console.error("Activity tracking error:", err));
  }
  next();
};
