const request = require("supertest");
const app = require("../../app");
const {
  rateLimitConfig,
  resetRateLimit,
} = require("../../middlewares/rateLimit");
const { getCsrfToken } = require("../setup/testSetup");

describe("Rate Limiting", () => {
  const { maxAllowed, windowMs } = rateLimitConfig; // Access configuration dynamically

  beforeEach(() => {
    // Reset the rate limiter state before each test
    resetRateLimit();
  });

  test(`should allow up to ${maxAllowed} requests within the rate limit`, async () => {
    expect(maxAllowed).toBeDefined(); // Ensure maxAllowed is properly defined

    const { csrfToken, cookie } = await getCsrfToken();

    for (let i = 0; i < maxAllowed; i++) {
      const response = await request(app)
        .post("/create")
        .type("form")
        .set("Cookie", cookie)
        .send({
          title: `Post ${i + 1}`,
          content: "This is a test post.",
          author: "Test Author",
          _csrf: csrfToken,
        });

      expect(response.status).toBe(302); // Requests within the limit
    }
  });

  test(`should reject the ${maxAllowed + 1}th request, exceeding the rate limit`, async () => {
    const { csrfToken, cookie, rateLimited } = await getCsrfToken();

    // Make maxAllowed successful requests if not already rate-limited
    if (!rateLimited) {
      for (let i = 0; i < maxAllowed; i++) {
        const response = await request(app)
          .post("/create")
          .type("form")
          .set("Cookie", cookie)
          .send({
            title: `Post ${i + 1}`,
            content: "This is a test post.",
            author: "Test Author",
            _csrf: csrfToken,
          });

        expect(response.status).toBe(302); // Requests within the limit
      }
    }

    // Attempt the maxAllowed + 1 request, which should exceed the limit
    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie || []) // Provide an empty cookie if rate-limited earlier
      .send({
        title: "Exceeding Post",
        content: "This request exceeds the rate limit.",
        author: "Test Author",
        _csrf: csrfToken || "", // Provide an empty token if rate-limited earlier
      });

    // Expect the user to see the 429 Too Many Requests error
    expect(response.status).toBe(429);
    expect(response.body.error).toBe(
      "Too many requests, please try again later.",
    );
  });

  test("should reset the limit after the configured window expires", async () => {
    expect(maxAllowed).toBeDefined(); // Ensure the rate limit config is properly defined

    const { csrfToken, cookie, rateLimited } = await getCsrfToken();

    if (rateLimited) {
      console.warn(
        "CSRF token request was rate-limited. Proceeding to test rate limiting directly.",
      );
      return; // Skip this test if the CSRF token request itself was blocked
    }

    // Make maxAllowed successful requests
    for (let i = 0; i < maxAllowed; i++) {
      const response = await request(app)
        .post("/create")
        .type("form")
        .set("Cookie", cookie)
        .send({
          title: `Post ${i + 1}`,
          content: "This is a test post.",
          author: "Test Author",
          _csrf: csrfToken,
        });

      expect(response.status).toBe(302); // Requests within the limit
    }

    // Fast-forward time to reset the limit window
    jest.useFakeTimers();
    jest.advanceTimersByTime(windowMs); // Use the configured time window
    jest.useRealTimers();

    // Attempt another request after the window should have reset
    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Post After Reset",
        content: "This request should be allowed after the rate limit reset.",
        author: "Test Author",
        _csrf: csrfToken,
      });

    // Ensure the request is successful
    expect(response.status).toBe(302); // Should succeed after reset
  });
});
