import React from "react";

export type ThreeColumnFeaturesProps = {
  title?: string;
  content: string;
  images: string[];
};

const ThreeColumnFeatures: React.FC<ThreeColumnFeaturesProps> = ({ title, content, images }) => (
  <section className="py-12 px-4 max-w-6xl mx-auto text-center">
    {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
    <p className="mb-8 text-zinc-700">{content}</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={title || `Pizza feature ${idx+1}`}
          className="rounded-lg shadow-md w-full h-48 object-cover"
        />
      ))}
    </div>
  </section>
);

export default ThreeColumnFeatures;
