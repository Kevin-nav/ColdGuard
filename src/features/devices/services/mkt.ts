import type { DeviceTelemetryReadingRecord } from "../types";

const DEFAULT_ACTIVATION_ENERGY_KJ_PER_MOL = 83.144;
const GAS_CONSTANT_KJ_PER_MOL_K = 0.0083144;
const KELVIN_OFFSET = 273.15;

export function computeMeanKineticTemperatureC(
  readings: Pick<DeviceTelemetryReadingRecord, "currentTempC">[],
): number | null {
  const temperaturesK = readings
    .map((reading) => reading.currentTempC + KELVIN_OFFSET)
    .filter((temperatureK) => Number.isFinite(temperatureK) && temperatureK > 0);

  if (temperaturesK.length === 0) {
    return null;
  }

  const meanExponential =
    temperaturesK.reduce(
      (sum, temperatureK) =>
        sum + Math.exp(-DEFAULT_ACTIVATION_ENERGY_KJ_PER_MOL / (GAS_CONSTANT_KJ_PER_MOL_K * temperatureK)),
      0,
    ) / temperaturesK.length;

  if (meanExponential <= 0 || !Number.isFinite(meanExponential)) {
    return null;
  }

  const temperatureK =
    (DEFAULT_ACTIVATION_ENERGY_KJ_PER_MOL / GAS_CONSTANT_KJ_PER_MOL_K) / -Math.log(meanExponential);

  if (!Number.isFinite(temperatureK)) {
    return null;
  }

  return temperatureK - KELVIN_OFFSET;
}

export function resolveDisplayMktC(args: {
  fallbackTempC?: number | null;
  readings: Pick<DeviceTelemetryReadingRecord, "currentTempC">[];
}) {
  return computeMeanKineticTemperatureC(args.readings) ?? args.fallbackTempC ?? null;
}
