const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mailer");
const { BlogPost, User } = require("../models");
const { Sequelize, Op } = require("sequelize");
const { isAuthenticated } = require("../middlewares/auth");
require("dotenv").config();
const {
  validateSignUp,
  validateLogin,
  validateUpdateUsername,
} = require("../middlewares/validation");

// Helpers
function generateToken(payload, expiresIn = "1h") {
  // Sign a JWT that expires in 1 hour
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

async function sendVerificationEmail(user, req) {
  // Generate a JWT
  const token = generateToken({ email: user.email });

  // Use the correct host
  const host = process.env.APP_HOST || req.get("host");
  const verificationURL = `${req.protocol}://${host}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
    to: user.email,
    subject: "Please verify your email",
    html: `
      <p>Hi ${user.username},</p>
      <p>Click below to verify your email (valid for 1 hour):</p>
      <a href="${verificationURL}">${verificationURL}</a>
    `,
  });
}

// SIGN UP
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up" });
});

router.post("/signup", validateSignUp, async (req, res) => {
  const { email, username, password } = req.body;

  // Check for validation errors
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Store them in flash and re-render
    req.flash(
      "error",
      errors
        .array()
        .map((err) => err.msg)
        .join(" | "),
    );
    return res.status(422).render("auth/signup", {
      title: "Sign Up",
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  try {
    // Check if email or username is already used
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
        req.flash("error", "Email address already in use.");
      } else {
        req.flash("error", "Username already in use.");
      }
      return res.redirect("/auth/signup");
    }

    // Hash & create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      username,
      password: hashedPassword,
      isVerified: false,
    });

    try {
      // Attempt to send verification email
      await sendVerificationEmail(newUser, req);
      // If successful, inform the user to check their email
      req.flash(
        "success",
        "Signup successful! Check your email to verify your account.",
      );
      res.redirect("/auth/login");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Inform the user that sign-up was successful but email sending failed
      req.flash(
        "error",
        "Verification email failed to send. Please ensure the email address is valid.",
      );
      res.redirect("/auth/signup");
    }

    // Redirect to login page regardless of email sending success
  } catch (err) {
    console.error("Signup failed:", err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/signup");
  }
});

// EMAIL VERIFICATION
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token");
      return res.redirect("/auth/login");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      req.flash("error", "Invalid token or user no longer exists.");
      return res.redirect("/auth/login");
    }
    if (user.isVerified) {
      req.flash("success", "Account already verified. You are now logged in.");
      return res.redirect("/");
    }
    user.isVerified = true;
    await user.save();
    req.flash("success", "Email verified! You are now logged in.");
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/login");
  }
});

// LOGIN
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login" });
});

router.post("/login", validateLogin, async (req, res) => {
  // Manual check of validation error
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Inline errors:
    return res.status(422).render("auth/login", {
      title: "Login",
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  const { identifier, password, rememberMe } = req.body;

  try {
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
      req.flash("error", "Invalid email/username or password");
      return res.redirect("/auth/login");
    }
    if (!user.isVerified) {
      req.flash("error", "Please verify your email before logging in.");
      return res.redirect("/auth/login");
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error", "Invalid email/username or password");
      return res.redirect("/auth/login");
    }

    // Save to session
    req.session.userId = user.id;
    if (rememberMe) {
      // Extend session cookie life
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7;
    }

    req.flash("success", `Welcome back, ${user.username}!`);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/login");
  }
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.flash("success", "You have been logged out.");
  req.session.save((err) => {
    if (err) console.error(err);
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

// FORGOT PASSWORD
router.get("/forgot", (req, res) => {
  res.render("auth/forgot", { title: "Forgot Password" });
});

router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    // Always send the same flash so we don't leak info about existing emails
    const message = "If that email exists, a reset link has been sent.";
    if (!user) {
      req.flash("success", message);
      return res.redirect("/auth/forgot");
    }

    const resetToken = generateToken({ email: user.email }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const resetURL = `${req.protocol}://${host}/auth/reset?token=${resetToken}`;
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Password Reset",
      html: `
        <p>You requested a password reset.</p>
        <p>Click below to reset (valid for 1 hour):</p>
        <a href="${resetURL}">${resetURL}</a>
      `,
    });

    req.flash("success", message);
    res.redirect("/auth/forgot");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/forgot");
  }
});

