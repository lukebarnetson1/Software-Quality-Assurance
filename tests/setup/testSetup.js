const request = require("supertest");
const app = require("../../app");
const { sequelize } = require("../../models");

beforeAll(async () => {
  await sequelize.sync({ force: true }); // Reset database schema
});

afterAll(async () => {
  await sequelize.close(); // Close database connection
});

beforeEach(async () => {
  const models = sequelize.models;

  for (const modelName in models) {
    await models[modelName].destroy({ where: {}, truncate: true }); // Clear all tables
  }
});

async function getCsrfToken(route = "/create") {
  const response = await request(app).get(route);
  const csrfTokenMatch = response.text.match(/name="_csrf" value="([^"]+)"/);
  if (!csrfTokenMatch) {
    throw new Error(`Failed to extract CSRF token from route: ${route}`);
  }
  const csrfToken = csrfTokenMatch[1];
  const cookie = response.headers["set-cookie"];
  return { csrfToken, cookie };
}

module.exports = { getCsrfToken };
