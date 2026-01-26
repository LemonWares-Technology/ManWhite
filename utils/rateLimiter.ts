import NodeCache from "node-cache";

// Cache for storing search results (TTL: 5 minutes)
const searchCache = new NodeCache({ stdTTL: 300 });

// Rate limiter cache (TTL: 1 minute)
const rateLimitCache = new NodeCache({ stdTTL: 60 });

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export class AmadeusRateLimiter {
  private maxRequestsPerMinute: number;
  private maxRequestsPerHour: number;

  constructor(maxPerMinute = 10, maxPerHour = 100) {
    this.maxRequestsPerMinute = maxPerMinute;
    this.maxRequestsPerHour = maxPerHour;
  }

  // Check if request is allowed
  canMakeRequest(identifier: string = "global"): boolean {
    const minuteKey = `minute_${identifier}`;
    const hourKey = `hour_${identifier}`;

    const minuteData: RateLimitInfo = rateLimitCache.get(minuteKey) || {
      count: 0,
      resetTime: Date.now() + 60000,
    };
    const hourData: RateLimitInfo = rateLimitCache.get(hourKey) || {
      count: 0,
      resetTime: Date.now() + 3600000,
    };

    // Check if we've exceeded limits
    if (
      minuteData.count >= this.maxRequestsPerMinute ||
      hourData.count >= this.maxRequestsPerHour
    ) {
      return false;
    }

    // Increment counters
    minuteData.count++;
    hourData.count++;

    // Update cache
    rateLimitCache.set(minuteKey, minuteData, 60);
    rateLimitCache.set(hourKey, hourData, 3600);

    return true;
  }

  // Get time until next allowed request
  getRetryAfter(identifier: string = "global"): number {
    const minuteKey = `minute_${identifier}`;
    const minuteData: RateLimitInfo | undefined = rateLimitCache.get(minuteKey);

    if (minuteData && minuteData.count >= this.maxRequestsPerMinute) {
      return Math.ceil((minuteData.resetTime - Date.now()) / 1000);
    }

    return 0;
  }

  // Reset rate limit for identifier
  reset(identifier: string = "global"): void {
    rateLimitCache.del(`minute_${identifier}`);
    rateLimitCache.del(`hour_${identifier}`);
  }
}

// Search result caching
export class SearchCache {
  // Generate cache key from search parameters
  static generateKey(params: any): string {
    const { keyword, origin, destination, departureDate, adults, currency } =
      params;
    return `search_${keyword || ""}${origin || ""}${destination || ""}${departureDate || ""}${adults || ""}${currency || ""}`;
  }

  // Get cached result
  static get(key: string): any {
    return searchCache.get(key);
  }

  // Set cached result
  static set(key: string, data: any, ttl: number = 300): void {
    searchCache.set(key, data, ttl);
  }

  // Check if key exists
  static has(key: string): boolean {
    return searchCache.has(key);
  }

  // Clear all cache
  static clear(): void {
    searchCache.flushAll();
  }
}

// Export singleton instances
export const amadeusRateLimiter = new AmadeusRateLimiter(25, 200); // Further increased limits for FlexibleDates feature (7 requests + main search)
export { searchCache };
