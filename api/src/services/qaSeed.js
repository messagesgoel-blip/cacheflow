async function seedQARemotes() {
  // Mock provider seeds removed post sprint-6-gate-pass.
  // Keep this function as a no-op so startup wiring does not break.
  return Promise.resolve();
}

module.exports = { seedQARemotes };
