const { initialiseModels, sequelize } = require("../../models");

describe("Model Initialisation", () => {
  let originalReset;

  beforeAll(() => {
    // Save the original value of RESET_DB
    originalReset = process.env.RESET_DB;
  });

  afterAll(async () => {
    // Restore original environment variable
    process.env.RESET_DB = originalReset;
    // Close the sequelize connection if not already closed
    if (sequelize) {
      await sequelize.close();
    }
  });

  test("initialiseModels resets the DB when RESET_DB is true", async () => {
    process.env.RESET_DB = "true";
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await initialiseModels();
    expect(logSpy).toHaveBeenCalledWith(
      "Database reset and re-synchronised successfully.",
    );
    logSpy.mockRestore();
  });

  test("initialiseModels synchronises the DB when RESET_DB is not true", async () => {
    process.env.RESET_DB = "false";
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await initialiseModels();
    expect(logSpy).toHaveBeenCalledWith("Database synchronised successfully.");
    logSpy.mockRestore();
  });

  test("initialiseModels handles sync errors gracefully", async () => {
    // Force an error by mocking sequelize.sync to reject
    const syncSpy = jest
      .spyOn(sequelize, "sync")
      .mockRejectedValue(new Error("Sync error"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await initialiseModels();
    expect(errorSpy).toHaveBeenCalledWith(
      "Error syncing the database:",
      expect.any(Error),
    );
    // Restore original implementations
    syncSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
