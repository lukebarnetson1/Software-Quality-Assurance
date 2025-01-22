require("../testSetup");
const request = require("supertest");
const app = require("../../app");

async function getCsrfToken(route = "/create") {
  const response = await request(app).get(route);
  const csrfTokenMatch = response.text.match(/name="_csrf" value="([^"]+)"/);
  if (!csrfTokenMatch) {
    throw new Error(`Failed to extract CSRF token from route: ${route}`);
  }
  const csrfToken = csrfTokenMatch[1];
  const cookie = response.headers["set-cookie"];
  return { csrfToken, cookie };
}

describe("App Initialisation", () => {
  test("should use URL-encoded middleware and return 404 for unknown POST route", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/")
      .type("form")
      .set("Cookie", cookie)
      .send({ key: "value", _csrf: csrfToken });

    expect(response.status).toBe(404);
  });

  test("should serve static files (return 200 if file exists)", async () => {
    const response = await request(app).get("/css/styles.css");
    expect(response.status).toBe(200);
  });

  test("should use JSON middleware and return 404 for unknown POST route", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Cookie", cookie)
      .send({ key: "value", _csrf: csrfToken });

    expect(response.status).toBe(404);
  });

  test("should return 404 for an unknown GET route", async () => {
    const response = await request(app).get("/unknown");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Cannot GET");
  });

  test("should bind routes correctly (GET / returns 200)", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
  });
});
