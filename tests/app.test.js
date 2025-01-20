const request = require("supertest");
const app = require("../app");
const { sequelize, BlogPost } = require("../models");

let server;

beforeAll(async () => {
  await sequelize.sync({ force: true }); // Reset the database schema before tests
  server = app.listen(); // Create a server instance for testing
});

afterAll(async () => {
  await sequelize.close(); // Close the database connection after tests
  server.close(); // Close the server after tests
});

beforeEach(async () => {
  await BlogPost.destroy({ where: {} }); // Clear the database before each test
});

describe("Blog API", () => {
  describe("Rendering Routes", () => {
    test("GET / should render the index view with blog posts", async () => {
      const post = await BlogPost.create({
        title: "First Post",
        content: "This is the first post.",
        author: "Author1",
      });

      const response = await request(server).get("/");
      expect(response.status).toBe(200);
      expect(response.text).toContain(post.title);
      expect(response.text).toContain(post.author);
      expect(response.text).toContain("Blog Posts");
    });

    test("GET /create should render the create post view", async () => {
      const response = await request(server).get("/create");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Create Post");
    });

    test("GET /edit/:id should render the edit view for a specific post", async () => {
      const post = await BlogPost.create({
        title: "Editable Post",
        content: "Content to edit",
        author: "Author2",
      });

      const response = await request(server).get(`/edit/${post.id}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain(post.title);
      expect(response.text).toContain(post.content);
    });

    test("GET / should render empty state when no posts exist", async () => {
      const response = await request(server).get("/");
      expect(response.status).toBe(200);
      expect(response.text).toContain("No posts available");
    });
  });

  describe("CRUD Operations", () => {
    test("POST /create should create a new blog post", async () => {
      const response = await request(server).post("/create").send({
        title: "New Post",
        content: "This is a new blog post.",
        author: "New Author",
      });

      expect(response.status).toBe(302); // Redirect after creation

      const post = await BlogPost.findOne({ where: { title: "New Post" } });
      expect(post).not.toBeNull();
      expect(post.content).toBe("This is a new blog post.");
      expect(post.author).toBe("New Author");
    });

    test("POST /edit/:id should update a blog post", async () => {
      const post = await BlogPost.create({
        title: "Old Title",
        content: "Old content",
        author: "Author4",
      });

      const response = await request(server).post(`/edit/${post.id}`).send({
        title: "Updated Title",
        content: "Updated content",
      });

      expect(response.status).toBe(302); // Redirect after editing

      const updatedPost = await BlogPost.findByPk(post.id);
      expect(updatedPost.title).toBe("Updated Title");
      expect(updatedPost.content).toBe("Updated content");
    });

    test("POST /delete/:id should delete a blog post", async () => {
      const post = await BlogPost.create({
        title: "Post to Delete",
        content: "This post will be deleted.",
        author: "Author5",
      });

      const response = await request(server).post(`/delete/${post.id}`);
      expect(response.status).toBe(302); // Redirect after deletion

      const deletedPost = await BlogPost.findByPk(post.id);
      expect(deletedPost).toBeNull();
    });
  });

  describe("Statistics Route", () => {
    test("GET /stats should calculate statistics correctly", async () => {
      await BlogPost.create({
        title: "Short",
        content: "123",
        author: "Author1",
      });
      await BlogPost.create({
        title: "Longer Title",
        content: "12345",
        author: "Author2",
      });
      await BlogPost.create({
        title: "Another Title",
        content: "4567890",
        author: "Author3",
      });

      const response = await request(server).get("/stats");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Average: 5 characters");
      expect(response.text).toContain("Median: 5 characters");
      expect(response.text).toContain("Maximum: 7 characters");
      expect(response.text).toContain("Minimum: 3 characters");
    });

    test("GET /stats should handle empty database gracefully", async () => {
      const response = await request(server).get("/stats");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Average: 0 characters");
      expect(response.text).toContain("Median: 0 characters");
      expect(response.text).toContain("Maximum: 0 characters");
      expect(response.text).toContain("Minimum: 0 characters");
    });
  });
});

describe("Error Cases", () => {
  test("GET /post/:id should return 404 for non-existent post", async () => {
    const response = await request(server).get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("POST /edit/:id should return 404 for non-existent post", async () => {
    const response = await request(server)
      .post("/edit/9999")
      .send({ title: "Updated Title", content: "Updated Content" });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("POST /create should return 400 for invalid data", async () => {
    const response = await request(server)
      .post("/create")
      .send({ title: "", content: "", author: "" });

    expect(response.status).toBe(400);
    expect(response.text).toContain("All fields are required");
  });

  test("POST /create should return 500 for server error", async () => {
    jest.spyOn(BlogPost, "create").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const response = await request(server).post("/create").send({
      title: "Fail Post",
      content: "This will fail",
      author: "Error Author",
    });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal Server Error");

    BlogPost.create.mockRestore();
  });
});
