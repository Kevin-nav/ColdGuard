import { httpRouter } from "convex/server";
import { pullTelemetryBatch } from "./labview";

const http = httpRouter();

http.route({
  path: "/api/labview/telemetry/pull",
  method: "GET",
  handler: pullTelemetryBatch,
});

export default http;
