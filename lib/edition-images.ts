import "server-only";

const REPOSITORY = "tiray972/World_Pizza_Trophy";
const ASSET_COMMIT = "bb3ead84b5dda4f75ce2657dfe91a37044745a7c";

type GitHubContent = {
  download_url: string | null;
  name: string;
  type: "file" | "dir";
};

export async function getEditionImages(year: number) {
  try {
    const directory = `public/images/editions/${year}`;
    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/contents/${directory}?ref=${ASSET_COMMIT}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 86400 },
      },
    );

    if (!response.ok) return [];

    const files = (await response.json()) as GitHubContent[];

    return files
      .filter(
        (file) =>
          file.type === "file" &&
          file.download_url &&
          /\.(?:jpe?g|png|webp)$/i.test(file.name),
      )
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .map((file) => file.download_url as string);
  } catch {
    return [];
  }
}
