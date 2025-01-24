const request = require("supertest");
const app = require("../../app");
const { getCsrfToken } = require("../setup/testSetup");

describe("Rate Limiting", () => {
  test("should allow requests under the rate limit", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    for (let i = 0; i < 100; i++) {
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

      expect(response.status).toBe(302); // Expecting a redirect for successful post creation
    }
  });

  test("should reject requests exceeding the rate limit", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    // Make 100 allowed requests
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post("/create")
        .type("form")
        .set("Cookie", cookie)
        .send({
          title: `Post ${i + 1}`,
          content: "This is a test post.",
          author: "Test Author",
          _csrf: csrfToken,
        });
    }

    // 101st request should be rejected
    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Post 101",
        content: "This is a test post.",
        author: "Test Author",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(429); // Too many requests
    expect(response.body.error).toBe(
      "Too many requests, please try again later.",
    );
  });

  test("should reset the limit after the time window expires", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    // Make 100 allowed requests
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post("/create")
        .type("form")
        .set("Cookie", cookie)
        .send({
          title: `Post ${i + 1}`,
          content: "This is a test post.",
          author: "Test Author",
          _csrf: csrfToken,
        });
    }

    // Wait for the rate limit window to reset (15 minutes)
    jest.useFakeTimers();
    jest.advanceTimersByTime(15 * 60 * 1000);

    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Post after reset",
        content: "This is a test post after the rate limit reset.",
        author: "Test Author",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Request should succeed after the limit reset
    jest.useRealTimers();
  });
});
