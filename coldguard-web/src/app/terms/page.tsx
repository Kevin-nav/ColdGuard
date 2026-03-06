import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the ColdGuard terms of service covering acceptable use, student-project status, account responsibilities, service availability, and disclaimers.",
  alternates: {
    canonical: "/terms",
  },
};

const LAST_UPDATED = "March 6, 2026";

export default function Terms() {
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
            Terms of Service
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
              <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the ColdGuard website or platform, you
                agree to these Terms of Service. If you do not agree, do not use
                the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. About ColdGuard</h2>
              <p>
                ColdGuard is a student-led university project built to support
                cold-chain monitoring for vaccines and medical supplies. The
                project is educational in nature and is not initially operated
                as a commercial profit-making service. References to future
                development, deployment, or institutional usage do not create a
                promise of ongoing commercial availability.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                3. Description of the Service
              </h2>
              <p>
                The platform may provide account access, institutional
                association, hardware synchronization, device telemetry review,
                and monitoring information related to vaccine storage and cold
                chain conditions. Features may evolve as the project develops.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Account Responsibility</h2>
              <p>
                If you create or use an account through Google Sign-In or other
                authentication methods, you are responsible for maintaining the
                confidentiality of your credentials and for activity that occurs
                under your account. You must use accurate information and notify
                ColdGuard if you believe your account has been compromised.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Acceptable Use</h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>misuse the platform or attempt unauthorized access;</li>
                <li>interfere with device synchronization or service integrity;</li>
                <li>
                  upload false, misleading, malicious, or unlawful content or
                  data;
                </li>
                <li>
                  reverse engineer, disrupt, or abuse the service in a way that
                  harms users, institutions, or system reliability;
                </li>
                <li>
                  use the service in violation of applicable law or institutional
                  rules.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Availability</h2>
              <p>
                Because ColdGuard is an evolving student project, the website
                and platform may change, be interrupted, or be discontinued at
                any time. We do not guarantee uninterrupted availability,
                permanent hosting, or error-free operation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Medical Disclaimer</h2>
              <p className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-primary-pressed">
                <strong>Important:</strong>
                {" "}
                ColdGuard is a monitoring and support tool. It does not replace
                professional medical judgment, clinical protocol, regulatory
                compliance review, or institutional decision-making. Users and
                institutions remain responsible for determining whether vaccines
                or medical supplies are safe and suitable for use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                8. Intellectual Property
              </h2>
              <p>
                The ColdGuard website, branding, code, content, and related
                materials remain the property of their respective owners,
                contributors, or project team members unless otherwise stated.
                These Terms do not grant ownership rights except for the limited
                right to use the service as provided.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">9. Termination</h2>
              <p>
                We may suspend or terminate access if use of the platform
                creates security risk, violates these Terms, disrupts service
                operations, or becomes incompatible with the project&apos;s scope
                or institutional requirements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                10. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by applicable law, ColdGuard and
                its student contributors, collaborators, and affiliated academic
                participants are not liable for indirect, incidental, special,
                consequential, or exemplary damages arising from use of the
                website or platform. The service is provided on an &quot;as is&quot;
                and &quot;as available&quot; basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Changes to the Terms</h2>
              <p>
                We may revise these Terms from time to time as the project
                develops. Updated terms will be posted on this page with a new
                last-updated date. Continued use of the service after updates
                means you accept the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">12. Contact</h2>
              <p>
                Questions about these Terms may be sent to
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
