const express = require("express");
const router = express.Router();
const { BlogPost } = require("../models");

router.get("/", async (req, res) => {
  const posts = await BlogPost.findAll();
  res.render("index", { title: "Blog Posts", posts });
});

router.get("/create", (req, res) => {
  res.render("create", { title: "Create Post" });
});

router.post("/create", async (req, res) => {
  const { title, content, author } = req.body;

  // Validate input
  if (!title || !content || !author) {
    return res.status(400).send("All fields are required");
  }

  // Create the blog post if input is valid
  try {
    await BlogPost.create({ title, content, author });
    res.redirect("/");
  } catch {
    res.status(500).send("Internal Server Error");
  }
});

router.get("/post/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("post", { title: post.title, post });
  } else {
    res.status(404).send("Post not found");
  }
});

router.get("/edit/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    res.render("edit", { title: "Edit Post", post });
  } else {
    res.status(404).send("Post not found");
  }
});

router.post("/edit/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    const { title, content } = req.body;
    if (title && content) {
      await post.update({ title, content });
    }
    res.redirect(`/post/${post.id}`);
  } else {
    res.status(404).send("Post not found");
  }
});

router.post("/delete/:id", async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (post) {
    await post.destroy();
    res.redirect("/");
  } else {
    res.status(404).send("Post not found");
  }
});

router.get("/stats", async (req, res) => {
  const posts = await BlogPost.findAll();
  const lengths = posts.map((post) => post.content.length);

  // Handle the empty array case to avoid division by zero
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

  // Sort a copy of the lengths array to calculate the median
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const median =
    lengths.length % 2 === 0
      ? (sortedLengths[lengths.length / 2 - 1] +
          sortedLengths[lengths.length / 2]) /
        2
      : sortedLengths[Math.floor(lengths.length / 2)];

  const total_length = lengths.reduce((a, b) => a + b, 0);
  const average_length = total_length / lengths.length;

  const stats = {
    average_length: Math.round(average_length),
    median_length: Math.round(median),
    max_length: Math.max(...lengths),
    min_length: Math.min(...lengths),
    total_length: total_length,
  };

  res.render("stats", { title: "Post Statistics", ...stats });
});

module.exports = router;
