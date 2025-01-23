const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const { getCsrfToken } = require("../setup/testSetup");

describe("Input Validation and Sanitisation", () => {
  test("POST /create should reject missing required fields", async () => {
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

    // Normalise errors
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

  test("POST /create should sanitise malicious input in content", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const maliciousContent = "<script>alert('Hacked!')</script>";
    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Test Title",
        content: maliciousContent,
        author: "Test Author",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const post = await BlogPost.findOne({ where: { title: "Test Title" } });
    expect(post).not.toBeNull();
    expect(post.content).not.toContain("<script>");
    expect(post.content).not.toContain("alert");
  });

  test("POST /create should sanitise malicious input in author", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const maliciousAuthor = "<script>alert('Hacked!')</script>";
    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Valid Title",
        content: "Valid Content",
        author: maliciousAuthor,
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const post = await BlogPost.findOne({
      where: { content: "Valid Content" },
    });
    expect(post).not.toBeNull();
    expect(post.author).not.toContain("<script>");
    expect(post.author).not.toContain("alert");
  });

  test("POST /edit/:id should reject invalid input", async () => {
    const { csrfToken, cookie } = await getCsrfToken();
    const post = await BlogPost.create({
      title: "Initial Title",
      content: "Initial Content",
      author: "Author",
    });

    const response = await request(app)
      .post(`/edit/${post.id}`)
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "",
        content: "",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);

    // Normalise errors
    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title must not be empty" },
        { msg: "Content must not be empty" },
      ]),
    );
  });

  test("POST /edit/:id should sanitise malicious input in title", async () => {
    const { csrfToken, cookie } = await getCsrfToken();
    const post = await BlogPost.create({
      title: "Original Post",
      content: "Original Content",
      author: "Author",
    });

    const maliciousInput = "<script>alert('Hacked!')</script>";
    const response = await request(app)
      .post(`/edit/${post.id}`)
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: maliciousInput,
        content: "Updated Content",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).not.toContain("<script>");
    expect(updatedPost.title).not.toContain("alert");
    expect(updatedPost.content).toBe("Updated Content");
  });

  test("POST /create should enforce length limits on fields", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "a".repeat(101),
        content: "Valid Content",
        author: "b".repeat(101),
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);

    // Normalise errors
    const normalisedErrors = response.body.errors.map((error) => ({
      msg: error.msg,
    }));

    expect(normalisedErrors).toEqual(
      expect.arrayContaining([
        { msg: "Title must be less than 100 characters" },
        { msg: "Author name must be less than 100 characters" },
      ]),
    );
  });
});
