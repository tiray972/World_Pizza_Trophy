import "server-only";
import { editionImages2025 } from "@/lib/edition-images-2025";

export async function getEditionImages(year: number) {
  return year === 2025 ? [...editionImages2025] : [];
}
