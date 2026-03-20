export const SITE_URL = "https://coldguard.org";

export const SITE_OPERATOR = {
  name: "ColdGuard",
  teamDescription:
    "Student team from the University of Mines and Technology in Tarkwa, Western Region, Ghana",
  contactEmails: ["rexbabel48@gmail.com", "nchorkevin3@gmail.com"],
} as const;

export type DeviceLinkParams = {
  claim?: string;
  deviceId?: string;
  version?: string;
};

export function normalizeQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildCanonicalDeviceUrl({
  claim,
  deviceId,
  version,
}: DeviceLinkParams): string {
  const safeDeviceId = deviceId?.trim();
  if (!safeDeviceId) {
    return `${SITE_URL}/device`;
  }

  const url = new URL(`/device/${encodeURIComponent(safeDeviceId)}`, SITE_URL);

  if (claim) {
    url.searchParams.set("claim", claim);
  }

  if (version) {
    url.searchParams.set("v", version);
  }

  return url.toString();
}

export function buildAppDeviceUrl({
  claim,
  deviceId,
  version,
}: DeviceLinkParams): string {
  const safeDeviceId = deviceId?.trim();
  if (!safeDeviceId) {
    return "coldguard://device";
  }

  const params = new URLSearchParams();
  if (claim) {
    params.set("claim", claim);
  }
  if (version) {
    params.set("v", version);
  }

  const suffix = params.toString();
  const path = `coldguard://device/${encodeURIComponent(safeDeviceId)}`;
  return suffix ? `${path}?${suffix}` : path;
}
