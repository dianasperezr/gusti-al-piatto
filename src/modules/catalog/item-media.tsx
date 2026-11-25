"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, GlassWater, Package, Utensils } from "lucide-react";
import { useRef, useState } from "react";
import { MenuVideo } from "./menu-video";
import type { PublicMedia } from "./pricing";

export type ProductKind = "dish" | "drink" | "combo";

export function ItemMedia({ media, name, hero = false }: { media: PublicMedia; name: string; hero?: boolean }) {
  if (media.video) return <MenuVideo src={media.src} poster={media.poster} name={name} />;
  return <picture className="media-picture">
    {!hero && media.poster && <source media="(max-width: 600px) and (max-resolution: 1.5dppx)" srcSet={media.poster} />}
    <Image src={media.src} alt={hero ? "" : name} fill sizes={hero ? "(max-width: 800px) 100vw, 50vw" : "(max-width: 640px) 100vw, 400px"} unoptimized={media.src.startsWith("/media/")} preload={hero} className="cover-media" />
  </picture>;
}

export function ProductThumbnail({ media, kind }: { media?: PublicMedia; kind: ProductKind }) {
  const src = media?.poster ?? (!media?.video ? media?.src : undefined);
  const Icon = media?.video ? Film : kind === "combo" ? Package : kind === "drink" ? GlassWater : Utensils;
  return <span className="product-thumbnail" aria-hidden="true">
    {src ? <Image src={src} alt="" fill sizes="(max-width: 500px) 90px, 140px" unoptimized={src.startsWith("/media/")} className="cover-media" />
      : <Icon size={26} strokeWidth={1.4} />}
  </span>;
}

export function ProductGallery({ assets, name, kind, onOpen }: {
  assets: PublicMedia[]; name: string; kind: ProductKind; onOpen?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const position = index % assets.length;
  const current = assets[position];
  if (!current) return null;
  const move = (amount: number) => setIndex(previous => (previous % assets.length + amount + assets.length) % assets.length);
  return <div className={"item-carousel" + (onOpen ? " carousel-compact" : " item-image product-detail-image")}
    role={assets.length > 1 ? "group" : undefined} aria-label={assets.length > 1 ? `Galería de ${name}` : undefined}
    onTouchStart={event => {
      skipClick.current = false;
      if (!current.video || onOpen) touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
      if (!touch.current) return;
      const x = event.changedTouches[0].clientX - touch.current.x;
      const y = event.changedTouches[0].clientY - touch.current.y;
      touch.current = null;
      if (assets.length > 1 && Math.abs(x) > 40 && Math.abs(x) > Math.abs(y)) {
        skipClick.current = true;
        move(x > 0 ? -1 : 1);
      }
    }}>
    {onOpen ? <button type="button" className="carousel-photo" tabIndex={-1} aria-label={`Ver ${name}`} onClick={() => {
      if (!skipClick.current) onOpen();
      skipClick.current = false;
    }}><ProductThumbnail media={current} kind={kind} /></button>
      : <ItemMedia key={current.src} media={current} name={name} />}
    {assets.length > 1 && <>
      <button type="button" className="carousel-arrow previous" aria-label={`Anterior en galería de ${name}`} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
      <button type="button" className="carousel-arrow next" aria-label={`Siguiente en galería de ${name}`} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      <span className="carousel-position" role="status">{position + 1} / {assets.length}</span>
    </>}
  </div>;
}
