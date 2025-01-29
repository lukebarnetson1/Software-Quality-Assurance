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
  let csrfToken, cookie;

  beforeEach(async () => {
    // Fetch CSRF token from the sign-up page
    const csrfData = await getCsrfToken("/auth/signup");
    csrfToken = csrfData.csrfToken;
    cookie = csrfData.cookie;
  });

  test("Should reject usernames with prohibited characters", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "invaliduser@example.com",
        username: "invalid@name!", // Invalid characters
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Username can only contain letters, numbers, and underscores.",
    );
  });

  test("Should reject username shorter than 3 characters", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "shortuser@example.com",
        username: "ab", // Too short
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Username must be between 3 and 30 characters.",
    );
  });

  test("Should reject username longer than 30 characters", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "longuser@example.com",
        username: "a".repeat(31), // Too long
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Username must be between 3 and 30 characters.",
    );
  });

  test("Should allow valid username (letters, numbers, underscores)", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "validuser@example.com",
        username: "valid_username123", // Valid format
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain(
      "Signup successful! Please check your email to verify your account.",
    );

    // Manually verify the user
    const user = await User.findOne({
      where: { username: "valid_username123" },
    });
    expect(user).not.toBeNull();
    user.isVerified = true;
    await user.save();
  });

  test("Should treat usernames as case-insensitive", async () => {
    await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "testcase@example.com",
        username: "CaseTest",
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    const response = await request(app)
      .post("/auth/signup")
      .type("form")
      .set("Cookie", cookie)
      .send({
        email: "duplicate@example.com",
        username: "casetest", // Different case
        password: "StrongPass123!",
        _csrf: csrfToken,
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Username already in use");
  });

  test("Should allow login regardless of username casing", async () => {
    const agent = request.agent(app); // Use agent for session persistence

    // Sign up with original casing
    const { csrfToken: signupCsrf, cookie: signupCookie } =
      await getCsrfToken("/auth/signup");
    await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", signupCookie)
      .send({
        email: "caselogin@example.com",
        username: "CaseSensitive",
        password: "StrongPass123!",
        _csrf: signupCsrf,
      });

    // Manually mark user as verified
    let user = await User.findOne({
      where: { email: "caselogin@example.com" },
    });
    user.isVerified = true;
    await user.save();

    // Directly get login CSRF token with agent
    const loginPage = await agent.get("/auth/login");
    const csrfTokenMatch = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
    const loginCsrf = csrfTokenMatch[1];

    // Login with different casing
    const response = await agent.post("/auth/login").type("form").send({
      identifier: "casesensitive", // Lowercase username
      password: "StrongPass123!",
      _csrf: loginCsrf,
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/");
  });

  test("Should allow username updates with valid input", async () => {
    const agent = request.agent(app);

    // Sign up
    const { csrfToken: signupCsrf, cookie: signupCookie } =
      await getCsrfToken("/auth/signup");
    await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", signupCookie)
      .send({
        email: "update@example.com",
        username: "updatableUser",
        password: "StrongPass123!",
        _csrf: signupCsrf,
      });

    // Manually verify the user
    let user = await User.findOne({ where: { email: "update@example.com" } });
    user.isVerified = true;
    await user.save();

    // Log in
    const loginCsrf = (await agent.get("/auth/login")).text.match(
      /name="_csrf" value="([^"]+)"/,
    )[1];
    await agent.post("/auth/login").type("form").send({
      identifier: "updatableUser",
      password: "StrongPass123!",
      _csrf: loginCsrf,
    });

    // Fetch CSRF token for update
    const updateCsrf = (await agent.get("/auth/update-username")).text.match(
      /name="_csrf" value="([^"]+)"/,
    )[1];

    // Submit update
    const response = await agent
      .post("/auth/update-username")
      .type("form")
      .send({
        newUsername: "newUsername123",
        _csrf: updateCsrf,
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Username updated successfully");
  });

  test("Should reject username updates with invalid input", async () => {
    const agent = request.agent(app);

    // Sign up
    const { csrfToken: signupCsrf, cookie: signupCookie } =
      await getCsrfToken("/auth/signup");
    await agent
      .post("/auth/signup")
      .type("form")
      .set("Cookie", signupCookie)
      .send({
        email: "invalidupdate@example.com",
        username: "invalidUpdateUser",
        password: "StrongPass123!",
        _csrf: signupCsrf,
      });

    // Manually verify the user
    let user = await User.findOne({
      where: { email: "invalidupdate@example.com" },
    });
    user.isVerified = true;
    await user.save();

    // Log in
    const loginCsrf = (await agent.get("/auth/login")).text.match(
      /name="_csrf" value="([^"]+)"/,
    )[1];
    await agent.post("/auth/login").type("form").send({
      identifier: "invalidUpdateUser",
      password: "StrongPass123!",
      _csrf: loginCsrf,
    });

    // Fetch CSRF token for update
    const updateCsrf = (await agent.get("/auth/update-username")).text.match(
      /name="_csrf" value="([^"]+)"/,
    )[1];

    // Submit invalid update
    const response = await agent
      .post("/auth/update-username")
      .type("form")
      .send({
        newUsername: "bad@name!",
        _csrf: updateCsrf,
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Username can only contain letters, numbers, and underscores.",
    );
  });
});
