// tests/coreApp/crud.test.js

const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const { getAuthenticatedCsrfToken, loginUser } = require("../setup/testSetup");

describe("Blog API - CRUD Operations", () => {
  let agent;
  let csrfToken;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginUser(agent); // Log in the test user
    csrfToken = await getAuthenticatedCsrfToken(agent, "/create"); // Fetch CSRF token from a protected route
  });

  test("POST /create should create a new blog post", async () => {
    const response = await agent.post("/create").type("form").send({
      title: "New Post",
      content: "This is a new blog post.",
      author: "New Author",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(302); // Assuming a redirect on success

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

    // Fetch CSRF token for the edit route
    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: "Updated Title",
      content: "Updated content",
      author: "Author4",
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(302); // Assuming a redirect on success

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).toBe("Updated Title");
    expect(updatedPost.content).toBe("Updated content");
  });

  test("POST /delete/:id should delete an existing blog post and redirect", async () => {
    const post = await BlogPost.create({
      title: "Deletable Post",
      content: "This will be deleted",
      author: "Author Name",
    });

    // Fetch CSRF token for the delete route
    const deleteCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/delete/${post.id}`).type("form").send({
      _csrf: deleteCsrfToken,
    });

    expect(response.status).toBe(302); // Assuming a redirect on success

    const deletedPost = await BlogPost.findByPk(post.id);
    expect(deletedPost).toBeNull();
  });

  test("POST /edit/:id should not update if title or content is missing", async () => {
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: "Author4",
    });

    // Fetch CSRF token for the edit route
    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: "Updated Title",
      content: "", // Missing content
      author: "Updated Author", // Include 'author' field
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(400);

    const unchangedPost = await BlogPost.findByPk(post.id);
    expect(unchangedPost.title).toBe("Old Title");
    expect(unchangedPost.content).toBe("Old content");
    expect(unchangedPost.author).toBe("Author4");
  });
});
