/**
 * Tests for Plasmic code component registration
 * 
 * Validates that the registration module can be imported and handles repeated imports.
 */
describe("Plasmic Code Components Registration", () => {
  it("should have valid registration module that can be imported", () => {
    // Verify the registration file exists and loads without errors
    expect(() => {
      // Just require the module - if it throws, test fails
      require("../../../lib/plasmic/registerCodeComponents");
    }).not.toThrow();
  });

  it("should handle repeated side-effect imports safely", () => {
    // First import
    expect(() => {
      require("../../../lib/plasmic/registerCodeComponents");
    }).not.toThrow();
    
    // Reset modules to force fresh import
    jest.resetModules();
    
    // Second import should also not throw
    expect(() => {
      require("../../../lib/plasmic/registerCodeComponents");
    }).not.toThrow();
  });
});
