const { sequelize } = require("../models");

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
