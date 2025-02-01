// tests/auth/helpers.test.js
// These tests exercise the helper functions used in authentication
// such as generateToken and sendVerificationEmail.

const jwt = require("jsonwebtoken");
const {
  generateToken,
  sendVerificationEmail,
} = require("../../routes/auth/helpers");
const transporter = require("../../config/mailer");

// Ensure a JWT secret is set for testing.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "testsecret";
}

describe("Auth Helpers", () => {
  test("generateToken creates a valid JWT with the given payload", () => {
    const payload = { foo: "bar" };
    const token = generateToken(payload, "1h");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.foo).toBe("bar");
  });

  test("sendVerificationEmail sends an email with the correct parameters", async () => {
    // Create a dummy user and request object.
    const user = { email: "helperuser@example.com", username: "helperuser" };
    const req = {
      protocol: "http",
      get: () => "localhost:3000",
    };
    const sendMailSpy = jest.spyOn(transporter, "sendMail").mockResolvedValue({
      accepted: ["helperuser@example.com"],
      response: "OK",
    });
    await sendVerificationEmail(user, req);
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "helperuser@example.com",
        subject: "Please verify your email",
        html: expect.stringContaining("verify"),
      }),
    );
    sendMailSpy.mockRestore();
  });
});
