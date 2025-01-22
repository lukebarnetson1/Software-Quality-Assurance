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

// Utility function to fetch CSRF token and session cookie
async function getCsrfToken(route = "/create") {
  const response = await request(server).get(route);
  const csrfTokenMatch = response.text.match(/name="_csrf" value="([^"]+)"/);
  if (!csrfTokenMatch) {
    throw new Error("Failed to extract CSRF token");
  }
  const csrfToken = csrfTokenMatch[1];
  const cookie = response.headers["set-cookie"];
  return { csrfToken, cookie };
}

describe("Blog API - Rendering Routes", () => {
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

describe("Blog API - CRUD Operations", () => {
  test("POST /create should create a new blog post", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(server)
      .post("/create")
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "New Post",
        content: "This is a new blog post.",
        author: "New Author",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const post = await BlogPost.findOne({ where: { title: "New Post" } });
    expect(post).not.toBeNull();
    expect(post.content).toBe("This is a new blog post.");
    expect(post.author).toBe("New Author");
  });

  test("POST /edit/:id should update a blog post", async () => {
    const { csrfToken, cookie } = await getCsrfToken();
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: "Author4",
    });

    const response = await request(server)
      .post(`/edit/${post.id}`)
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Updated Title",
        content: "Updated content",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).toBe("Updated Title");
    expect(updatedPost.content).toBe("Updated content");
  });

  test("POST /delete/:id should delete an existing blog post and redirect", async () => {
    const { csrfToken, cookie } = await getCsrfToken();
    const post = await BlogPost.create({
      title: "Deletable Post",
      content: "This will be deleted",
      author: "Author Name",
    });

    const response = await request(server)
      .post(`/delete/${post.id}`)
      .type("form")
      .set("Cookie", cookie)
      .send({
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302);

    const deletedPost = await BlogPost.findByPk(post.id);
    expect(deletedPost).toBeNull();
  });

  test("POST /edit/:id should not update if title or content is missing", async () => {
    const { csrfToken, cookie } = await getCsrfToken();
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: "Author4",
    });

    const response = await request(server)
      .post(`/edit/${post.id}`)
      .type("form")
      .set("Cookie", cookie)
      .send({
        title: "Updated Title",
        content: "", // Missing content
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);

    const unchangedPost = await BlogPost.findByPk(post.id);
    expect(unchangedPost.title).toBe("Old Title");
    expect(unchangedPost.content).toBe("Old content");
  });
});

describe("Blog API - Statistics Route", () => {
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
    expect(response.text).toContain("Average Length: 5 characters");
    expect(response.text).toContain("Median Length: 5 characters");
    expect(response.text).toContain("Maximum Length: 7 characters");
    expect(response.text).toContain("Minimum Length: 3 characters");
  });

  test("GET /stats should handle empty database gracefully", async () => {
    const response = await request(server).get("/stats");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Average Length: 0 characters");
    expect(response.text).toContain("Median Length: 0 characters");
    expect(response.text).toContain("Maximum Length: 0 characters");
    expect(response.text).toContain("Minimum Length: 0 characters");
  });

  test("GET /stats should calculate median correctly for even number of posts", async () => {
    await BlogPost.create({
      title: "Post 1",
      content: "123",
      author: "Author1",
    });
    await BlogPost.create({
      title: "Post 2",
      content: "4567",
      author: "Author2",
    });
    await BlogPost.create({
      title: "Post 3",
      content: "89",
      author: "Author3",
    });
    await BlogPost.create({
      title: "Post 4",
      content: "101112",
      author: "Author4",
    });

    const response = await request(server).get("/stats");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Median Length: 4 characters"); // (3+5)/2 = 4
  });
});

describe("Blog API - Error Cases", () => {
  test("GET /post/:id should return 404 for non-existent post", async () => {
    const response = await request(server).get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("POST /edit/:id should return 404 for non-existent post", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(server)
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

    const response = await request(server)
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

    const response = await request(server)
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

  test("should return 404 if post does not exist", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(server)
      .post("/delete/9999")
      .type("form")
      .set("Cookie", cookie)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("should return 200 and render the post if it exists", async () => {
    const post = await BlogPost.create({
      title: "Sample Post",
      content: "Sample Content",
      author: "Author",
    });

    const response = await request(server).get(`/post/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
    expect(response.text).toContain(post.author);
  });

  test("should return 404 if the post does not exist", async () => {
    const response = await request(server).get("/post/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });

  test("should return 200 and render the edit view if the post exists", async () => {
    const post = await BlogPost.create({
      title: "Editable Post",
      content: "Editable Content",
      author: "Author",
    });

    const response = await request(server).get(`/edit/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain("Edit Post");
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
  });

  test("should return 404 if the post does not exist", async () => {
    const response = await request(server).get("/edit/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Post not found");
  });
});
