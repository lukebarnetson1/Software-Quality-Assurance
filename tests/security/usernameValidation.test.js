const request = require("supertest");
const app = require("../../app");
const { User } = require("../../models");
const { getCsrfToken } = require("../setup/testSetup");

// Mock the mailer module (nodemailer)
jest.mock("../../config/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue({
    accepted: ["test@example.com"],
    response: "OK",
  }),
}));

describe("Username Validation Tests", () => {
  let agent;
  let csrfToken;
  let cookie;

  beforeEach(async () => {
    jest.clearAllMocks(); // Reset mock call counts and implementations
    agent = request.agent(app); // Create a Supertest agent for session handling

    // Fetch CSRF token from the sign-up page
    const csrfData = await getCsrfToken("/auth/signup");
    csrfToken = csrfData.csrfToken;
    cookie = csrfData.cookie;
  });

  test("Should reject usernames with prohibited characters", async () => {
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "invaliduser@example.com",
        username: "invalid@name!", // Invalid characters
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(422); // Server should not process invalid username

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/signup");
    expect(followUp.text).toContain(
      "Username can only contain letters, numbers, and underscores.",
    );
  });

  test("Should reject username shorter than 3 characters", async () => {
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "shortuser@example.com",
        username: "ab", // Too short
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(422); // Server should not process invalid username

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/signup");
    expect(followUp.text).toContain(
      "Username must be between 3 and 30 characters.",
    );
  });

  test("Should reject username longer than 30 characters", async () => {
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "longuser@example.com",
        username: "a".repeat(31), // Too long
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(422); // Server should not process invalid username

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/signup");
    expect(followUp.text).toContain(
      "Username must be between 3 and 30 characters.",
    );
  });

  test("Should allow valid username (letters, numbers, underscores)", async () => {
    const response = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "validuser@example.com",
        username: "valid_username123", // Valid format
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(302); // Expect redirect after signup

    // Follow the redirect to check flash message
    const followUp = await agent.get("/auth/login");
    expect(followUp.text).toContain(
      "Signup successful! Check your email to verify your account.",
    );

    // Verify the user is created
    const user = await User.findOne({
      where: { username: "valid_username123" },
    });
    expect(user).not.toBeNull();
    expect(user.isVerified).toBe(false);
  });

  test("Should treat usernames as case-insensitive", async () => {
    // Sign up with original casing
    const response1 = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "testcase@example.com",
        username: "CaseTest",
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response1.status).toBe(302); // Expect redirect after signup

    // Follow the redirect to check flash message
    await agent.get("/auth/login");
    // Create and verify the first user
    const user1 = await User.findOne({
      where: { email: "testcase@example.com" },
    });
    user1.isVerified = true;
    await user1.save();

    // Attempt to sign up with different casing
    const { csrfToken: csrfToken2, cookie: cookie2 } =
      await getCsrfToken("/auth/signup");

    const response2 = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie2)
      .send({
        email: "duplicate@example.com",
        username: "casetest", // Different case
        password: "StrongPass123!",
        _csrf: csrfToken2,
      });

    expect(response2.status).toBe(403); // Username should be already taken
  });

  test("Should reject username updates with invalid input", async () => {
    // Sign up
    const response1 = await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "invalidupdate@example.com",
        username: "invalidUpdateUser",
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response1.status).toBe(302); // Expect server to reject username

    // Follow the redirect to check flash message
    await agent.get("/auth/login");

    // Manually verify the user
    const user = await User.findOne({
      where: { email: "invalidupdate@example.com" },
    });
    user.isVerified = true;
    await user.save();

    // Log in
    const { csrfToken: loginCsrf, cookie: loginCookie } =
      await getCsrfToken("/auth/login");
    const response2 = await agent
      .post("/auth/login")
      .type("form")
      .set("Cookie", loginCookie)
      .send({
        identifier: "invalidUpdateUser",
        password: "StrongPass123!",
        _csrf: loginCsrf,
      });

    expect(response2.status).toBe(403);

    // Fetch CSRF token for update
    const updatePage = await agent.get("/auth/update-username");
    const updateCsrfMatch = updatePage.text.match(
      /name="_csrf" value="([^"]+)"/,
    );
    const updateCsrf = updateCsrfMatch ? updateCsrfMatch[1] : null;

    // Submit invalid update
    const response3 = await agent
      .post("/auth/update-username")
      .type("form")
      .send({
        newUsername: "bad@name!",
        _csrf: updateCsrf,
      });

    expect(response3.status).toBe(403); // Expect username to be rejected

    // Ensure the username was not changed
    const unchangedUser = await User.findOne({
      where: { email: "invalidupdate@example.com" },
    });
    expect(unchangedUser.username).toBe("invalidUpdateUser");
  });
});
