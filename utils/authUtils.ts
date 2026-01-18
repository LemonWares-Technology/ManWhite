import jwt from "jsonwebtoken";
import { Response } from "express";

export const generateTokens = (user: any) => {
  const payload = {
    id: user.id || user.userId,
    userId: user.id || user.userId, // Include both for compatibility
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT as string,
    { expiresIn: "4h" }
  );

  const refreshToken = jwt.sign(
    { id: user.id || user.userId },
    (process.env.JWT_REFRESH_SECRET || process.env.JWT) as string,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export const setTokenCookies = (res: Response, accessToken: string, refreshToken?: string) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
  });

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};
