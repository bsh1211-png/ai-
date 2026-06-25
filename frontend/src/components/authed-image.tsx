"use client";

import { useEffect, useState } from "react";
import { fetchAuthedBlobUrl } from "@/lib/api";

export function AuthedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    fetchAuthedBlobUrl(path).then((url) => {
      objectUrl = url;
      setSrc(url);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) {
    return <div className={`bg-gray-100 animate-pulse ${className ?? ""}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
