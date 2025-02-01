const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const {
  getAuthenticatedCsrfToken,
  loginUser,
  getTestUser,
} = require("../setup/testSetup");

describe("Blog API - Error Cases", () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginUser(agent); // Log in the test user
  });

  test("POST /edit/:id should redirect for non-existent post", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

    const response = await agent.post("/edit/9999").type("form").send({
      title: "Updated Title",
      content: "Updated Content",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/");
  });

  test("POST /edit/:id should return 404 for non-existent post", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

    // Since the edit route now flashes and redirects when the post is not found,
    // we expect a 302 redirect.
    const response = await agent.post("/edit/9999").type("form").send({
      title: "Updated Title",
      content: "Updated Content",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(302);
  });

  test("should return 500 if BlogPost.create throws an error", async () => {
    // Mock BlogPost.create to throw an error
    jest.spyOn(BlogPost, "create").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

    const response = await agent.post("/create").type("form").send({
      title: "Test Post",
      content: "Content",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal Server Error");

    // Restore the original implementation
    BlogPost.create.mockRestore();
  });

  test("POST /create should return 400 for invalid data", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

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

  test("POST /delete/:id should return 404 if post does not exist", async () => {
    const csrfToken = await getAuthenticatedCsrfToken(agent, "/create");

    const response = await agent
      .post("/delete/9999")
      .type("form")
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("GET /post/:id should return 200 and render the post if it exists", async () => {
    const post = await BlogPost.create({
      title: "Sample Post",
      content: "Sample Content",
      author: "Author",
    });

    const response = await agent.get(`/post/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
    expect(response.text).toContain(post.author);
  });

  test("should return 404 if the post does not exist", async () => {
    const response = await agent.get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("GET /edit/:id should return 200 and render the edit view if the post exists", async () => {
    const post = await BlogPost.create({
      title: "Editable Post",
      content: "Editable Content",
      // Use the logged‐in test user’s username so that the auth check passes:
      author: getTestUser().username,
    });

    const response = await agent.get(`/edit/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain("Edit Post");
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
  });

  test("GET /edit/:id should redirect if the post does not exist", async () => {
    const response = await agent.get("/edit/9999");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/");
  });
});
