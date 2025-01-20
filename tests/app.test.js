const request = require("supertest");
const app = require("../app");
const { sequelize, BlogPost } = require("../models");

let server;

beforeAll(async () => {
  await sequelize.sync({ force: true }); // Reset the database before tests
  server = app.listen(); // Create a server instance for testing
});

afterAll(async () => {
  await sequelize.close(); // Close the database connection after tests
  server.close(); // Close the server after tests
});

describe("Blog API", () => {
  test("GET / should return all blog posts", async () => {
    const post1 = await BlogPost.create({
      title: "First Post",
      content: "This is the content of the first post.",
      author: "Author1",
    });
    const post2 = await BlogPost.create({
      title: "Second Post",
      content: "This is the content of the second post.",
      author: "Author2",
    });

    const response = await request(server).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain(post1.title);
    expect(response.text).toContain(post2.title);
  });

  test("POST /create should create a new blog post", async () => {
    const response = await request(server)
      .post("/create")
      .send({
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

  test("GET /post/:id should return a single blog post", async () => {
    const post = await BlogPost.create({
      title: "Specific Post",
      content: "This is a specific blog post.",
      author: "Author3",
    });

    const response = await request(server).get(`/post/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
    expect(response.text).toContain(post.author);
  });

  test("POST /edit/:id should update a blog post", async () => {
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: "Author4",
    });

    const response = await request(server)
      .post(`/edit/${post.id}`)
      .send({
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
