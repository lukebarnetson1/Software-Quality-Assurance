require("../setup/testSetup");
const request = require("supertest");
const app = require("../../app");
const { BlogPost } = require("../../models");

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

    const response = await request(app).get("/stats");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Average Length: 5 characters");
    expect(response.text).toContain("Median Length: 5 characters");
    expect(response.text).toContain("Maximum Length: 7 characters");
    expect(response.text).toContain("Minimum Length: 3 characters");
  });

  test("GET /stats should handle empty database gracefully", async () => {
    const response = await request(app).get("/stats");
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

    const response = await request(app).get("/stats");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Median Length: 4 characters");
  });
});
