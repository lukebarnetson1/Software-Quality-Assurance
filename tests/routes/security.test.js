require("../testSetup");
const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");

let server;

beforeAll(async () => {
  server = app.listen(); // Create a server instance for testing
});

afterAll(async () => {
  server.close(); // Close the server after tests
});

beforeEach(async () => {
  await BlogPost.destroy({ where: {} }); // Clear the database before each test
});

describe("Input Validation and Sanitisation", () => {
  test("POST /create should reject missing required fields", async () => {
    const response = await request(server).post("/create").send({
      title: "",
      content: "",
      author: "",
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

  test("POST /create should sanitise malicious content", async () => {
    const maliciousContent = "<script>alert('Hacked!')</script>";
    const response = await request(server).post("/create").send({
      title: "Test Title",
      content: maliciousContent,
      author: "Test Author",
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
      author: "Author",
    });

    const response = await request(server).post(`/edit/${post.id}`).send({
      title: "",
      content: "",
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

  test("POST /edit/:id should sanitise malicious input", async () => {
    const post = await BlogPost.create({
      title: "Original Post",
      content: "Original Content",
      author: "Author",
    });

    const maliciousInput = "<script>alert('Hacked!')</script>";
    const response = await request(server).post(`/edit/${post.id}`).send({
      title: "Updated Title",
      content: maliciousInput,
    });

    expect(response.status).toBe(302);

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).toBe("Updated Title");
    expect(updatedPost.content).not.toContain("<script>");
    expect(updatedPost.content).not.toContain("alert");
  });

  test("POST /create should enforce length limits on fields", async () => {
    const response = await request(server)
      .post("/create")
      .send({
        title: "a".repeat(101), // Exceeds 100-character limit
        content: "Valid Content",
        author: "b".repeat(101), // Exceeds 100-character limit
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
