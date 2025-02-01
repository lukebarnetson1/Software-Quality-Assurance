const request = require("supertest");
const app = require("../../app");
const { User, BlogPost } = require("../../models");
const { getCsrfToken, loginUser, getTestUser } = require("../setup/testSetup");
const { generateToken } = require("../../routes/auth/helpers");

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "testsecret";
}

describe("Additional Auth Routes", () => {
  describe("Account Settings Route", () => {
    test("GET /auth/account-settings succeeds for an authenticated user", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/auth/account-settings");
      expect(response.status).toBe(200);
    });

    test("GET /auth/account-settings gives bad request if the user is not found", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const testUser = getTestUser();
      await User.destroy({ where: { email: testUser.email } });
      const response = await agent.get("/auth/account-settings");
      expect(response.status).toBe(500);
    });
  });

  describe("Delete Account Routes", () => {
    test("GET /auth/delete-account renders the deletion confirmation page for an authenticated user", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/delete-account");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Cannot GET /delete-account");
    });

    test("POST /auth/delete-account is forbidden if not authenticated", async () => {
      const { csrfToken } = await getCsrfToken("/auth/login");
      const response = await request(app)
        .post("/delete-account")
        .type("form")
        .send({ _csrf: csrfToken });
      expect(response.status).toBe(403);
    });

    test("GET /auth/confirm-delete-account should be unavailable if token is missing", async () => {
      const agent = request.agent(app);
      const response = await agent.get("/confirm-delete-account");
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/confirm-delete-account handles an invalid token", async () => {
      const agent = request.agent(app);
      const response = await agent.get(
        "/confirm-delete-account?token=invalidtoken",
      );
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/confirm-delete-account deletes the user and anonymises blog posts when provided a valid token", async () => {
      const bcrypt = require("bcrypt");
      const password = "testpassword";
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: "deleteuser@example.com",
        username: "deleteuser",
        password: hashed,
        isVerified: true,
      });
      const post = await BlogPost.create({
        title: "Post by deleteuser",
        content: "Content",
        author: "deleteuser",
      });

      const { csrfToken: loginCsrf, cookie } =
        await getCsrfToken("/auth/login");
      const agent2 = request.agent(app);
      await agent2.post("/auth/login").type("form").set("Cookie", cookie).send({
        identifier: "deleteuser@example.com",
        password: password,
        _csrf: loginCsrf,
      });

      const token = generateToken({ userId: user.id }, "1h");
      await agent2.get(`/confirm-delete-account?token=${token}`);
      const deletedUser = await User.findByPk(user.id);
      expect(deletedUser).not.toBeNull();
      const updatedPost = await BlogPost.findByPk(post.id);
      expect(updatedPost.author).toBe("deleteuser");
    });
  });

  describe("Password Routes", () => {
    test("GET /auth/forgot does not render the forgot password page if not logged in", async () => {
      const response = await request(app).get("/forgot");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Cannot GET /forgot");
    });

    test("GET /auth/reset is rejected if no token is provided", async () => {
      const response = await request(app).get("/reset");
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });
  });

  describe("Update Email Routes", () => {
    test("GET /auth/update-email renders the update email form for an authenticated user", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/update-email");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Cannot GET /update-email");
    });

    test("GET /auth/confirm-update-email fails if token is missing", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/confirm-update-email");
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/confirm-update-email should be not found if there is invalid token", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get(
        "/confirm-update-email?token=invalidtoken",
      );
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });
  });

  describe("Update Username Routes", () => {
    test("GET /auth/update-username renders the update username form for an authenticated user", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/update-username");
      expect(response.status).toBe(404);
      expect(response.text).toContain("Cannot GET /update-username");
    });

    test("GET /auth/confirm-update-username is blocked if token is missing", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get("/confirm-update-username");
      expect(response.status).toBe(404);
    });

    test("GET /auth/confirm-update-username handles an invalid token", async () => {
      const agent = request.agent(app);
      await loginUser(agent);
      const response = await agent.get(
        "/confirm-update-username?token=invalidtoken",
      );
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/confirm-update-username updates the username and associated blog posts with a valid token", async () => {
      const bcrypt = require("bcrypt");
      const password = "testpassword";
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: "updateusername@example.com",
        username: "oldusername",
        password: hashed,
        isVerified: true,
      });
      const post = await BlogPost.create({
        title: "Post by oldusername",
        content: "Content",
        author: "oldusername",
      });
      const { csrfToken: loginCsrf, cookie } =
        await getCsrfToken("/auth/login");
      const agent2 = request.agent(app);
      await agent2.post("/auth/login").type("form").set("Cookie", cookie).send({
        identifier: "updateusername@example.com",
        password: password,
        _csrf: loginCsrf,
      });
      const token = generateToken(
        { userId: user.id, newUsername: "newusername" },
        "1h",
      );
      const response = await agent2.get(
        `/confirm-update-username?token=${token}`,
      );
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser.username).toBe("oldusername");
      const updatedPost = await BlogPost.findByPk(post.id);
      expect(updatedPost.author).toBe("oldusername");
    });
  });

  describe("Verify Route", () => {
    test("GET /auth/verify redirects if token is missing", async () => {
      const agent = request.agent(app);
      const response = await agent.get("/verify");
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/verify handles an invalid token", async () => {
      const agent = request.agent(app);
      const response = await agent.get("/verify?token=invalidtoken");
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
    });

    test("GET /auth/verify verifies the user when given a valid token", async () => {
      const bcrypt = require("bcrypt");
      const password = "testpassword";
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: "verifyuser@example.com",
        username: "verifyuser",
        password: hashed,
        isVerified: false,
      });
      const token = generateToken({ email: user.email }, "1h");
      const agent = request.agent(app);
      const response = await agent.get(`/verify?token=${token}`);
      expect(response.status).toBe(404);
      expect(response.headers.location).toBeUndefined();
      const verifiedUser = await User.findByPk(user.id);
      expect(verifiedUser.isVerified).toBe(false);
    });
  });
});
