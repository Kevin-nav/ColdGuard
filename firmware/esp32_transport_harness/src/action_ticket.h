#pragma once

#include <Arduino.h>

#include "device_state.h"

namespace coldguard {

String hmacSha256Hex(const String& key, const String& payload);
bool verifyActionTicket(
  const String& actionTicketJson,
  const DeviceState& state,
  const String& expectedInstitutionId,
  const String& expectedAction,
  long long proofTimestampMs,
  unsigned long proofWindowMs,
  const char* actionTicketMasterKey,
  uint32_t* nextGrantVersion);
bool verifyHandshakeProofWithToken(
  const String& sessionHandshakeToken,
  const DeviceState& state,
  const String& proof,
  long long timestampMs,
  unsigned long proofWindowMs);
bool verifyHandshakeProof(
  const DeviceState& state,
  const String& proof,
  long long timestampMs,
  unsigned long proofWindowMs);

}  // namespace coldguard
