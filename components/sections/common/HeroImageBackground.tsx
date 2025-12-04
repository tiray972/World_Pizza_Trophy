import React from "react";
import Image from "next/image";

export type HeroImageBackgroundProps = {
  title?: string;
  content: string;
  images: string[];
};

const HeroImageBackground: React.FC<HeroImageBackgroundProps> = ({ title, content, images }) => (
  <section className="relative h-[60vh] flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url('${images[0] || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1920&q=80"}')` }}>
    <div className="absolute inset-0 bg-black/60" />
    <div className="relative z-10 text-center max-w-4xl px-6">
      {title && <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 uppercase drop-shadow-lg">{title}</h1>}
      <p className="text-lg sm:text-xl text-white/90 mb-8">{content}</p>
    </div>
  </section>
);

export default HeroImageBackground;
