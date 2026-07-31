"use client";

import { useEffect, useState } from "react";

interface Attribution {
  displayName?: string;
  uri?: string;
}

interface PhotoMetadata {
  authorAttributions?: Attribution[];
  googleMapsUri?: string;
}

function metadataUrl(photoUrl: string): string | undefined {
  try {
    const url = new URL(photoUrl);
    if (url.pathname !== "/api/places/photo") return undefined;
    url.searchParams.set("meta", "1");
    url.searchParams.delete("w");
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Google Places写真の作者と個別の元写真リンクを、写真の近くへ控えめに表示する。 */
export function GooglePhotoAttributionV2({ photoUrl, dark = false }: { photoUrl: string; dark?: boolean }) {
  const [metadata, setMetadata] = useState<PhotoMetadata | null>(null);

  useEffect(() => {
    const url = metadataUrl(photoUrl);
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: PhotoMetadata | null) => setMetadata(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [photoUrl]);

  if (!metadata) return null;
  const authors = (metadata.authorAttributions ?? []).filter((author) => author.displayName);
  if (authors.length === 0 && !metadata.googleMapsUri) return null;
  const color = dark ? "text-white/75" : "text-stone-600";

  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] leading-4 ${color}`}>
      <span>Photo:</span>
      {authors.map((author, index) =>
        author.uri ? (
          <a key={`${author.displayName}-${index}`} href={author.uri} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {author.displayName}
          </a>
        ) : (
          <span key={`${author.displayName}-${index}`}>{author.displayName}</span>
        )
      )}
      {metadata.googleMapsUri ? (
        <a href={metadata.googleMapsUri} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Google Mapsで元写真を見る
        </a>
      ) : null}
    </p>
  );
}
