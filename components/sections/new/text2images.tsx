// components/AboutSection.tsx

import React from "react";
import Image from "next/image";

export type Text2imagesSectionProps = {
  title?: string;
  content: string;
  images: string[];
};

const Text2imagesSection: React.FC<Text2imagesSectionProps> = ({ title, content, images }) => (
  <section className="py-12 px-4 max-w-6xl mx-auto text-center">
    {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
    <p className="mb-8 text-zinc-700">{content}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={title || `Pizza image ${idx+1}`}
          className="rounded-lg shadow-md w-full h-64 object-cover"
        />
      ))}
    </div>
  </section>
);

export default Text2imagesSection;
