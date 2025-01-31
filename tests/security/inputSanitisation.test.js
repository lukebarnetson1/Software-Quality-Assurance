const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const {
  getAuthenticatedCsrfToken,
  loginUser,
  getTestUser,
} = require("../setup/testSetup");

describe("Input Validation and Sanitisation", () => {
  let agent;
  let csrfToken;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginUser(agent); // Log in the test user
    csrfToken = await getAuthenticatedCsrfToken(agent, "/create"); // Fetch CSRF token from a protected route
  });

  test("POST /create should reject missing required fields", async () => {
    const response = await agent.post("/create").type("form").send({
      title: "",
      content: "",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(400);

    // Expect errors only for title and content.
    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title is required" },
        { msg: "Content is required" },
      ]),
    );
  });

  test("POST /create should sanitise malicious input in content", async () => {
    const maliciousContent = "<script>alert('Hacked!')</script>";
    const response = await agent.post("/create").type("form").send({
      title: "Test Title",
      content: maliciousContent,
      _csrf: csrfToken,
    });

    expect(response.status).toBe(302);

    const post = await BlogPost.findOne({ where: { title: "Test Title" } });
    expect(post).not.toBeNull();
    expect(post.content).not.toContain("<script>");
    expect(post.content).not.toContain("alert");
  });

  test("POST /edit/:id should reject invalid input", async () => {
    const post = await BlogPost.create({
      title: "Initial Title",
      content: "Initial Content",
      // Make sure the post belongs to the logged-in test user:
      author: getTestUser().username,
    });

    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: "",
      content: "",
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(400);

    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title is required" },
        { msg: "Content is required" },
      ]),
    );
  });

  test("POST /edit/:id should sanitise malicious input in title", async () => {
    const maliciousInput = "<script>alert('Hacked!')</script>";
    const post = await BlogPost.create({
      title: "Original Post",
      content: "Original Content",
      // Ensure the post’s author is the logged-in user:
      author: getTestUser().username,
    });

    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: maliciousInput,
      content: "Updated Content",
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(302);

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).not.toContain("<script>");
    expect(updatedPost.title).not.toContain("alert");
    expect(updatedPost.content).toBe("Updated Content");
  });

  test("POST /create should enforce length limits on fields", async () => {
    const response = await agent
      .post("/create")
      .type("form")
      .send({
        title: "a".repeat(101),
        content: "Valid Content",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);

    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title must be less than 100 characters" },
      ]),
    );
  });
});
