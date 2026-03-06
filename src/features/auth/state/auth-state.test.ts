import { deriveAuthStage } from "./auth-state";

test("signed-in and unlinked user goes to onboarding", () => {
  const stage = deriveAuthStage({
    firebaseUser: { uid: "u1" } as any,
    isInstitutionLinked: false,
  });
  expect(stage).toBe("signed_in_unlinked");
});

test("verified and institution-linked user is ready", () => {
  const stage = deriveAuthStage({
    firebaseUser: { uid: "u1" } as any,
    isInstitutionLinked: true,
  });
  expect(stage).toBe("ready");
});
