// jest.setup.js
beforeAll(() => {
  // Mock console.error to suppress it during tests
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  // Restore console.error after tests
  console.error.mockRestore();
});
