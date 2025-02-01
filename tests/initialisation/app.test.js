const request = require("supertest");
const app = require("../../app");
const { getCsrfToken } = require("../setup/testSetup");
const { loginUser } = require("../setup/testSetup");

describe("App Initialisation", () => {
  test("should use URL-encoded middleware and return 404 for unknown POST route", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await request(app)
      .post("/")
      .type("form")
      .set("Cookie", cookie)
      .send({ key: "value", _csrf: csrfToken });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Cannot POST /");
  });

  test("should serve static files (return 200 if file exists)", async () => {
    const response = await request(app).get("/css/styles.css");
    expect(response.status).toBe(200);
    // Verify content type
    expect(response.headers["content-type"]).toMatch(/text\/css/);
  });

  test("should use JSON middleware and return 404 for unknown POST route", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Cookie", cookie)
      .send({ key: "value", _csrf: csrfToken });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Cannot POST /");
  });

  test("should return 404 for an unknown GET route", async () => {
    const response = await request(app).get("/unknown");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Cannot GET /unknown");
  });

  test("should bind routes correctly (GET / returns 200)", async () => {
    // If GET / is protected, ensure to log in first
    const agent = request.agent(app);
    await loginUser(agent);

    const response = await agent.get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Blog Posts"); // Adjust based on actual content
  });
});
