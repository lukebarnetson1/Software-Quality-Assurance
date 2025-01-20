const { BlogPost } = require("../models");

describe("BlogPost Model", () => {
  test("should create a valid blog post", async () => {
    const post = await BlogPost.create({
      title: "Valid Post",
      content: "This is valid content.",
      author: "Valid Author",
    });
    expect(post).not.toBeNull();
    expect(post.title).toBe("Valid Post");
    expect(post.content).toBe("This is valid content.");
    expect(post.author).toBe("Valid Author");
  });

  test("should fail to create a blog post without required fields", async () => {
    await expect(
      BlogPost.create({
        content: "Missing title and author",
      }),
    ).rejects.toThrow();
  });
});
