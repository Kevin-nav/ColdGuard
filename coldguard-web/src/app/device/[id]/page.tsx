import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { Footer } from "../../../components/Footer";
import {
  buildAppDeviceUrl,
  buildCanonicalDeviceUrl,
  normalizeQueryValue,
} from "../../../lib/site";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ id?: string }>;
  searchParams?: Promise<SearchParams>;
};

async function resolvePageData(props: PageProps) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};

  const deviceId = normalizeQueryValue(params.id);
  const claim = normalizeQueryValue(searchParams.claim);
  const version = normalizeQueryValue(searchParams.v) ?? "1";

  return {
    canonicalUrl: buildCanonicalDeviceUrl({ claim, deviceId, version }),
    claim,
    deviceId,
    openAppUrl: buildAppDeviceUrl({ claim, deviceId, version }),
    version,
  };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { canonicalUrl, deviceId } = await resolvePageData(props);
  const title = deviceId ? `Open Device ${deviceId}` : "Open Device";

  return {
    title,
    description:
      "Open a ColdGuard device enrollment or handoff link in the ColdGuard Android app, or review the device handoff details on the web.",
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function DeviceLandingPage(props: PageProps) {
  const { canonicalUrl, claim, deviceId, openAppUrl, version } = await resolvePageData(props);
  const hasEnrollmentContext = Boolean(deviceId && claim);

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

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-3xl border border-border bg-surface p-8 md:p-10 shadow-card">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-4 py-2 text-sm font-semibold text-primary">
              <QrCode className="w-4 h-4" />
              Device handoff link
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Open this ColdGuard device in the app
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground-secondary">
              This page is the public fallback for a ColdGuard device QR code.
              If the ColdGuard Android app is installed, use the button below to
              continue enrollment or reopen the device handoff there.
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-muted p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-primary mb-2">
                  Device ID
                </dt>
                <dd className="font-semibold text-foreground">
                  {deviceId ?? "Unavailable"}
                </dd>
              </div>
              <div className="rounded-2xl border border-border bg-surface-muted p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-primary mb-2">
                  Link version
                </dt>
                <dd className="font-semibold text-foreground">{version}</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={openAppUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-pressed"
              >
                <Smartphone className="w-5 h-5" />
                Open in ColdGuard app
              </a>
              <a
                href={canonicalUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 py-4 text-base font-semibold text-foreground transition-colors hover:bg-surface-muted"
              >
                <ExternalLink className="w-5 h-5" />
                Continue on this website
              </a>
            </div>

            <div className="mt-8 rounded-2xl border border-primary/15 bg-primary-light/50 p-5 text-sm leading-relaxed text-foreground-secondary">
              {hasEnrollmentContext ? (
                <p>
                  The QR code contains a valid ColdGuard device handoff link.
                  The web page does not display the claim token, but the secure
                  app handoff is preserved when you use the button above.
                </p>
              ) : (
                <p>
                  This link is missing part of the enrollment context. You can
                  still verify the device identifier here, but app enrollment
                  may not continue until a complete link is scanned again.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-border bg-surface p-7 shadow-card">
              <div className="inline-flex items-center gap-2 text-primary font-semibold">
                <ShieldCheck className="w-5 h-5" />
                What this page is for
              </div>
              <ul className="mt-4 list-disc pl-5 space-y-3 text-sm leading-relaxed text-foreground-secondary">
                <li>Supports QR scans from a printed device label or setup sheet.</li>
                <li>Works as a browser fallback when the app is not yet installed.</li>
                <li>Uses the same `https://coldguard.org/device/...` URL format for app links and web access.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-7 shadow-card">
              <h2 className="text-lg font-bold text-foreground">Need the app?</h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">
                ColdGuard device enrollment currently continues in the Android
                app after sign-in and institution linking. If the app is already
                installed, the primary button above should hand this link off to
                it directly.
              </p>
              <div className="mt-5 text-sm text-foreground-secondary">
                Canonical link:
              </div>
              <div className="mt-2 rounded-2xl bg-surface-muted p-4 text-sm break-all text-foreground">
                {canonicalUrl}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
