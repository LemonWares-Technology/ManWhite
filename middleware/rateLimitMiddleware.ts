import { Request, Response, NextFunction } from "express";
import { amadeusRateLimiter } from "../utils/rateLimiter";
import { sendError } from "../utils/apiResponse";

export interface RateLimitedRequest extends Request {
  rateLimitInfo?: {
    remaining: number;
    resetTime: number;
  };
}

/**
 * Rate limiting middleware for Amadeus API endpoints
 */
export const rateLimitMiddleware = (identifier?: string) => {
  return (req: RateLimitedRequest, res: Response, next: NextFunction): void => {
    const clientId = identifier || req.ip || "global";

    if (!amadeusRateLimiter.canMakeRequest(clientId)) {
      const retryAfter = amadeusRateLimiter.getRetryAfter(clientId);

      // Set rate limit headers
      res.set({
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": new Date(
          Date.now() + retryAfter * 1000,
        ).toISOString(),
        "Retry-After": retryAfter.toString(),
      });

      sendError(res, "Rate limit exceeded. Please try again later.", 429, {
        retryAfter,
        message:
          "Too many requests to external API. Please wait before trying again.",
      });
      return;
    }

    next();
  };
};

/**
 * Specific rate limiter for location search endpoints
 */
export const locationSearchRateLimit = rateLimitMiddleware("location_search");

/**
 * Specific rate limiter for flight search endpoints
 */
export const flightSearchRateLimit = rateLimitMiddleware("flight_search");
