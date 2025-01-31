const { body, validationResult } = require("express-validator");
const sanitiseHtml = require("sanitize-html");
const zxcvbn = require("zxcvbn");

// Reusable sanitisation function
const sanitiseInput = (input) => {
  return sanitiseHtml(input, {
    allowedTags: [], // Disallow all HTML tags
    allowedAttributes: {}, // Disallow all attributes
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true, // Prevent malicious code around valid tags
  });
};

const validatePasswordStrength = (password) => {
  const result = zxcvbn(password);
  if (result.score < 2) {
    throw new Error("Password is too weak. Please choose a stronger password.");
  }
  return true;
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
  body("password").custom(validatePasswordStrength),
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

const validateResetPassword = [
  body("password").custom(validatePasswordStrength), // Use zxcvbn for password validation
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
  validateResetPassword,
  handleValidationErrors,
};
