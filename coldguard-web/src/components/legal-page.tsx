import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Mail, MapPin } from "lucide-react";
import { Footer } from "./Footer";
import { SITE_OPERATOR, SITE_URL } from "../lib/site";

type LegalPageProps = {
  children: ReactNode;
  lastUpdated: string;
  summary: string;
  title: string;
};

export function LegalPage({
  children,
  lastUpdated,
  summary,
  title,
}: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary hover:text-primary-pressed font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-surface rounded-2xl shadow-card border border-border p-8 md:p-12">
          <div className="border-b border-border pb-8 mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary mb-4">
              Public Policy
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
              {title}
            </h1>
            <p className="text-lg text-foreground-secondary leading-relaxed max-w-3xl">
              {summary}
            </p>
            <dl className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-primary-light/40 p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-primary mb-2">
                  Operator
                </dt>
                <dd className="font-semibold text-foreground">{SITE_OPERATOR.name}</dd>
                <dd className="text-sm text-foreground-secondary mt-2">
                  {SITE_OPERATOR.teamDescription}
                </dd>
              </div>
              <div className="rounded-2xl border border-border bg-surface-muted p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-primary mb-2">
                  Website
                </dt>
                <dd className="font-semibold text-foreground">{SITE_URL.replace("https://", "")}</dd>
                <dd className="text-sm text-foreground-secondary mt-2">
                  Last updated: {lastUpdated}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 text-sm text-foreground-secondary">
              <div className="inline-flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                <span>University of Mines and Technology, Tarkwa, Western Region, Ghana</span>
              </div>
              {SITE_OPERATOR.contactEmails.map((email) => (
                <a
                  key={email}
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-pressed underline underline-offset-4"
                >
                  <Mail className="w-4 h-4" />
                  {email}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-8 text-foreground leading-relaxed">{children}</div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
