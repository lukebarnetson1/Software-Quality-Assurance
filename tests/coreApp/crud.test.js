const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const {
  getAuthenticatedCsrfToken,
  loginUser,
  getTestUser,
} = require("../setup/testSetup");

describe("Blog API - CRUD Operations", () => {
  let agent;
  let csrfToken;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginUser(agent); // Log in the test user
    csrfToken = await getAuthenticatedCsrfToken(agent, "/create");
  });

  test("POST /create should create a new blog post", async () => {
    const response = await agent.post("/create").type("form").send({
      title: "New Post",
      content: "This is a new blog post.",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(302); // Expect redirect on success

    const post = await BlogPost.findOne({ where: { title: "New Post" } });
    expect(post).not.toBeNull();
    expect(post.content).toBe("This is a new blog post.");
    // The author should be set automatically to the logged-in test user’s username.
    expect(post.author).toBe(getTestUser().username);
  });

  test("POST /edit/:id should update a blog post", async () => {
    // Create a blog post with the logged-in test user's username as the author.
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: getTestUser().username,
    });

    // Fetch CSRF token from the edit page
    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: "Updated Title",
      content: "Updated content",
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(302); // Expect redirect on success

    const updatedPost = await BlogPost.findByPk(post.id);
    expect(updatedPost.title).toBe("Updated Title");
    expect(updatedPost.content).toBe("Updated content");
    // The author remains unchanged.
    expect(updatedPost.author).toBe(getTestUser().username);
  });

  test("POST /delete/:id should delete an existing blog post and redirect", async () => {
    const post = await BlogPost.create({
      title: "Deletable Post",
      content: "This will be deleted",
      author: getTestUser().username,
    });

    // Fetch CSRF token from the edit page (which renders the delete form as well)
    const deleteCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/delete/${post.id}`).type("form").send({
      _csrf: deleteCsrfToken,
    });

    expect(response.status).toBe(302); // Expect redirect on success

    const deletedPost = await BlogPost.findByPk(post.id);
    expect(deletedPost).toBeNull();
  });

  test("POST /edit/:id should not update if title or content is missing", async () => {
    const post = await BlogPost.create({
      title: "Old Title",
      content: "Old content",
      author: getTestUser().username,
    });

    // Fetch CSRF token for the edit route
    const editCsrfToken = await getAuthenticatedCsrfToken(
      agent,
      `/edit/${post.id}`,
    );

    const response = await agent.post(`/edit/${post.id}`).type("form").send({
      title: "Updated Title",
      content: "", // Missing content
      _csrf: editCsrfToken,
    });

    expect(response.status).toBe(400);

    const unchangedPost = await BlogPost.findByPk(post.id);
    expect(unchangedPost.title).toBe("Old Title");
    expect(unchangedPost.content).toBe("Old content");
    expect(unchangedPost.author).toBe(getTestUser().username);
  });
});
