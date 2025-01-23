const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const { getCsrfToken } = require("../setup/testSetup");

describe("Blog API - Error Cases", () => {
  test("GET /post/:id should return 404 for non-existent post", async () => {
    const response = await request(app).get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("POST /edit/:id should return 404 for non-existent post", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/edit/9999")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Updated Title",
        content: "Updated Content",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("should return 500 if BlogPost.create throws an error", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    jest.spyOn(BlogPost, "create").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Test Post",
        content: "Content",
        author: "Author",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal Server Error");

    BlogPost.create.mockRestore();
  });

  test("POST /create should return 400 for invalid data", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "",
        content: "",
        author: "",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);

    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title is required" },
        { msg: "Content is required" },
        { msg: "Author is required" },
      ]),
    );
  });

  test("POST /delete/:id should return 404 if post does not exist", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/delete/9999")
      .type("form")
      .set("Cookie", cookie)
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

    const response = await request(app).get(`/post/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
    expect(response.text).toContain(post.author);
  });

  test("should return 404 if the post does not exist", async () => {
    const response = await request(app).get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("GET /edit/:id should return 200 and render the edit view if the post exists", async () => {
    const post = await BlogPost.create({
      title: "Editable Post",
      content: "Editable Content",
      author: "Author",
    });

    const response = await request(app).get(`/edit/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain("Edit Post");
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
  });

  test("GET /edit/:id should return 404 if the post does not exist", async () => {
    const response = await request(app).get("/edit/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });
});
