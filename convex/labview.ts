import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalQuery } from "./_generated/server";

const DEFAULT_PULL_LIMIT = 120;
const MAX_PULL_LIMIT = 500;
const LABVIEW_API_KEY_ENV = "CG_LABVIEW_API_KEY";
const LABVIEW_API_KEY_HEADER = "x-coldguard-api-key";

type TelemetryRowDoc = {
  currentTempC?: number;
  mktStatus: "safe" | "warning" | "alert";
  recordedAt: number;
  rtcIso: string;
  sequence: number;
  sensorHealthJson?: string;
  statusText?: string;
  timeSource: string;
  vaccineTempC?: number;
};

function clampPullLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_PULL_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_PULL_LIMIT);
}

function getPresentedLabviewApiKey(request: Request) {
  const headerValue = request.headers.get(LABVIEW_API_KEY_HEADER)?.trim();
  if (headerValue) {
    return headerValue;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";
  if (authorization.startsWith(bearerPrefix)) {
    const token = authorization.slice(bearerPrefix.length).trim();
    return token || null;
  }

  return null;
}

function assertAuthorizedLabviewRequest(request: Request) {
  const expectedApiKey = process.env[LABVIEW_API_KEY_ENV]?.trim();
  if (!expectedApiKey) {
    throw new Error("LABVIEW_API_KEY_NOT_CONFIGURED");
  }

  if (getPresentedLabviewApiKey(request) !== expectedApiKey) {
    throw new Error("LABVIEW_UNAUTHORIZED");
  }
}

function parseOptionalInteger(value: string | null, name: string) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`LABVIEW_INVALID_${name.toUpperCase()}`);
  }

  return parsed;
}

function parsePullTelemetryRequest(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId")?.trim() ?? "";
  if (!deviceId) {
    throw new Error("LABVIEW_DEVICE_ID_REQUIRED");
  }

  const startMs = parseOptionalInteger(url.searchParams.get("startMs"), "start_ms");
  const endMs = parseOptionalInteger(url.searchParams.get("endMs"), "end_ms");
  const afterSequence = parseOptionalInteger(url.searchParams.get("afterSequence"), "after_sequence");
  const limit = clampPullLimit(parseOptionalInteger(url.searchParams.get("limit"), "limit"));

  if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
    throw new Error("LABVIEW_INVALID_TIME_RANGE");
  }

  return {
    afterSequence,
    deviceId,
    endMs,
    limit,
    startMs,
  };
}

function toLabviewRow(row: TelemetryRowDoc) {
  const temperatureC =
    typeof row.vaccineTempC === "number"
      ? row.vaccineTempC
      : typeof row.currentTempC === "number"
        ? row.currentTempC
        : null;

  if (temperatureC === null) {
    return null;
  }

  return {
    mktStatus: row.mktStatus,
    recordedAt: row.recordedAt,
    rtcIso: row.rtcIso,
    sequence: row.sequence,
    sensorHealthJson: row.sensorHealthJson ?? null,
    statusText: row.statusText ?? null,
    temperatureC,
    timeSource: row.timeSource,
  };
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}

export const listTelemetryBatchInternal = internalQuery({
  args: {
    afterSequence: v.optional(v.number()),
    deviceId: v.string(),
    endMs: v.optional(v.number()),
    limit: v.optional(v.number()),
    startMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
      .unique();

    if (!device) {
      return {
        deviceFound: false,
        deviceId: args.deviceId,
      };
    }

    const limit = clampPullLimit(args.limit);
    const readings = ((await ctx.db
      .query("deviceTelemetryReadings")
      .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
      .collect()) as TelemetryRowDoc[]).sort((left, right) => left.sequence - right.sequence);

    const filtered = readings.filter((reading) => {
      if (typeof args.afterSequence === "number" && reading.sequence <= args.afterSequence) {
        return false;
      }
      if (typeof args.startMs === "number" && reading.recordedAt < args.startMs) {
        return false;
      }
      if (typeof args.endMs === "number" && reading.recordedAt > args.endMs) {
        return false;
      }
      return true;
    });

    const rows = filtered
      .slice(0, limit)
      .map(toLabviewRow)
      .filter((row): row is NonNullable<ReturnType<typeof toLabviewRow>> => Boolean(row));

    const nextAfterSequence = rows.length > 0 ? rows[rows.length - 1]?.sequence ?? null : args.afterSequence ?? null;

    return {
      deviceFound: true,
      deviceId: args.deviceId,
      deviceNickname: device.nickname ?? args.deviceId,
      endMs: args.endMs ?? null,
      hasMore: filtered.length > rows.length,
      latest: {
        currentTempC: device.currentTempC ?? null,
        lastSeenAt: device.lastSeenAt ?? null,
        latestSequence: device.latestSequence ?? null,
        mktStatus: device.mktStatus ?? null,
        recordedAt: device.recordedAt ?? null,
        statusText: device.statusText ?? null,
      },
      nextAfterSequence,
      recordedAtMsArray: rows.map((row) => row.recordedAt),
      returnedCount: rows.length,
      rows,
      sequenceArray: rows.map((row) => row.sequence),
      startMs: args.startMs ?? null,
      temperatureArrayC: rows.map((row) => row.temperatureC),
    };
  },
});

export const pullTelemetryBatch = httpAction(async (ctx, request) => {
  try {
    assertAuthorizedLabviewRequest(request);
    const args = parsePullTelemetryRequest(request);
    const payload = await ctx.runQuery(internal.labview.listTelemetryBatchInternal, args);

    if (!payload.deviceFound) {
      return jsonResponse(404, {
        deviceId: args.deviceId,
        error: "DEVICE_NOT_FOUND",
      });
    }

    return jsonResponse(200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LABVIEW_PULL_FAILED";
    if (message === "LABVIEW_UNAUTHORIZED") {
      return jsonResponse(401, { error: message });
    }
    if (
      message === "LABVIEW_API_KEY_NOT_CONFIGURED" ||
      message === "LABVIEW_DEVICE_ID_REQUIRED" ||
      message === "LABVIEW_INVALID_AFTER_SEQUENCE" ||
      message === "LABVIEW_INVALID_END_MS" ||
      message === "LABVIEW_INVALID_LIMIT" ||
      message === "LABVIEW_INVALID_START_MS" ||
      message === "LABVIEW_INVALID_TIME_RANGE"
    ) {
      return jsonResponse(400, { error: message });
    }

    console.error("LabVIEW telemetry pull failed.", {
      error: message,
      url: request.url,
    });
    return jsonResponse(500, { error: "LABVIEW_PULL_FAILED" });
  }
});

export const __testing = {
  assertAuthorizedLabviewRequest,
  clampPullLimit,
  getPresentedLabviewApiKey,
  parsePullTelemetryRequest,
  toLabviewRow,
};
