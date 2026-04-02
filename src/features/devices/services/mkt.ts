import type { DeviceTelemetryReadingRecord } from "../types";

const WHO_MKT_ACTIVATION_ENERGY_KJ_PER_MOL = 83.144;
const GAS_CONSTANT_KJ_PER_MOL_K = 0.0083144;
const KELVIN_OFFSET = 273.15;

type TemperatureReading = Pick<DeviceTelemetryReadingRecord, "currentTempC">;

export function computeMeanKineticTemperatureC(temperaturesC: readonly number[]): number | null {
  const normalizedTemperatures = temperaturesC.filter((value) => Number.isFinite(value));
  if (normalizedTemperatures.length === 0) {
    return null;
  }

  const averageExponential =
    normalizedTemperatures.reduce((sum, temperatureC) => {
      const temperatureK = temperatureC + KELVIN_OFFSET;
      return sum + Math.exp(-WHO_MKT_ACTIVATION_ENERGY_KJ_PER_MOL / (GAS_CONSTANT_KJ_PER_MOL_K * temperatureK));
    }, 0) / normalizedTemperatures.length;

  const meanKineticTemperatureK =
    (WHO_MKT_ACTIVATION_ENERGY_KJ_PER_MOL / GAS_CONSTANT_KJ_PER_MOL_K) / -Math.log(averageExponential);

  return meanKineticTemperatureK - KELVIN_OFFSET;
}

export function computeMeanKineticTemperatureFromReadings(
  readings: readonly TemperatureReading[],
): number | null {
  return computeMeanKineticTemperatureC(readings.map((reading) => reading.currentTempC));
}
