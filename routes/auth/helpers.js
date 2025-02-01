const jwt = require("jsonwebtoken");
const transporter = require("../../config/mailer");
require("dotenv").config();

/**
 * Generates a JSON Web Token (JWT) with a specified payload and expiry.
 * @param {Object} payload - The payload to embed in the token.
 * @param {string} [expiresIn="1h"] - Token expiry time (default is 1 hour).
 * @returns {string} - The generated JWT.
 */
function generateToken(payload, expiresIn = "1h") {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Sends a verification email to the specified user.
 * @param {Object} user - The user object containing email and username.
 * @param {Object} req - The HTTP request object (used to determine host and protocol).
 */
async function sendVerificationEmail(user, req) {
  // Generate a token with the user's email address
  const token = generateToken({ email: user.email });
  // Determine the host from environment variables or the request header
  const host = process.env.APP_HOST || req.get("host");
  // Construct the full verification URL
  const verificationURL = `${req.protocol}://${host}/auth/verify?token=${token}`;

  // Send the verification email using nodemailer
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

module.exports = {
  generateToken,
  sendVerificationEmail,
};