// RESET PASSWORD
router.get("/reset", (req, res) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error", "Missing token");
    return res.redirect("/auth/forgot");
  }
  res.render("auth/reset", { title: "Reset Password", token });
});

router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) {
      req.flash("error", "Missing token");
      return res.redirect("/auth/forgot");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      req.flash("error", "Invalid token or user no longer exists");
      return res.redirect("/auth/forgot");
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    req.flash("success", "Password reset successful. You can now log in.");
    res.redirect("/auth/login");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/forgot");
  }
});

// UPDATE EMAIL
router.get("/update-email", isAuthenticated, (req, res) => {
  res.render("auth/update-email", { title: "Update Email Address" });
});

router.post("/update-email", async (req, res) => {
  if (!req.session.userId) {
    req.flash("error", "You must be logged in to update your email.");
    return res.redirect("/auth/login");
  }

  try {
    const { newEmail } = req.body;
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }
    // Check if new email is already in use
    const existingUser = await User.findOne({ where: { email: newEmail } });
    if (existingUser) {
      req.flash("error", "Email already in use by another account.");
      return res.redirect("/");
    }
    // Generate a token that includes the user's id and the new email
    const token = generateToken({ userId: user.id, newEmail }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const confirmURL = `${req.protocol}://${host}/auth/confirm-update-email?token=${token}`;

    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email, // send to the current email address
      subject: "Confirm Email Change",
      html: `
        <p>Hello ${user.username},</p>
        <p>You requested to change your email address to <strong>${newEmail}</strong>. Please click the link below to confirm this change:</p>
        <a href="${confirmURL}">${confirmURL}</a>
      `,
    });

    req.flash(
      "success",
      "A confirmation email has been sent to your current email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/");
  }
});

router.get("/confirm-update-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/account-settings");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }
    // Check again if the new email is not already in use
    const existingUser = await User.findOne({
      where: { email: decoded.newEmail },
    });
    if (existingUser) {
      req.flash("error", "Email already in use by another account.");
      return res.redirect("/auth/account-settings");
    }
    user.email = decoded.newEmail;
    user.isVerified = false; // require re‑verification for the new email
    await user.save();
    // Send a verification email so that the new email is confirmed
    await sendVerificationEmail(user, req);

    req.flash(
      "success",
      "Email updated successfully. Please verify your new email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

// UPDATE USERNAME
router.get("/update-username", isAuthenticated, (req, res) => {
  res.render("auth/update-username", { title: "Update Username" });
});

router.post(
  "/update-username",
  isAuthenticated,
  validateUpdateUsername,
  async (req, res) => {
    const { validationResult } = require("express-validator");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash(
        "error",
        errors
          .array()
          .map((err) => err.msg)
          .join(" | "),
      );
      return res.redirect("/auth/update-username");
    }

    try {
      const { newUsername } = req.body;
      const user = await User.findByPk(req.session.userId);
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/");
      }
      // Check if the new username is already taken
      const existingUser = await User.findOne({
        where: Sequelize.where(
          Sequelize.fn("lower", Sequelize.col("username")),
          Sequelize.fn("lower", newUsername),
        ),
      });
      if (existingUser) {
        req.flash("error", "Username already in use.");
        return res.redirect("/auth/update-username");
      }
      // Generate a token for the username change
      const token = generateToken({ userId: user.id, newUsername }, "1h");
      const host = process.env.APP_HOST || req.get("host");
      const confirmURL = `${req.protocol}://${host}/auth/confirm-update-username?token=${token}`;

      await transporter.sendMail({
        from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
        to: user.email,
        subject: "Confirm Username Change",
        html: `
        <p>Hello ${user.username},</p>
        <p>You requested to change your username to <strong>${newUsername}</strong>. Please click the link below to confirm this change:</p>
        <a href="${confirmURL}">${confirmURL}</a>
      `,
      });

      req.flash(
        "success",
        "A confirmation email has been sent to your current email address.",
      );
      res.redirect("/auth/account-settings");
    } catch (err) {
      console.error(err);
      req.flash("error", "Internal server error.");
      res.redirect("/auth/update-username");
    }
  },
);

