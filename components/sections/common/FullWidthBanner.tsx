import React from "react";

export type FullWidthBannerProps = {
  title?: string;
  content: string;
  images: string[];
};

const FullWidthBanner: React.FC<FullWidthBannerProps> = ({ title, content, images }) => (
  <section className="w-full py-12 px-4 bg-[#c1121f] text-white text-center">
    {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
    <p className="mb-8">{content}</p>
    <div className="flex justify-center gap-4">
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={title || `Pizza banner ${idx+1}`}
          className="rounded-lg shadow-md w-32 h-32 object-cover"
        />
      ))}
    </div>
  </section>
);

export default FullWidthBanner;
