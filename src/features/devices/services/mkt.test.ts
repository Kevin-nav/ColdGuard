import { computeMeanKineticTemperatureC, computeMeanKineticTemperatureFromReadings } from "./mkt";

test("returns null when no temperatures are provided", () => {
  expect(computeMeanKineticTemperatureC([])).toBeNull();
});

test("returns the same temperature for a constant series", () => {
  expect(computeMeanKineticTemperatureC([4, 4, 4])).toBeCloseTo(4, 6);
});

test("weights higher temperatures more heavily than a simple average", () => {
  expect(computeMeanKineticTemperatureC([2, 8])).toBeCloseTo(5.536424508866389, 6);
});

test("computes MKT from raw reading records", () => {
  expect(
    computeMeanKineticTemperatureFromReadings([
      { currentTempC: 4.0 },
      { currentTempC: 5.0 },
      { currentTempC: 6.0 },
    ]),
  ).toBeCloseTo(5.040628382322154, 6);
});
