import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

export async function getEditionImages(year: number) {
  try {
    const directory = path.join(
      process.cwd(),
      "public",
      "images",
      "editions",
      String(year),
    );
    const files = await readdir(directory, { withFileTypes: true });

    return files
      .filter(
        (file) =>
          file.isFile() && IMAGE_EXTENSION.test(file.name),
      )
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .map(
        (file) =>
          `/images/editions/${year}/${encodeURIComponent(file.name)}`,
      );
  } catch {
    return [];
  }
}
