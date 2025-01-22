const { body, param, validationResult } = require("express-validator");
const sanitiseHtml = require("sanitize-html");

// Reusable sanitisation function
const sanitiseInput = (input) => {
  return sanitiseHtml(input, {
    allowedTags: [], // Disallow all HTML tags
    allowedAttributes: {}, // Disallow all attributes
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true, // Prevent malicious code around valid tags
  });
};

// Middleware to validate and sanitise input
const validateCreatePost = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters")
    .customSanitizer((value) => sanitiseInput(value)),
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Content is required")
    .customSanitizer((value) => sanitiseInput(value)),
  body("author")
    .trim()
    .notEmpty()
    .withMessage("Author is required")
    .isLength({ max: 100 })
    .withMessage("Author name must be less than 100 characters")
    .customSanitizer((value) => sanitiseInput(value)),
];

const validateEditPost = [
  param("id").isInt().withMessage("Post ID must be an integer"),
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title must not be empty")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters")
    .customSanitizer((value) => sanitiseInput(value)),
  body("content")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Content must not be empty")
    .customSanitizer((value) => sanitiseInput(value)),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  validateCreatePost,
  validateEditPost,
  handleValidationErrors,
};
