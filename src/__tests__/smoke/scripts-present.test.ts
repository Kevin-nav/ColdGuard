const pkg = require("../../../package.json");

test("required scripts exist", () => {
  expect(pkg.scripts).toHaveProperty("test");
  expect(pkg.scripts).toHaveProperty("start");
  expect(pkg.scripts).toHaveProperty("lint");
});
