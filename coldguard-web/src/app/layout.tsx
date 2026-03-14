import type { Metadata } from "next";
import "./globals.css";
import { SITE_OPERATOR } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL("https://coldguard.org"),
  title: {
    default: "ColdGuard | Rural Vaccine Cold-Chain Integrity",
    template: "%s | ColdGuard"
  },
  description:
    "ColdGuard is a ruggedized, intelligent monitoring system protecting the integrity of vaccines and medicines across rural healthcare settings in Ghana. Overcoming power outages and field gaps to keep communities safe.",
  keywords: [
    "ColdGuard",
    "Vaccine monitoring",
    "Cold chain integrity",
    "Ghana healthcare",
    "Rural medical distribution",
    "Temperature monitoring",
    "Medical IoT"
  ],
  authors: [{ name: `${SITE_OPERATOR.name}, ${SITE_OPERATOR.teamDescription}` }],
  creator: SITE_OPERATOR.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://coldguard.org",
    title: "ColdGuard | Protecting Vaccines, Saving Lives",
    description: "A ruggedized, intelligent monitoring system safeguarding vaccine integrity across rural Ghana.",
    siteName: "ColdGuard",
    images: [
      {
        url: "/images/hero.png",
        width: 1200,
        height: 630,
        alt: "ColdGuard Hero Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ColdGuard | Protecting Vaccines, Saving Lives",
    description: "A ruggedized, intelligent monitoring system safeguarding vaccine integrity across rural Ghana.",
    images: ["/images/hero.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
