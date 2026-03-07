export type AuthStage =
  | "signed_out"
  | "signed_in_unlinked"
  | "ready";

type AuthStateInput = {
  firebaseUser: {
    uid: string;
  } | null;
  isInstitutionLinked: boolean;
};

export function deriveAuthStage(input: AuthStateInput): AuthStage {
  if (!input.firebaseUser) return "signed_out";
  if (!input.isInstitutionLinked) return "signed_in_unlinked";

  return "ready";
}
