require("../setup/testSetup");
const { BlogPost } = require("../../models");

describe("BlogPost Model", () => {
  test("should successfully create a valid blog post", async () => {
    const postData = {
      title: "Valid Post",
      content: "This is valid content.",
      author: "Valid Author",
    };

    const post = await BlogPost.create(postData);

    expect(post).not.toBeNull();
    expect(post.title).toBe(postData.title);
    expect(post.content).toBe(postData.content);
    expect(post.author).toBe(postData.author);
  });

  test("should fail to create a blog post without required fields", async () => {
    const invalidData = {
      content: "Missing title and author",
    };

    await expect(BlogPost.create(invalidData)).rejects.toThrowError(
      /notNull Violation/i, // Match Sequelize's "notNull Violation" error
    );
  });
});
