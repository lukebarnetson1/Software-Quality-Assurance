const express = require("express");
const router = express.Router();
const { BlogPost } = require("../models");
const {
  validateCreatePost,
  validateEditPost,
  handleValidationErrors,
} = require("../middlewares/validation");

// Get all blog posts and render the index page
router.get("/", async (req, res) => {
  const posts = await BlogPost.findAll();
  res.render("index", { title: "Blog Posts", posts });
});

// Render the create post form
router.get("/create", (req, res) => {
  res.render("create", { title: "Create Post" });
});

// Create a new blog post
router.post(
  "/create",
  validateCreatePost,
  handleValidationErrors,
  async (req, res) => {
    const { title, content, author } = req.body;

    try {
      await BlogPost.create({ title, content, author });
      res.redirect("/");
    } catch {
      res.status(500).send("Internal Server Error");
    }
  },
);

// Render a single blog post
router.get("/post/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("post", { title: post.title, post });
  } else {
    res.status(404).send("Post not found");
  }
});

// Render the edit form for a specific blog post
router.get("/edit/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("edit", { title: "Edit Post", post });
  } else {
    res.status(404).send("Post not found");
  }
});

// Update a specific blog post
router.post(
  "/edit/:id",
  validateEditPost,
  handleValidationErrors,
  async (req, res) => {
    const post = await BlogPost.findByPk(req.params.id);
    if (post) {
      const { title, content } = req.body;
      await post.update({ title, content });
      res.redirect(`/post/${post.id}`);
    } else {
      res.status(404).send("Post not found");
    }
  },
);

// Delete a specific blog post
router.post("/delete/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    await post.destroy();
    res.redirect("/");
  } else {
    res.status(404).send("Post not found");
  }
});

// Get blog post statistics
router.get("/stats", async (req, res) => {
  const posts = await BlogPost.findAll();
  const lengths = posts.map((post) => post.content.length);

  if (lengths.length === 0) {
    return res.render("stats", {
      title: "Post Statistics",
      average_length: 0,
      median_length: 0,
      max_length: 0,
      min_length: 0,
      total_length: 0,
    });
  }

  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const median =
    lengths.length % 2 === 0
      ? (sortedLengths[lengths.length / 2 - 1] +
          sortedLengths[lengths.length / 2]) /
        2
      : sortedLengths[Math.floor(lengths.length / 2)];
  const total_length = lengths.reduce((a, b) => a + b, 0);
  const average_length = total_length / lengths.length;

  res.render("stats", {
    title: "Post Statistics",
    average_length: Math.round(average_length),
    median_length: Math.round(median),
    max_length: Math.max(...lengths),
    min_length: Math.min(...lengths),
    total_length: total_length,
  });
});

module.exports = router;
