"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type GalleryCopy = {
  empty: string;
  imageAlt: string;
  loadMore: string;
  photoCount: string;
};

type EditionPhotoGalleryProps = {
  images: string[];
  copy: GalleryCopy;
};

const INITIAL_IMAGE_COUNT = 24;
const LOAD_MORE_COUNT = 24;

export default function EditionPhotoGallery({
  images,
  copy,
}: EditionPhotoGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_IMAGE_COUNT);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const visibleImages = useMemo(
    () => images.slice(0, visibleCount),
    [images, visibleCount],
  );

  const closeLightbox = useCallback(() => setSelectedIndex(null), []);
  const showPrevious = useCallback(() => {
    setSelectedIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length,
    );
  }, [images.length]);
  const showNext = useCallback(() => {
    setSelectedIndex((current) =>
      current === null ? null : (current + 1) % images.length,
    );
  }, [images.length]);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, selectedIndex, showNext, showPrevious]);

  if (images.length === 0) {
    return <p className="py-16 text-center text-gray-500">{copy.empty}</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-600">
        <Images aria-hidden="true" className="h-4 w-4 text-[#8B0000]" />
        <span>{copy.photoCount.replace("{count}", String(images.length))}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleImages.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`group relative overflow-hidden bg-gray-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000] focus-visible:ring-offset-2 ${
              index % 11 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-[4/3]"
            }`}
            aria-label={`${copy.imageAlt} ${index + 1}`}
          >
            <Image
              src={src}
              alt={`${copy.imageAlt} ${index + 1}`}
              fill
              unoptimized
              sizes={
                index % 11 === 0
                  ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 40vw"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              }
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {visibleCount < images.length && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(current + LOAD_MORE_COUNT, images.length),
              )
            }
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#8B0000] px-6 py-3 font-bold text-white transition-colors hover:bg-[#700000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000] focus-visible:ring-offset-2"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
            {copy.loadMore}
          </button>
        </div>
      )}

      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${copy.imageAlt} ${selectedIndex + 1}`}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title="Fermer"
            aria-label="Fermer"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-5"
            title="Photo précédente"
            aria-label="Photo précédente"
          >
            <ChevronLeft aria-hidden="true" className="h-7 w-7" />
          </button>

          <div
            className="relative h-[82vh] w-[88vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={images[selectedIndex]}
              alt={`${copy.imageAlt} ${selectedIndex + 1}`}
              fill
              unoptimized
              sizes="90vw"
              priority
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5"
            title="Photo suivante"
            aria-label="Photo suivante"
          >
            <ChevronRight aria-hidden="true" className="h-7 w-7" />
          </button>

          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm font-semibold text-white/80">
            {selectedIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