router.get("/confirm-update-username", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/account-settings");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }
    // Store the current (old) username before updating
    const oldUsername = user.username;

    // Double-check that the new username isn’t taken
    const existingUser = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn("lower", Sequelize.col("username")),
        Sequelize.fn("lower", decoded.newUsername),
      ),
    });
    if (existingUser) {
      req.flash("error", "Username already in use.");
      return res.redirect("/auth/account-settings");
    }

    // Update the user's username
    user.username = decoded.newUsername;
    await user.save();

    // Update all blog posts that have the old username as the author
    await BlogPost.update(
      { author: decoded.newUsername },
      { where: { author: oldUsername } },
    );

    req.flash("success", "Username updated successfully.");
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

// DELETE ACCOUNT
router.get("/delete-account", isAuthenticated, (req, res) => {
  res.render("auth/delete-account", { title: "Delete Username" });
});

router.post("/delete-account", async (req, res) => {
  if (!req.session.userId) {
    req.flash("error", "Not logged in.");
    return res.redirect("/auth/login");
  }
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }
    // Generate a token for account deletion
    const token = generateToken({ userId: user.id }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const confirmURL = `${req.protocol}://${host}/auth/confirm-delete-account?token=${token}`;

    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Confirm Account Deletion",
      html: `
        <p>Hello ${user.username},</p>
        <p>You requested to delete your account. This action is irreversible.</p>
        <p>Please click the link below to confirm account deletion:</p>
        <a href="${confirmURL}">${confirmURL}</a>
      `,
    });

    req.flash(
      "success",
      "A confirmation email has been sent to your email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/");
  }
});

router.get("/confirm-delete-account", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/account-settings");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }
    // Update any blog posts by this user
    await BlogPost.update(
      { author: "[Deleted-User]" },
      { where: { author: user.username } },
    );
    await user.destroy();

    req.flash("success", "Account deleted successfully.");
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

// ACCOUNT SETTINGS
router.get("/account-settings", isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  res.render("auth/account-settings", { title: "Account Settings", user });
});

// GET route to render a form for resetting the password (for logged-in users)
router.get("/update-password", isAuthenticated, (req, res) => {
  res.render("auth/update-password", { title: "Reset Password" });
});

// POST route to process password reset – instead of immediately updating the password,
// send a confirmation email with a token (similar to update-email).
router.post("/update-password", isAuthenticated, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }
    // Generate a token that encodes the new password (use a short expiry)
    const token = generateToken({ userId: user.id, newPassword }, "1h");
    const host = process.env.APP_HOST || req.get("host");
    const confirmURL = `${req.protocol}://${host}/auth/confirm-update-password?token=${token}`;
    await transporter.sendMail({
      from: `"Byte-Sized Bits" <noreply@yourapp.com>`,
      to: user.email,
      subject: "Confirm Password Reset",
      html: `
        <p>Hi ${user.username},</p>
        <p>You requested a password reset. Click the link below to confirm this change:</p>
        <a href="${confirmURL}">${confirmURL}</a>
      `,
    });
    req.flash(
      "success",
      "A confirmation email has been sent to your email address.",
    );
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Internal server error.");
    res.redirect("/auth/update-password");
  }
});

// GET route to confirm the password update when the user clicks the confirmation link.
router.get("/confirm-update-password", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.flash("error", "Missing token.");
      return res.redirect("/auth/account-settings");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/account-settings");
    }
    // Hash the new password and update the user record
    const hashedPassword = await bcrypt.hash(decoded.newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    req.flash("success", "Password updated successfully.");
    res.redirect("/auth/account-settings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Token is invalid or has expired.");
    res.redirect("/auth/account-settings");
  }
});

module.exports = router;
