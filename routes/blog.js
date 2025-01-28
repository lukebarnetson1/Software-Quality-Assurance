const express = require("express");
const router = express.Router();
const { BlogPost } = require("../models");
const {
  validateBlogPost,
  handleValidationErrors,
} = require("../middlewares/validation");
const { isAuthenticated } = require("../middlewares/auth");

// Get all blog posts and render the index page (public route)
router.get("/", isAuthenticated, async (req, res) => {
  const posts = await BlogPost.findAll();
  res.render("blog/index", { title: "Blog Posts", posts });
});

// Render the create post form (authenticated users only)
router.get("/create", isAuthenticated, (req, res) => {
  res.render("blog/create", { title: "Create Post" });
});

// Create a new blog post (authenticated users only)
router.post(
  "/create",
  isAuthenticated,
  validateBlogPost,
  handleValidationErrors,
  async (req, res) => {
    const { title, content, author } = req.body;

    try {
      await BlogPost.create({ title, content, author });
      res.redirect("/");
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  },
);

// Render a single blog post (public route)
router.get("/post/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("blog/post", { title: post.title, post });
  } else {
    res.status(404).send("Post not found");
  }
});

// Render the edit form for a specific blog post (authenticated users only)
router.get("/edit/:id", isAuthenticated, async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("blog/edit", { title: "Edit Post", post });
  } else {
    res.status(404).send("Post not found");
  }
});

// Update a specific blog post (authenticated users only)
router.post(
  "/edit/:id",
  isAuthenticated,
  validateBlogPost,
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

// Delete a specific blog post (authenticated users only)
router.post("/delete/:id", isAuthenticated, async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    await post.destroy();
    res.redirect("/");
  } else {
    res.status(404).send("Post not found");
  }
});

// Get blog post statistics (authenticated users only)
router.get("/stats", isAuthenticated, async (req, res) => {
  const posts = await BlogPost.findAll();
  const lengths = posts.map((post) => post.content.length);

  if (lengths.length === 0) {
    return res.render("blog/stats", {
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

  res.render("blog/stats", {
    title: "Post Statistics",
    average_length: Math.round(average_length),
    median_length: Math.round(median),
    max_length: Math.max(...lengths),
    min_length: Math.min(...lengths),
    total_length: total_length,
  });
});

module.exports = router;
