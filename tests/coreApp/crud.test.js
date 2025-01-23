const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");
const { getCsrfToken } = require("../setup/testSetup");

describe("Blog API - CRUD Operations", () => {
  test("POST /create should create a new blog post", async () => {
    const { csrfToken, cookie } = await getCsrfToken();

    const response = await request(app)
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

    const response = await request(app)
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

    const response = await request(app)
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

    const response = await request(app)
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
