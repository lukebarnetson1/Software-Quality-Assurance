const request = require("supertest");
const app = require("../../app");
const { sequelize, User } = require("../../models");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Module-level variable to store test user info
let testUser = {};

// Reset the database before all tests
beforeAll(async () => {
  await sequelize.sync({ force: true }); // Drops and recreates all tables
});

// Close the database connection after all tests
afterAll(async () => {
  await sequelize.close();
});

// Reset data and create a test user before each test
beforeEach(async () => {
  const models = sequelize.models;

  // Clear all tables
  for (const modelName in models) {
    await models[modelName].destroy({ where: {}, truncate: true });
  }

  // Generate a unique test user for this test run
  const uniqueEmail = `testuser_${uuidv4()}@example.com`;
  const uniqueUsername = `testuser_${uuidv4().slice(0, 8)}`;

  const hashedPassword = await bcrypt.hash("testpassword", 10);
  await User.create({
    email: uniqueEmail,
    username: uniqueUsername,
    password: hashedPassword,
    isVerified: true,
  });

  // Store the test user's info
  testUser = {
    email: uniqueEmail,
    username: uniqueUsername,
  };
});

/**
 * Helper function to log in the test user.
 * @param {object} agent - Supertest agent.
 */
async function loginUser(agent) {
  // Fetch the login page to get the CSRF token
  const loginPage = await agent.get("/auth/login");

  // Check if the response is 200 or 302
  expect([200, 302]).toContain(loginPage.status);

  const csrfTokenMatch = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
  const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

  if (!csrfToken) {
    throw new Error("Failed to extract CSRF token from login page.");
  }

  // Perform login using the test user's email
  const response = await agent.post("/auth/login").type("form").send({
    identifier: testUser.email, // Use testUser.email
    password: "testpassword",
    _csrf: csrfToken,
  });

  // Allow either 200 or 302 for successful login
  expect([200, 302]).toContain(response.status);
}

/**
 * Helper function to fetch a valid CSRF token from a specified authenticated route.
 * @param {object} agent - Supertest agent.
 * @param {string} route - The route to fetch the CSRF token from.
 * @returns {string} - The CSRF token.
 */
async function getAuthenticatedCsrfToken(agent, route = "/create") {
  const response = await agent.get(route);
  expect([200, 302]).toContain(response.status);

  const csrfTokenMatch = response.text.match(/name="_csrf" value="([^"]+)"/);
  const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

  if (!csrfToken) {
    throw new Error(`Failed to extract CSRF token from route: ${route}`);
  }

  return csrfToken;
}

/**
 * Helper function to fetch a CSRF token from an unauthenticated route.
 * @param {string} route - The route to fetch the CSRF token from (default: "/auth/login").
 * @returns {object} - { csrfToken, cookie }
 */
async function getCsrfToken(route = "/auth/login") {
  const response = await request(app).get(route);
  expect([200, 302]).toContain(response.status);

  const csrfTokenMatch = response.text.match(/name="_csrf" value="([^"]+)"/);
  const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

  if (!csrfToken) {
    throw new Error(`Failed to extract CSRF token from route: ${route}`);
  }

  // Join cookies to format correctly for headers
  const cookie = response.headers["set-cookie"].join("; ");
  return { csrfToken, cookie };
}

// Export testUser for reference in tests if needed
function getTestUser() {
  return testUser;
}

module.exports = {
  getAuthenticatedCsrfToken,
  loginUser,
  getCsrfToken,
  getTestUser,
};
