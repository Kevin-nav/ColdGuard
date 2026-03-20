import type { Metadata } from "next";
import { LegalPage } from "../../components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the ColdGuard privacy policy covering account data, Google sign-in information, device telemetry, data sharing, retention, and contact information.",
  alternates: {
    canonical: "/privacy",
  },
};

const LAST_UPDATED = "March 6, 2026";

export default function Privacy() {
  return (
    <LegalPage
      lastUpdated={LAST_UPDATED}
      summary="This page explains what information ColdGuard collects, how we use Google Sign-In and device data, when information may be shared, and how to contact the team about privacy questions."
      title="Privacy Policy"
    >
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
              <p>
                ColdGuard is a vaccine cold-chain monitoring platform operated
                by a student team from the University of Mines and Technology in
                Tarkwa, Ghana. This Privacy Policy describes how we collect,
                use, store, and share information when you visit `coldguard.org`
                , use the ColdGuard mobile app, or interact with a ColdGuard
                device enrollment link.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Privacy at a Glance</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  We collect only the account, device, and operational data
                  needed to authenticate users and run the ColdGuard service.
                </li>
                <li>
                  If you use Google Sign-In, we receive basic account
                  information needed to identify you and let you access the
                  service.
                </li>
                <li>
                  We do not sell Google user data or personal information.
                </li>
                <li>
                  We may share data with infrastructure providers, linked
                  institutions, and legal authorities only when needed to
                  operate or protect the service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Information We Collect</h2>
              <p className="mb-4">
                We may collect the following categories of information:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account and sign-in data:</strong>
                  {" "}
                  name, email address, profile identifier, and authentication
                  details provided through Google Sign-In and Firebase
                  Authentication.
                </li>
                <li>
                  <strong>Hardware and telemetry data:</strong>
                  {" "}
                  Mean Kinetic Temperature (MKT) readings, power status, battery
                  state, door events, timestamps, and synchronization events
                  from the ColdGuard monitoring device.
                </li>
                <li>
                  <strong>Institutional and operational data:</strong>
                  {" "}
                  the clinic, school, health facility, or institution linked to
                  your account, plus related monitoring records.
                </li>
                <li>
                  <strong>Technical usage data:</strong>
                  {" "}
                  limited browser, device, and diagnostic information needed to
                  secure the service, troubleshoot issues, and improve
                  reliability.
                </li>
                <li>
                  <strong>Communications:</strong>
                  {" "}
                  information you provide when you contact us directly.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                4. How We Use Information
              </h2>
              <p className="mb-4">We use information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>authenticate users and manage access to the platform;</li>
                <li>
                  associate users with the correct institution or monitoring
                  environment;
                </li>
                <li>
                  synchronize hardware logs and temperature records with the
                  dashboard;
                </li>
                <li>
                  notify users of operational issues, safety concerns, or
                  service updates;
                </li>
                <li>
                  secure, maintain, and improve the performance of the project;
                </li>
                <li>comply with legal obligations when required.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                5. Google Sign-In and Authentication
              </h2>
              <p>
                If you sign in with Google, ColdGuard receives basic account
                information necessary to identify you and operate your account,
                such as your name, email address, and authentication tokens or
                identifiers processed through Firebase Authentication. We use
                this information only to authenticate you, provide access to the
                service, link your account to institutional records, and secure
                platform. We do not sell your Google account information, and we
                do not use it for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                6. Data Sharing and Disclosure
              </h2>
              <p className="mb-4">
                We do not sell personal information. We may share data only in
                the following limited circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  with the institution, organization, or authorized
                  administrators connected to your account so they can review
                  monitoring records;
                </li>
                <li>
                  with service providers that help us operate the platform, such
                  as authentication, hosting, storage, and synchronization
                  infrastructure;
                </li>
                <li>
                  when disclosure is required by law, regulation, legal process,
                  or valid governmental request;
                </li>
                <li>
                  when necessary to protect the safety, rights, or integrity of
                  users, institutions, or the ColdGuard platform.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Data Retention</h2>
              <p>
                We retain information for as long as reasonably necessary to
                operate the platform, maintain institutional monitoring records,
                support troubleshooting, meet academic project requirements, and
                comply with applicable legal obligations. Retention periods may
                vary depending on the type of information and the needs of the
                associated institution or project deployment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Data Security</h2>
              <p>
                We use reasonable administrative, technical, and organizational
                measures to protect information, including authenticated access,
                managed cloud services, and controlled synchronization workflows.
                However, no method of transmission or storage is completely
                secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                9. Children&apos;s Privacy
              </h2>
              <p>
                ColdGuard is not intended for unsupervised use by children. We
                do not knowingly collect personal information directly from
                children for consumer use. If you believe information has been
                provided to us in error, contact us and we will review the
                request.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                10. International Access
              </h2>
              <p>
                ColdGuard may be accessed from different countries. By using the
                platform, you understand that information may be processed in
                systems or services operated outside your local jurisdiction,
                subject to the safeguards and practices described in this
                policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Your Choices</h2>
              <p>
                You may contact us to request account assistance, correction of
                inaccurate information, or deletion review where appropriate and
                technically feasible. Some information may need to be retained
                for security, institutional, or legal reasons.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                12. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect
                changes in the platform, project scope, legal obligations, or
                operational practices. The updated version will be posted on
                this page with a revised last-updated date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">13. Contact</h2>
              <p className="mb-4">
                Questions about this Privacy Policy or how information is
                handled may be sent to either of the public ColdGuard contacts
                below.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <a
                    href="mailto:rexbabel48@gmail.com"
                    className="text-primary hover:text-primary-pressed underline underline-offset-4"
                  >
                    rexbabel48@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:nchorkevin3@gmail.com"
                    className="text-primary hover:text-primary-pressed underline underline-offset-4"
                  >
                    nchorkevin3@gmail.com
                  </a>
                </li>
              </ul>
            </section>
    </LegalPage>
  );
}
