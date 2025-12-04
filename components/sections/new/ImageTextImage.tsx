// components/ImageTextImage.tsx

import React from "react";
import Image from "next/image";

export type ImageTextImageProps = {
  title?: string;
  content: string;
  images: string[];
};

const ImageTextImage: React.FC<ImageTextImageProps> = ({ title, content, images }) => {
  // content peut contenir des sauts de ligne, on les gère pour plusieurs paragraphes
  const paragraphs = content ? content.split('\n').filter(Boolean) : [];
  return (
    <section className="py-12 px-4 max-w-6xl mx-auto text-center">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {images[0] && (
          <img
            src={images[0]}
            alt={title || "Pizza"}
            className="rounded-lg shadow-md w-full md:w-1/3 h-64 object-cover"
          />
        )}
        <div className="flex-1">
          {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
          {paragraphs.length > 0
            ? paragraphs.map((p, i) => (
                <p className="mb-4 text-zinc-700" key={i}>{p}</p>
              ))
            : null}
        </div>
        {images[1] && (
          <img
            src={images[1]}
            alt={title || "Pizza"}
            className="rounded-lg shadow-md w-full md:w-1/3 h-64 object-cover"
          />
        )}
      </div>
    </section>
  );
};

export default ImageTextImage;
