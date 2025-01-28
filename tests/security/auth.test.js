const request = require("supertest");
const app = require("../../app");
const {
  getCsrfToken,
  loginUser,
  getAuthenticatedCsrfToken,
} = require("../setup/testSetup");
const { User } = require("../../models");

// Mock the mailer module instead of nodemailer
jest.mock("../../config/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue({
    accepted: ["test@example.com"],
    response: "OK",
  }),
}));

const mailer = require("../../config/mailer"); // Import the mocked mailer

describe("Authentication System", () => {
  let agent;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mock call counts and implementations
    agent = request.agent(app); // Create a Supertest agent for session handling
  });

  test("should allow a user to log in with valid credentials", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "testuser@example.com",
        password: "testpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // App redirects on success
    expect(response.headers.location).toBe("/"); // Redirect to home
  });

  test("should reject login with invalid credentials", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "testuser@example.com",
        password: "wrongpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400); // Error 400 for invalid credentials
    expect(response.text).toContain("Invalid email or password");
  });

  test("should log out a logged-in user", async () => {
    // Log in the test user
    await loginUser(agent);

    // Perform logout
    const response = await agent.get("/auth/logout");
    expect(response.status).toBe(302); // Redirect after logout
    expect(response.headers.location).toBe("/"); // Redirect to home

    // Verify access to protected routes after logout
    const protectedResponse = await agent.get("/create"); // Protected route
    expect(protectedResponse.status).toBe(302); // Redirects to login
    expect(protectedResponse.headers.location).toBe("/auth/login");
  });

  test("should deny access to protected routes for unauthenticated users", async () => {
    const response = await request(app).get("/create"); // Attempt to access protected route
    expect(response.status).toBe(302); // Redirect to login
    expect(response.headers.location).toBe("/auth/login");
  });

  test("should handle login CSRF token mismatch", async () => {
    const response = await agent.post("/auth/login").type("form").send({
      email: "testuser@example.com",
      password: "testpassword",
      _csrf: "invalid_csrf_token", // Deliberately invalid CSRF token
    });

    expect(response.status).toBe(403);
    expect(response.text).toContain("Invalid CSRF token or session expired.");
  });

  test("should send a verification email on signup", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/signup");

    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "newuser@example.com",
        password: "securepassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain(
      "Please check your email to verify your account.",
    );

    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(String),
        to: "newuser@example.com",
        subject: "Please verify your email",
        html: expect.stringContaining("verify your email"),
      }),
    );
  });

  test("should return appropriate error for unverified accounts", async () => {
    // Sign up an unverified user
    const { csrfToken: signupCsrf, cookie: signupCookie } =
      await getCsrfToken("/auth/signup");

    const signupResponse = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", signupCookie)
      .send({
        email: "unverified@example.com",
        password: "securepassword",
        _csrf: signupCsrf,
      });

    expect(signupResponse.status).toBe(200);
    expect(signupResponse.text).toContain(
      "Please check your email to verify your account.",
    );

    // Ensure the user is created with isVerified = false
    const user = await User.findOne({
      where: { email: "unverified@example.com" },
    });
    expect(user).not.toBeNull();
    expect(user.isVerified).toBe(false);

    // Attempt to log in with the unverified account
    const { csrfToken: loginCsrf, cookie: loginCookie } =
      await getCsrfToken("/auth/login");

    const loginResponse = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", loginCookie)
      .send({
        email: "unverified@example.com",
        password: "securepassword",
        _csrf: loginCsrf,
      });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.text).toContain(
      "Please verify your email before logging in.",
    );
  });

  test("should handle email send errors gracefully", async () => {
    // Mock sendMail to reject
    mailer.sendMail.mockRejectedValueOnce(new Error("Email service is down"));

    const { csrfToken, cookie } = await getCsrfToken("/auth/signup");

    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "erroruser@example.com",
        password: "securepassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal server error.");
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test("should handle errors when sending reset password emails", async () => {
    mailer.sendMail.mockRejectedValueOnce(new Error("Failed to send email"));

    const csrfToken = await getAuthenticatedCsrfToken(agent, "/auth/forgot");

    const response = await agent.post("/auth/forgot").type("form").send({
      email: "testuser@example.com",
      _csrf: csrfToken,
    });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal server error.");
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });
});
