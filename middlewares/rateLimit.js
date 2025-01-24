const rateLimit = require("express-rate-limit");

// Rate limiter configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // The `max`th request will be rate limited
  get maxAllowed() {
    return this.max - 1; // Dynamically compute maxAllowed
  },
  message: {
    status: 429,
    error: "Too many requests, please try again later.",
  },
};

// Create a memory store for the rate limiter
const memoryStore = new rateLimit.MemoryStore();

// Create the rate limiter middleware using the configuration
const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  store: memoryStore,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitConfig.message,
});

// Expose the middleware and configuration
module.exports = {
  apiLimiter,
  rateLimitConfig, // Export the configuration for global use
  resetRateLimit: () => memoryStore.resetKey("*"), // Reset memory store for testing
};
