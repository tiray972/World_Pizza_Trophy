import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

export async function getEditionImages(year: number) {
  const relativeDirectory = `/images/editions/${year}`;
  const directory = path.join(process.cwd(), "public", relativeDirectory);

  try {
    const files = await readdir(directory);

    return files
      .filter((file) => IMAGE_EXTENSION.test(file))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
      )
      .map((file) => `${relativeDirectory}/${file}`);
  } catch {
    return [];
  }
}
