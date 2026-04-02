import { __testing, listTelemetryBatchInternal, pullTelemetryBatch } from "./labview";

beforeEach(() => {
  process.env.CG_LABVIEW_API_KEY = "labview-shared-key";
});

afterEach(() => {
  delete process.env.CG_LABVIEW_API_KEY;
});

test("parses a LabVIEW pull request and clamps the batch size", () => {
  const request = new Request(
    "https://example.test/api/labview/telemetry/pull?deviceId=device-1&startMs=1000&endMs=2000&afterSequence=7&limit=9999",
  );

  expect(__testing.parsePullTelemetryRequest(request)).toEqual({
    afterSequence: 7,
    deviceId: "device-1",
    endMs: 2000,
    limit: 500,
    startMs: 1000,
  });
});

test("accepts the shared API key from either custom or bearer auth headers", () => {
  const customHeaderRequest = new Request("https://example.test/api/labview/telemetry/pull?deviceId=device-1", {
    headers: {
      "x-coldguard-api-key": "labview-shared-key",
    },
  });
  expect(() => __testing.assertAuthorizedLabviewRequest(customHeaderRequest)).not.toThrow();

  const bearerRequest = new Request("https://example.test/api/labview/telemetry/pull?deviceId=device-1", {
    headers: {
      Authorization: "Bearer labview-shared-key",
    },
  });
  expect(() => __testing.assertAuthorizedLabviewRequest(bearerRequest)).not.toThrow();
});

test("rejects unauthorized LabVIEW requests", () => {
  const request = new Request("https://example.test/api/labview/telemetry/pull?deviceId=device-1", {
    headers: {
      "x-coldguard-api-key": "wrong-key",
    },
  });

  expect(() => __testing.assertAuthorizedLabviewRequest(request)).toThrow("LABVIEW_UNAUTHORIZED");
});

test("returns raw telemetry rows and arrays for a requested time window", async () => {
  const ctx = createQueryCtx({
    device: {
      currentTempC: 4.7,
      deviceId: "device-1",
      lastSeenAt: 2200,
      latestSequence: 22,
      mktStatus: "safe",
      nickname: "Cold Room Alpha",
      recordedAt: 2200,
      status: "active",
      statusText: "Quick connect ready.",
    },
    readings: [
      {
        currentTempC: 4.1,
        mktStatus: "safe",
        recordedAt: 900,
        rtcIso: "2026-04-02T00:00:00Z",
        sequence: 9,
        timeSource: "rtc",
        vaccineTempC: 4.1,
      },
      {
        currentTempC: 4.3,
        mktStatus: "safe",
        recordedAt: 1200,
        rtcIso: "2026-04-02T00:05:00Z",
        sequence: 10,
        statusText: "Sample 10",
        timeSource: "rtc",
        vaccineTempC: 4.3,
      },
      {
        currentTempC: 4.5,
        mktStatus: "safe",
        recordedAt: 1800,
        rtcIso: "2026-04-02T00:10:00Z",
        sequence: 11,
        timeSource: "rtc",
        vaccineTempC: 4.5,
      },
      {
        currentTempC: 4.8,
        mktStatus: "warning",
        recordedAt: 2400,
        rtcIso: "2026-04-02T00:15:00Z",
        sequence: 12,
        timeSource: "rtc",
        vaccineTempC: 4.8,
      },
    ],
  });

  const result = await (listTelemetryBatchInternal as any)._handler(ctx, {
    afterSequence: 9,
    deviceId: "device-1",
    endMs: 2200,
    limit: 2,
    startMs: 1000,
  });

  expect(result).toMatchObject({
    deviceFound: true,
    deviceId: "device-1",
    deviceNickname: "Cold Room Alpha",
    hasMore: false,
    nextAfterSequence: 11,
    returnedCount: 2,
    sequenceArray: [10, 11],
    temperatureArrayC: [4.3, 4.5],
  });
  expect(result.rows).toEqual([
    {
      mktStatus: "safe",
      recordedAt: 1200,
      rtcIso: "2026-04-02T00:05:00Z",
      sequence: 10,
      sensorHealthJson: null,
      statusText: "Sample 10",
      temperatureC: 4.3,
      timeSource: "rtc",
    },
    {
      mktStatus: "safe",
      recordedAt: 1800,
      rtcIso: "2026-04-02T00:10:00Z",
      sequence: 11,
      sensorHealthJson: null,
      statusText: null,
      temperatureC: 4.5,
      timeSource: "rtc",
    },
  ]);
});

