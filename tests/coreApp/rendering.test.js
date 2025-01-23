require("../setup/testSetup");
const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");

describe("Blog API - Rendering Routes", () => {
  test("GET / should render the index view with blog posts", async () => {
    const post = await BlogPost.create({
      title: "First Post",
      content: "This is the first post.",
      author: "Author1",
    });

    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.author);
    expect(response.text).toContain("Blog Posts");
  });

  test("GET /create should render the create post view", async () => {
    const response = await request(app).get("/create");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Create Post");
  });

  test("GET /edit/:id should render the edit view for a specific post", async () => {
    const post = await BlogPost.create({
      title: "Editable Post",
      content: "Content to edit",
      author: "Author2",
    });

    const response = await request(app).get(`/edit/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(post.title);
    expect(response.text).toContain(post.content);
  });

  test("GET / should render empty state when no posts exist", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("No posts available");
  });
});
