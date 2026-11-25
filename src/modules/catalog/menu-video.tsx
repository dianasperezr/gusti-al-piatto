"use client";

import { useState } from "react";
import { Play } from "lucide-react";

export function MenuVideo({ src, poster, name }: { src: string; poster?: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) return <div className="video-frame">
    <video src={src} poster={poster} controls autoPlay muted playsInline preload="metadata" aria-label={name} className="cover-media">
      <a href={src}>Abrir video</a>
    </video>
  </div>;
  return <div className="video-frame">
    {poster && (
      // The upload pipeline already generates responsive, optimized WebP thumbnails.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} loading="lazy" decoding="async" alt="" className="cover-media" />
    )}
    <button className="button video-trigger" type="button" onClick={() => setPlaying(true)} aria-label={`Reproducir video: ${name}`}>
      <Play size={16} aria-hidden="true" /> Reproducir video
    </button>
  </div>;
}
