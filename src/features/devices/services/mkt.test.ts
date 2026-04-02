import { computeMeanKineticTemperatureC, resolveDisplayMktC } from "./mkt";

test("returns the same temperature for a uniform reading set", () => {
  expect(
    computeMeanKineticTemperatureC([
      { currentTempC: 5 },
      { currentTempC: 5 },
      { currentTempC: 5 },
    ]),
  ).toBeCloseTo(5, 4);
});

test("weights warmer excursions more heavily than a simple average", () => {
  const mkt = computeMeanKineticTemperatureC([
    { currentTempC: 4 },
    { currentTempC: 4 },
    { currentTempC: 10 },
  ]);

  expect(mkt).not.toBeNull();
  expect(mkt!).toBeGreaterThan((4 + 4 + 10) / 3);
});

test("falls back to the provided raw temperature when readings are unavailable", () => {
  expect(resolveDisplayMktC({ fallbackTempC: 4.6, readings: [] })).toBe(4.6);
});
