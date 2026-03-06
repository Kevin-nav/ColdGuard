export function mapInstitutionLinkError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  switch (message) {
    case "INVALID_QR_PAYLOAD":
      return "This QR code is not a valid ColdGuard institution code.";
    case "INSTITUTION_CODE_NOT_RECOGNIZED":
      return "This institution code was not recognized.";
    case "INVALID_INSTITUTION_CREDENTIALS":
      return "Staff ID or passcode is incorrect.";
    case "INACTIVE_INSTITUTION_CREDENTIAL":
      return "This nurse credential has been disabled. Contact your supervisor.";
    case "OFFLINE":
      return "You are offline. Reconnect to link your institution.";
    default:
      return "Institution link failed. Try again.";
  }
}
