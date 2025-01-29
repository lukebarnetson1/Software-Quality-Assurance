const { body, validationResult } = require("express-validator");
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

// Validation rules for creating/editing blog posts
const validateBlogPost = [
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

// Validation rules for sign-up
const validateSignUp = [
  body("email")
    .isEmail()
    .withMessage("Must be a valid email address")
    .customSanitizer((value) => sanitiseInput(value)),
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters.")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores.")
    .customSanitizer((value) => sanitiseInput(value)),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

// Validation rules for login
const validateLogin = [
  body("identifier")
    .notEmpty()
    .withMessage("Email or Username is required")
    .customSanitizer((value) => sanitiseInput(value)),
  body("password").notEmpty().withMessage("Password is required"),
];

// Validation rules for updating username
const validateUpdateUsername = [
  body("newUsername")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters.")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores.")
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
  validateBlogPost,
  validateSignUp,
  validateLogin,
  validateUpdateUsername,
  handleValidationErrors,
};
