const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mailer");
const { User } = require("../models");
const { Sequelize, Op } = require("sequelize");
const { isAuthenticated } = require("../middlewares/auth");
require("dotenv").config();
const {
  validateSignUp,
  validateLogin,
  validateUpdateUsername,
  handleValidationErrors,
} = require("../middlewares/validation");

// Helpers
function generateToken(payload, expiresIn = "24h") {
  // Sign a JWT that expires in 24 hours by default
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

async function sendVerificationEmail(user, req) {
  // Generate a JWT or random token
  const token = generateToken({ email: user.email });

  // Use the correct host
  const host = process.env.APP_HOST || req.get("host");
  const verificationURL = `${req.protocol}://${host}/auth/verify?token=${token}`;

  // Example of sending a simple email
  await transporter.sendMail({
    from: `"Byte-Sized Bits" <luke.barnetson@ada.ac.uk>`,
    to: user.email,
    subject: "Please verify your email",
    html: `
      <p>Hi there,</p>
      <p>Click the link below to verify your email (valid for 24 hours):</p>
      <a href="${verificationURL}">${verificationURL}</a>
    `,
  });
}

// Sign Up
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up" });
});

router.post(
  "/signup",
  validateSignUp,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, username, password } = req.body;

      // Check if email or username already exists (case-insensitive for username)
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email },
            Sequelize.where(
              Sequelize.fn("lower", Sequelize.col("username")),
              Sequelize.fn("lower", username),
            ),
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).send("Email already in use");
        } else {
          return res.status(400).send("Username already in use");
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with isVerified = false
      const newUser = await User.create({
        email,
        username,
        password: hashedPassword,
        isVerified: false,
      });

      // Send verification email
      await sendVerificationEmail(newUser, req);

      res.send(
        "Signup successful! Please check your email to verify your account.",
      );
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error.");
    }
  },
);

// Email Verification
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("Missing token");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Once decoded, find the user by email
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      return res.status(400).send("Invalid token or user no longer exists.");
    }

    // Check if already verified
    if (user.isVerified) {
      return res.send("Account already verified. Please log in.");
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    res.send("Email verified successfully! You can now log in.");
  } catch (err) {
    console.error(err);
    return res.status(400).send("Token is invalid or has expired.");
  }
});

// Log In
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login" });
});

router.post(
  "/login",
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { identifier, password, rememberMe } = req.body; // 'identifier' can be email or username

      // Perform case-insensitive search for username
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { email: identifier },
            Sequelize.where(
              Sequelize.fn("lower", Sequelize.col("username")),
              Sequelize.fn("lower", identifier),
            ),
          ],
        },
      });

      if (!user) {
        return res.status(400).send("Invalid email/username or password");
      }

      // Check if user is verified
      if (!user.isVerified) {
        return res
          .status(403)
          .send("Please verify your email before logging in.");
      }

      // Compare password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(400).send("Invalid email/username or password");
      }

      // Save user info to session
      req.session.userId = user.id;

      // If "Remember Me" is ticked, extend session expiration
      if (rememberMe) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
      }

      res.redirect("/"); // or redirect to user dashboard
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error.");
    }
  },
);

// Log Out
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// Forgot Password
router.get("/forgot", (req, res) => {
  res.render("auth/forgot", { title: "Forgot Password" });
});

router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // For security, don't indicate whether email exists
      return res.send("If that email exists, a reset link has been sent.");
    }

    // Generate reset token
    const resetToken = generateToken({ email: user.email }, "1h"); // 1-hour expiration

    // Use correct host
    const host = process.env.APP_HOST || req.get("host");
    const resetURL = `${req.protocol}://${host}/auth/reset?token=${resetToken}`;

    await transporter.sendMail({
      from: `"Byte-Sized Bits" <luke.barnetson@ada.ac.uk>`,
      to: user.email,
      subject: "Password Reset",
      html: `
        <p>You requested a password reset for your account.</p>
        <p>Click the link below to reset (valid for 1 hour):</p>
        <a href="${resetURL}">${resetURL}</a>
      `,
    });

    res.send("If that email exists, a reset link has been sent.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error.");
  }
});

// Reset Password
router.get("/reset", (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Missing token");
  }
  res.render("auth/reset", { title: "Reset Password", token });
});

router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) {
      return res.status(400).send("Missing token");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      return res.status(400).send("Invalid token or user no longer exists.");
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.send(
      "Password reset successful. You can now log in with the new password.",
    );
  } catch (err) {
    console.error(err);
    res.status(400).send("Token is invalid or has expired.");
  }
});

// Update Email (Re-verify)
router.post("/update-email", async (req, res) => {
  try {
    // Ensure user is logged in
    if (!req.session.userId) {
      return res
        .status(401)
        .send("You must be logged in to update your email.");
    }

    const { newEmail } = req.body;
    const user = await User.findByPk(req.session.userId);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Check if newEmail already in use
    const existingUser = await User.findOne({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(400).send("Email already in use by another account.");
    }

    user.email = newEmail;
    user.isVerified = false; // re-verify
    await user.save();

    // Send new verification email
    await sendVerificationEmail(user, req);

    res.send(
      "Email updated. Please check your inbox to verify your new email.",
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error.");
  }
});

// Update Username
router.get("/update-username", isAuthenticated, (req, res) => {
  res.render("auth/update-username", { title: "Update Username" });
});

router.post(
  "/update-username",
  isAuthenticated, // Ensure the user is authenticated
  validateUpdateUsername,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { newUsername } = req.body;
      const user = await User.findByPk(req.session.userId);

      if (!user) {
        return res.status(404).send("User not found.");
      }

      // Check if newUsername already exists (case-insensitive)
      const existingUser = await User.findOne({
        where: Sequelize.where(
          Sequelize.fn("lower", Sequelize.col("username")),
          Sequelize.fn("lower", newUsername),
        ),
      });

      if (existingUser) {
        return res.status(400).send("Username already in use");
      }

      // Update username
      user.username = newUsername;
      await user.save();

      res.send("Username updated successfully.");
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error.");
    }
  },
);

// Delete Account
router.post("/delete-account", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).send("Not logged in.");
    }

    const user = await User.findByPk(req.session.userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Delete user
    await user.destroy();

    // Destroy session
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie("connect.sid");
      res.send("Account deleted successfully.");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error.");
  }
});

module.exports = router;