test("returns 401 from the HTTP action when the shared key is wrong", async () => {
  const response = await (pullTelemetryBatch as any)._handler(
    {
      runQuery: jest.fn(),
    },
    new Request("https://example.test/api/labview/telemetry/pull?deviceId=device-1", {
      headers: {
        "x-coldguard-api-key": "wrong-key",
      },
    }),
  );

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "LABVIEW_UNAUTHORIZED" });
});

test("returns the telemetry payload through the HTTP action when authorized", async () => {
  const runQuery = jest.fn().mockResolvedValue({
    deviceFound: true,
    deviceId: "device-1",
    deviceNickname: "Cold Room Alpha",
    endMs: 2000,
    hasMore: false,
    latest: {
      currentTempC: 4.5,
      lastSeenAt: 2000,
      latestSequence: 12,
      mktStatus: "safe",
      recordedAt: 2000,
      statusText: "Quick connect ready.",
    },
    nextAfterSequence: 12,
    recordedAtMsArray: [1800, 2000],
    returnedCount: 2,
    rows: [
      {
        mktStatus: "safe",
        recordedAt: 1800,
        rtcIso: "2026-04-02T00:10:00Z",
        sequence: 11,
        sensorHealthJson: null,
        statusText: null,
        temperatureC: 4.4,
        timeSource: "rtc",
      },
      {
        mktStatus: "safe",
        recordedAt: 2000,
        rtcIso: "2026-04-02T00:12:00Z",
        sequence: 12,
        sensorHealthJson: null,
        statusText: null,
        temperatureC: 4.5,
        timeSource: "rtc",
      },
    ],
    sequenceArray: [11, 12],
    startMs: 1500,
    temperatureArrayC: [4.4, 4.5],
  });

  const response = await (pullTelemetryBatch as any)._handler(
    {
      runQuery,
    },
    new Request(
      "https://example.test/api/labview/telemetry/pull?deviceId=device-1&startMs=1500&endMs=2000&afterSequence=10&limit=2",
      {
        headers: {
          "x-coldguard-api-key": "labview-shared-key",
        },
      },
    ),
  );

  expect(runQuery).toHaveBeenCalledWith(expect.anything(), {
    afterSequence: 10,
    deviceId: "device-1",
    endMs: 2000,
    limit: 2,
    startMs: 1500,
  });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    deviceId: "device-1",
    temperatureArrayC: [4.4, 4.5],
  });
});

function createQueryCtx(args: {
  device: any;
  readings: any[];
}) {
  return {
    db: {
      query: jest.fn((table: string) => ({
        withIndex: (_indexName: string, buildIndex?: (queryBuilder: any) => unknown) => {
          const indexBuilder = {
            deviceId: undefined as string | undefined,
            eq(field: string, value: unknown) {
              if (field === "deviceId") {
                this.deviceId = value as string;
              }
              return this;
            },
          };
          buildIndex?.(indexBuilder);

          if (table === "devices") {
            return {
              unique: async () => (indexBuilder.deviceId === args.device.deviceId ? args.device : null),
            };
          }

          if (table === "deviceTelemetryReadings") {
            return {
              collect: async () =>
                indexBuilder.deviceId === args.device.deviceId ? args.readings : [],
            };
          }

          throw new Error(`Unexpected query ${table}`);
        },
      })),
    },
  };
}
