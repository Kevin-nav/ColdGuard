import { buildNotificationIncidentsFromDevices } from "./policy";

test("creates critical incidents for alerting devices", () => {
  const incidents = buildNotificationIncidentsFromDevices(
    "Korle-Bu Teaching Hospital",
    [
      {
        id: "device-1",
        institutionName: "Korle-Bu Teaching Hospital",
        nickname: "Cold Room Alpha",
        macAddress: "AA",
        currentTempC: 10.5,
        mktStatus: "alert",
        batteryLevel: 8,
        batteryPercentEstimate: 8,
        lastSeenAt: Date.now() - 31 * 60_000,
      },
    ],
    Date.now(),
  );

  expect(incidents.map((incident) => incident.incidentType).sort()).toEqual([
    "battery_low",
    "device_offline",
    "temperature",
  ]);
  expect(incidents.every((incident) => incident.severity === "critical")).toBe(true);
});

test("creates warning incidents for warning-state devices", () => {
  const now = Date.now();
  const incidents = buildNotificationIncidentsFromDevices(
    "Korle-Bu Teaching Hospital",
    [
      {
        id: "device-2",
        institutionName: "Korle-Bu Teaching Hospital",
        nickname: "Outreach Carrier 7",
        macAddress: "BB",
        currentTempC: 8.2,
        mktStatus: "warning",
        batteryLevel: 15,
        batteryPercentEstimate: 15,
        lastSeenAt: now - 11 * 60_000,
      },
    ],
    now,
  );

  expect(incidents.map((incident) => incident.incidentType).sort()).toEqual([
    "battery_low",
    "device_offline",
    "temperature",
  ]);
  expect(incidents.find((incident) => incident.incidentType === "temperature")?.severity).toBe("warning");
  expect(incidents.find((incident) => incident.incidentType === "device_offline")?.severity).toBe("warning");
  expect(incidents.find((incident) => incident.incidentType === "battery_low")?.severity).toBe("warning");
});
