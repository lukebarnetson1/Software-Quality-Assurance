const request = require("supertest");
const app = require("../../app");
const bcrypt = require("bcrypt");
const { getCsrfToken } = require("../setup/testSetup");
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
    // Ensure a user exists and is verified
    await User.create({
      email: "testuser@example.com",
      username: "testuser",
      password: await bcrypt.hash("testpassword", 10),
      isVerified: true,
    });

    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        identifier: "testuser@example.com", // Use 'identifier' instead of 'email'
        password: "testpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on success
    expect(response.headers.location).toBe("/"); // Redirect to home

    // Follow the redirect and check flash messages
    const followUp = await agent.get(response.headers.location);
    expect(followUp.text).toContain("Welcome back, testuser!");
  });

  test("should allow a user to log in using username", async () => {
    // Ensure a user exists and is verified
    await User.create({
      email: "testuser2@example.com",
      username: "testuser2",
      password: await bcrypt.hash("testpassword", 10),
      isVerified: true,
    });

    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        identifier: "testuser2", // Use username as identifier
        password: "testpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on success
    expect(response.headers.location).toBe("/"); // Redirect to home

    // Follow the redirect and check flash messages
    const followUp = await agent.get(response.headers.location);
    expect(followUp.text).toContain("Welcome back, testuser2!");
  });

  test("should reject login with invalid credentials", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        identifier: "testuser@example.com",
        password: "wrongpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on failure
    expect(response.headers.location).toBe("/auth/login"); // Redirect back to login

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/login");
    expect(followUp.text).toContain("Invalid email/username or password");
  });

  test("should reject login with invalid username", async () => {
    const { csrfToken, cookie } = await getCsrfToken("/auth/login");

    const response = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", cookie)
      .send({
        identifier: "nonexistentuser",
        password: "testpassword",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on failure
    expect(response.headers.location).toBe("/auth/login"); // Redirect back to login

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/login");
    expect(followUp.text).toContain("Invalid email/username or password");
  });

  test("should log out a logged-in user", async () => {
    // Ensure a user exists and is verified
    await User.create({
      email: "logoutuser@example.com",
      username: "logoutuser",
      password: await bcrypt.hash("testpassword", 10),
      isVerified: true,
    });

    // Log in the test user
    const loginCsrf = (await agent.get("/auth/login")).text.match(
      /name="_csrf" value="([^"]+)"/,
    )[1];
    await agent.post("/auth/login").type("form").send({
      identifier: "logoutuser",
      password: "testpassword",
      _csrf: loginCsrf,
    });

    // Perform logout
    const response = await agent.get("/auth/logout");
    expect(response.status).toBe(302); // Redirect after logout

    // Verify access to protected routes after logout
    const protectedResponse = await agent.get("/create"); // Protected route
    expect(protectedResponse.status).toBe(302); // Redirects to login
    expect(protectedResponse.headers.location).toBe("/auth/login");
  });

  test("should deny access to protected routes for unauthenticated users", async () => {
    const response = await agent.get("/create"); // Attempt to access protected route
    expect(response.status).toBe(302); // Redirect to login
    expect(response.headers.location).toBe("/auth/login");
  });

  test("should handle login CSRF token mismatch", async () => {
    const response = await agent.post("/auth/login").type("form").send({
      identifier: "testuser@example.com",
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
        username: "newuser",
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect after signup

    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test("should prevent signup with duplicate email", async () => {
    // Create a user with the duplicate email
    await User.create({
      email: "testuser@example.com",
      username: "uniqueusername",
      password: await bcrypt.hash("testpassword", 10),
      isVerified: true,
    });

    const { csrfToken, cookie } = await getCsrfToken("/auth/signup");

    // Attempt to sign up with existing email
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "testuser@example.com", // Existing email
        username: "uniqueusername2", // Unique username
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on failure
    expect(response.headers.location).toBe("/auth/signup"); // Redirect back to signup

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/signup");
    expect(followUp.text).toContain("Email address already in use.");
  });

  test("should prevent signup with duplicate username", async () => {
    // Create a user with the duplicate username
    await User.create({
      email: "uniqueemail@example.com",
      username: "testuser",
      password: await bcrypt.hash("testpassword", 10),
      isVerified: true,
    });

    const { csrfToken, cookie } = await getCsrfToken("/auth/signup");

    // Attempt to sign up with existing username
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "uniqueemail2@example.com",
        username: "testuser", // Existing username
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect on failure
    expect(response.headers.location).toBe("/auth/signup"); // Redirect back to signup

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/signup");
    expect(followUp.text).toContain("Username already in use");
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
        username: "unverifieduser",
        password: "StrongPass123!",
        _csrf: signupCsrf,
      });

    expect(signupResponse.status).toBe(302); // Expect redirect after signup

    // Follow the redirect
    await agent.get("/auth/login");

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
        identifier: "unverified@example.com",
        password: "StrongPass123!",
        _csrf: loginCsrf,
      });

    expect(loginResponse.status).toBe(403); // Forbidden due to unverified account
  });
});
