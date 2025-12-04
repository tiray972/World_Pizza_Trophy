"use client";
import { useState } from "react";
import React from "react";

export type TestimonialsSliderProps = {
  title?: string;
  content: string;
  images: string[];
};

const TestimonialsSlider: React.FC<TestimonialsSliderProps> = ({ title, content, images }) => (
  <section className="py-12 px-4 max-w-6xl mx-auto text-center">
    {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
    <p className="mb-8 text-zinc-700">{content}</p>
    <div className="flex justify-center gap-4 overflow-x-auto">
      {images.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={title || `Pizza testimonial ${idx+1}`}
          className="rounded-lg shadow-md w-48 h-48 object-cover"
        />
      ))}
    </div>
  </section>
);

export default TestimonialsSlider;
