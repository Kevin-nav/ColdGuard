# LabVIEW Convex Telemetry Pull

## Goal

Let LabVIEW fetch raw temperature batches directly from Convex so the VI can compute MKT and batch-safe state locally.

## Configure the shared key

Set the backend key in Convex:

```powershell
npx convex env set CG_LABVIEW_API_KEY "<shared-secret>"
```

## HTTP request

Use a `GET` request against:

```text
/api/labview/telemetry/pull
```

Headers:

- `x-coldguard-api-key: <shared-secret>`

or:

- `Authorization: Bearer <shared-secret>`

Query parameters:

- `deviceId` required
- `startMs` optional Unix epoch milliseconds lower bound
- `endMs` optional Unix epoch milliseconds upper bound
- `afterSequence` optional sequence cursor for incremental pulls
- `limit` optional batch size, clamped to `1..500`

Example:

```text
GET https://<deployment>.convex.site/api/labview/telemetry/pull?deviceId=CG-ESP32-A100&startMs=1712010000000&endMs=1712013600000&afterSequence=120&limit=120
```

## Response shape

```json
{
  "deviceId": "CG-ESP32-A100",
  "deviceNickname": "Cold Room Alpha",
  "startMs": 1712010000000,
  "endMs": 1712013600000,
  "returnedCount": 3,
  "temperatureArrayC": [4.3, 4.4, 4.6],
  "sequenceArray": [121, 122, 123],
  "recordedAtMsArray": [1712010060000, 1712010120000, 1712010180000],
  "rows": [
    {
      "sequence": 121,
      "recordedAt": 1712010060000,
      "rtcIso": "2026-04-02T03:01:00Z",
      "timeSource": "rtc",
      "temperatureC": 4.3,
      "mktStatus": "safe",
      "statusText": "Sample 121",
      "sensorHealthJson": null
    }
  ],
  "hasMore": false,
  "nextAfterSequence": 123,
  "latest": {
    "latestSequence": 123,
    "recordedAt": 1712010180000,
    "currentTempC": 4.6,
    "mktStatus": "safe",
    "statusText": "Quick connect ready.",
    "lastSeenAt": 1712010180000
  }
}
```

## LabVIEW mapping

Use `temperatureArrayC` as the direct input array for the existing MKT calculation VI. Use `nextAfterSequence` to store the last processed cursor for the next incremental request.
