require("../testSetup");
const request = require("supertest");
const app = require("../../app");

let server;

beforeAll(() => {
  server = app.listen();
});

afterAll(() => {
  server.close();
});

describe("CSRF Protection", () => {
  test("GET /create should provide a CSRF token", async () => {
    const response = await request(server).get("/create");
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/name="_csrf"/);
  });

  test("POST /create without CSRF token should be rejected", async () => {
    // Send as form data
    const response = await request(server).post("/create").type("form").send({
      title: "Test Title",
      content: "Test Content",
      author: "Test Author",
    });
    expect(response.status).toBe(403);
  });

  test("POST /create with CSRF token should succeed", async () => {
    const getResponse = await request(server).get("/create");
    // Extract token using our regex
    const csrfToken = getResponse.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const postResponse = await request(server)
      .post("/create")
      .type("form")
      .set("Cookie", getResponse.headers["set-cookie"])
      .send({
        title: "Test Title",
        content: "Test Content",
        author: "Test Author",
        _csrf: csrfToken,
      });

    expect(postResponse.status).toBe(302);
  });
});
