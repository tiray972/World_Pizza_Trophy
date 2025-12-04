import React from "react";

export type SectionTextImageClipPathProps = {
  title?: string;
  content: string;
  images: string[];
  clipPathSvg?: string; // chemin vers le SVG qui contient <clipPath id="shape">
  clipId?: string;      // l'ID du clipPath dans le SVG
};

const SectionTextImageClipPath: React.FC<SectionTextImageClipPathProps> = ({
  title,
  content,
  images,
  clipPathSvg = "/images/svg/4.svg",
  clipId = "shape", // ID du <clipPath>
}) => {
  return (
    <section className="py-12 px-4 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
      <div className="flex-1 text-center md:text-left">
        {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
        <p className="mb-8 text-zinc-700 whitespace-pre-line">{content}</p>
      </div>

      <div className="flex-1 relative w-full max-w-md mx-auto">
        {images[0] && (
          <div className="relative w-full h-80">
            {/* --- Charge le SVG dans la page pour activer le clipPath --- */}
            <object
              type="image/svg+xml"
              data={clipPathSvg}
              className="hidden"
            />

            {/* --- L’image découpée --- */}
            <img
              src={images[0]}
              alt={title || "Image"}
              style={{
                clipPath: `url(${clipPathSvg}#${clipId})`,
                WebkitClipPath: `url(${clipPathSvg}#${clipId})`,
              }}
              className="w-full h-full object-cover shadow-lg"
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default SectionTextImageClipPath;
