import { internalMutation } from "./_generated/server";
import { hashInstitutionPasscode } from "./passcodes";

const DEMO_INSTITUTIONS = [
  {
    code: "korlebu-demo",
    name: "Korle-Bu Teaching Hospital",
    district: "Ablekuma South",
    region: "Greater Accra",
    secretKey: "KGH-DEMO-01",
    handshakeToken: "handshake-korlebu-demo",
    credentials: [
      {
        staffId: "KB1001",
        passcode: "482913",
        displayName: "Akosua Mensah",
        role: "Nurse",
      },
      {
        staffId: "KB1002",
        passcode: "517204",
        displayName: "Yaw Boateng",
        role: "Supervisor",
      },
    ],
  },
  {
    code: "tamale-demo",
    name: "Tamale Central Hospital",
    district: "Tamale South",
    region: "Northern",
    secretKey: "TCH-DEMO-02",
    handshakeToken: "handshake-tamale-demo",
    credentials: [
      {
        staffId: "TM2001",
        passcode: "203844",
        displayName: "Mariam Fuseini",
        role: "Nurse",
      },
      {
        staffId: "TM2002",
        passcode: "691325",
        displayName: "Ibrahim Zakaria",
        role: "Supervisor",
      },
    ],
  },
  {
    code: "ho-demo",
    name: "Ho Municipal Clinic",
    district: "Ho",
    region: "Volta",
    secretKey: "HMC-DEMO-03",
    handshakeToken: "handshake-ho-demo",
    credentials: [
      {
        staffId: "HO3001",
        passcode: "774201",
        displayName: "Gifty Adzo",
        role: "Nurse",
      },
      {
        staffId: "HO3002",
        passcode: "188640",
        displayName: "Kojo Afi",
        role: "Supervisor",
      },
    ],
  },
] as const;

export const seedDemoInstitutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seeded = [];

    for (const institution of DEMO_INSTITUTIONS) {
      let existingInstitution = await ctx.db
        .query("institutions")
        .withIndex("by_code", (q) => q.eq("code", institution.code))
        .unique();

      const institutionId =
        existingInstitution?._id ??
        (await ctx.db.insert("institutions", {
          code: institution.code,
          name: institution.name,
          district: institution.district,
          region: institution.region,
          secretKey: institution.secretKey,
          handshakeToken: institution.handshakeToken,
        }));

      if (!existingInstitution) {
        existingInstitution = await ctx.db.get(institutionId);
      }

      for (const credential of institution.credentials) {
        const existingCredential = await ctx.db
          .query("institutionCredentials")
          .withIndex("by_institution_staff_id", (q) =>
            q.eq("institutionId", institutionId).eq("staffId", credential.staffId),
          )
          .unique();

        if (!existingCredential) {
          await ctx.db.insert("institutionCredentials", {
            institutionId,
            staffId: credential.staffId,
            passcode: await hashInstitutionPasscode(credential.passcode),
            displayName: credential.displayName,
            role: credential.role,
            isActive: true,
          });
        } else {
          await ctx.db.patch(existingCredential._id, {
            passcode: await hashInstitutionPasscode(credential.passcode),
            displayName: credential.displayName,
            role: credential.role,
            isActive: true,
          });
        }
      }

      seeded.push({
        code: institution.code,
        name: institution.name,
        credentialCount: institution.credentials.length,
      });
    }

    return {
      institutionCount: seeded.length,
      seeded,
    };
  },
});
