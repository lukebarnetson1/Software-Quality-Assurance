beforeAll(() => {
  // Mock console.error to suppress it during tests
  jest.spyOn(console, "error").mockImplementation(() => {});
});
