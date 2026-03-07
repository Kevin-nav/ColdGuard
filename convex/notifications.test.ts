import { __testing } from "./notifications";

test("buildSignals prefers critical incidents when multiple conditions overlap", () => {
  const signals = __testing.buildSignals({
    institutionId: "institution" as any,
    deviceId: "device-1",
    deviceNickname: "Cold Room Alpha",
    mktStatus: "alert",
    batteryLevel: 8,
    doorOpen: true,
    lastSeenAt: 0,
    observedAt: 31 * 60_000,
  });

  expect(signals).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ incidentType: "temperature", severity: "critical" }),
      expect.objectContaining({ incidentType: "door_open", severity: "critical" }),
      expect.objectContaining({ incidentType: "device_offline", severity: "critical" }),
      expect.objectContaining({ incidentType: "battery_low", severity: "critical" }),
    ]),
  );
});

test("temperature incidents require three healthy evaluations before resolving", () => {
  const recoveryState = __testing.getRecoveryState(
    {
      incidentType: "temperature",
      healthyEvaluationStreak: 2,
    } as any,
    {
      institutionId: "institution" as any,
      deviceId: "device-1",
      deviceNickname: "Cold Room Alpha",
      mktStatus: "safe",
      batteryLevel: 50,
      doorOpen: false,
      lastSeenAt: Date.now(),
      observedAt: Date.now(),
    },
  );

  expect(recoveryState).toEqual({
    healthyEvaluationStreak: 3,
    shouldResolve: true,
  });
});

test("quiet hours handles overnight windows", () => {
  const now = new Date("2026-03-07T23:30:00Z").getTime();
  expect(__testing.isWithinQuietHours(now, "22:00", "06:00")).toBe(true);
  expect(__testing.isWithinQuietHours(now, "08:00", "17:00")).toBe(false);
  expect(__testing.parseClockMinutes("22:30")).toBe(22 * 60 + 30);
});
