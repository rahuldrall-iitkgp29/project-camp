import crypto from "node:crypto";
import { ApiError } from "../utils/apiError.js";

// Per-process bounded limiter. Multi-instance deployments also need gateway limits.
export const createRateLimiter = ({ limit = 100, windowMs = 15 * 60 * 1000, maxKeys = 10000, now = Date.now } = {}) => {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const route = req.path.split("/")[1].toLowerCase();
    const keys = [`ip:${req.ip}:${route}`];
    if (typeof req.body?.email === "string") {
      keys.push(`account:${route}:${crypto.createHash("sha256").update(req.body.email.trim().toLowerCase()).digest("hex")}`);
    }
    for (const key of keys) {
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= maxKeys) {
          res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
          return next(new ApiError(429, "Too many requests; try again later"));
        }
        bucket = { count: 0, expires: time + windowMs };
        buckets.set(key, bucket);
      }
      if (++bucket.count > limit) {
        res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.expires - time) / 1000)));
        return next(new ApiError(429, "Too many requests; try again later"));
      }
    }
    next();
  };
};
