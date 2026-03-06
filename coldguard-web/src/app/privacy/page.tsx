import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary hover:text-primary-pressed font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="bg-surface rounded-2xl shadow-card border border-border p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-6">
            Privacy Policy
          </h1>
          <p className="text-foreground-secondary mb-2">
            Operator: ColdGuard
          </p>
          <p className="text-foreground-secondary mb-2">
            Website: coldguard.org
          </p>
          <p className="text-foreground-secondary mb-8">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="space-y-8 text-foreground leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
              <p>
                This Privacy Policy explains how ColdGuard collects, uses,
                stores, and shares information when you visit
                {" "}
                coldguard.org
                {" "}
                or use the ColdGuard platform. ColdGuard is a student-led
                university project focused on vaccine cold-chain monitoring and
                system reliability. By using the website or platform, you
                acknowledge the practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                2. Information We Collect
              </h2>
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
                3. How We Use Information
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
                4. Google Sign-In and Authentication
              </h2>
              <p>
                If you sign in with Google, ColdGuard receives basic account
                information necessary to identify you and operate your account,
                such as your name, email address, and authentication tokens or
                identifiers processed through Firebase Authentication. We use
                this information only to authenticate you, provide access to the
                service, link your account to institutional records, and secure
                the platform. We do not sell your Google account information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                5. Data Sharing and Disclosure
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
              <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
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
              <h2 className="text-2xl font-bold mb-4">7. Data Security</h2>
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
                8. Children&apos;s Privacy
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
                9. International Access
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
              <h2 className="text-2xl font-bold mb-4">10. Your Choices</h2>
              <p>
                You may contact us to request account assistance, correction of
                inaccurate information, or deletion review where appropriate and
                technically feasible. Some information may need to be retained
                for security, institutional, or legal reasons.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                11. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect
                changes in the platform, project scope, legal obligations, or
                operational practices. The updated version will be posted on
                this page with a revised last-updated date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">12. Contact</h2>
              <p>
                If you have questions about this Privacy Policy or how
                information is handled, contact ColdGuard at
                {" "}
                <a
                  href="mailto:rexbabel48@gmail.com"
                  className="text-primary hover:text-primary-pressed underline underline-offset-4"
                >
                  rexbabel48@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
