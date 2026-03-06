import { api } from "../../../../convex/_generated/api";
import * as Network from "expo-network";
import { getRetryDelayMs, shouldAttemptRetry } from "../../network/network-status";
import { getConvexClient } from "../../../lib/convex/client";
import { saveClinicHandshakeToken } from "../../../lib/storage/secure-store";

const INSTITUTION_QR_PREFIX = "coldguard://institution/";

export type LinkableInstitution = {
  id: string;
  code: string;
  name: string;
  district: string | null;
  region: string | null;
};

export type InstitutionLinkResult = {
  institutionId: string;
  institutionName: string;
  handshakeToken: string;
  role: string;
  staffId: string | null;
  displayName: string | null;
};

export function parseInstitutionCode(qrValue: string) {
  if (!qrValue.startsWith(INSTITUTION_QR_PREFIX)) {
    throw new Error("INVALID_QR_PAYLOAD");
  }
  return qrValue.slice(INSTITUTION_QR_PREFIX.length);
}

async function runInstitutionLink<T>(action: () => Promise<T>) {
  const convex = getConvexClient();
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < 5) {
    try {
      const state = await Network.getNetworkStateAsync();
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (!shouldAttemptRetry(isOnline, attempt)) {
        throw new Error("OFFLINE");
      }

      return await action();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= 5) break;
      await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Institution link failed.");
}

export async function listLinkableInstitutions(): Promise<LinkableInstitution[]> {
  const convex = getConvexClient();
  return await convex.query((api as any).users.listInstitutions, {});
}

export async function linkInstitutionFromQr(args: {
  firebaseUid: string;
  qrPayload: string;
}): Promise<InstitutionLinkResult> {
  const institutionCode = parseInstitutionCode(args.qrPayload.trim());

  const result = await runInstitutionLink(async () => {
    const convex = getConvexClient();
    return await convex.mutation((api as any).users.linkInstitutionByQr, {
      firebaseUid: args.firebaseUid,
      institutionCode,
    });
  });

  await saveClinicHandshakeToken(result.handshakeToken);
  return result;
}

export async function linkInstitutionWithCredentials(args: {
  firebaseUid: string;
  institutionId: string;
  staffId: string;
  passcode: string;
}): Promise<InstitutionLinkResult> {
  const result = await runInstitutionLink(async () => {
    const convex = getConvexClient();
    return await convex.mutation((api as any).users.linkInstitutionByCredentials, {
      firebaseUid: args.firebaseUid,
      institutionId: args.institutionId as any,
      staffId: args.staffId.trim(),
      passcode: args.passcode.trim(),
    });
  });

  await saveClinicHandshakeToken(result.handshakeToken);
  return result;
}
