import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-03-06T00:00:00.000Z");

  return [
    {
      url: "https://coldguard.org/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://coldguard.org/privacy",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://coldguard.org/terms",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
