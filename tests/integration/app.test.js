require("../testSetup");
const request = require("supertest");
const app = require("../../app");

describe("App Initialisation", () => {
  test("should use URL-encoded middleware and return 404 for unknown POST route", async () => {
    const response = await request(app).post("/").send("key=value");
    expect(response.status).toBe(404);
  });

  test("should serve static files (return 200 if file exists)", async () => {
    const response = await request(app).get("/css/styles.css");
    expect(response.status).toBe(200);
  });

  test("should use JSON middleware and return 404 for unknown POST route", async () => {
    const response = await request(app)
      .post("/")
      .send({ key: "value" })
      .set("Content-Type", "application/json");
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
