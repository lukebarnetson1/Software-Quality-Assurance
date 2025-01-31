const request = require("supertest");
const app = require("../../app");
const {
  getAuthenticatedCsrfToken,
  loginUser,
  getCsrfToken,
} = require("../setup/testSetup");

describe("CSRF Protection", () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginUser(agent); // Log in the test user
  });

  test("GET /create should provide a CSRF token (Authenticated)", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");
    expect(csrfToken).toBeDefined();
  });

  test("POST /create without CSRF token should be rejected (Authenticated)", async () => {
    // Attempt to create a post without CSRF token
    const response = await agent.post("/create").type("form").send({
      title: "Test Title",
      content: "Test Content",
      author: "Test Author",
      // _csrf is omitted
    });
    expect(response.status).toBe(403);
    expect(response.text).toContain("Invalid CSRF token or session expired.");
  });

  test("POST /create with CSRF token should succeed (Authenticated)", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

    const postResponse = await agent.post("/create").type("form").send({
      title: "Test Title",
      content: "Test Content",
      author: "Test Author",
      _csrf: csrfToken,
    });

    expect(postResponse.status).toBe(302);
    expect(postResponse.headers.location).toBe("/"); // Assuming redirect to home after creation
  });

  test("GET /auth/login should provide a CSRF token (Unauthenticated)", async () => {
    const { csrfToken } = await getCsrfToken("/auth/login");
    expect(csrfToken).toBeDefined();
  });

  test("POST /auth/login without CSRF token should be rejected (Unauthenticated)", async () => {
    const response = await request(app).post("/auth/login").type("form").send({
      identifier: "testuser@example.com",
      password: "testpassword",
      // _csrf is omitted
    });
    expect(response.status).toBe(403);
    expect(response.text).toContain("Invalid CSRF token or session expired.");
  });

  test("POST /auth/login with CSRF token should succeed (Unauthenticated)", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await request(app)
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        identifier: "testuser@example.com",
        password: "testpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expecting redirect on successful login
    expect(response.headers.location).toBe("/auth/login");
  });
});
