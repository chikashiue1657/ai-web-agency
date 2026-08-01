import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

export function buildCafeStructuredData(brief: StoreBrief, contents: GeneratedWebsiteContents, pageUrl: string) {
  const realData = brief.realData;
  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: brief.storeName,
    description: contents.metaDescription,
    url: pageUrl,
    ...(realData?.address ? { address: { "@type": "PostalAddress", streetAddress: realData.address } } : {}),
    ...(realData?.phone ? { telephone: realData.phone } : {}),
    ...(realData?.photoUrls?.length ? { image: realData.photoUrls.slice(0, 6) } : {}),
    ...(realData?.websiteUrl ? { sameAs: [realData.websiteUrl, realData.instagramUrl].filter(Boolean) } :
      realData?.instagramUrl ? { sameAs: [realData.instagramUrl] } : {}),
    ...(realData?.googleRating && realData.googleReviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: realData.googleRating,
            reviewCount: realData.googleReviewCount,
            bestRating: 5,
          },
        }
      : {}),
  };
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
