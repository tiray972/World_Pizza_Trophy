import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import results from "@/lib/results/2026.json";
import { resultsForEdition } from "@/lib/server/results/public-page";
import { resultsCopy, categoryLabel, resultLocale } from "@/lib/results/copy";

type Props = { params: Promise<{ lang: string }> };

// Classements publiés en base relus toutes les 5 minutes (repli sur l'instantané 2026).
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = resultLocale((await params).lang);
  return { title: `${resultsCopy[lang].title} | World Pizza Trophy`, description: resultsCopy[lang].intro };
}

export default async function ResultsPage({ params }: Props) {
  const lang = resultLocale((await params).lang);
  const t = resultsCopy[lang];
  // Keep the printed ranks, including their order when scores are tied.
  const categories = [...(await resultsForEdition(2026))].sort((a, b) => {
    const order = ["super-champion", "classique", "calzone", "napolitaine", "pasta", "dessert", "teglia", "focaccia", "pala", "chef-ziolo"];
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
    return rank(a.id) - rank(b.id);
  });
  return (
    <div className="min-h-screen bg-[#F7F5F1] text-gray-950">
      <Header lang={lang} />
      <main id="results-top" className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-wider text-[#8B0000]">World Pizza Trophy · Menton · 2026</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">{t.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600">{t.intro}</p>
        <p className="mt-3 text-sm text-gray-600">{t.available.replace("{count}", String(categories.length))}</p>
        <nav aria-label={t.categories} className="my-8 flex flex-wrap gap-2">
          {categories.map(category => (
            <a key={category.id} href={`#${category.id}`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:border-[#8B0000] hover:text-[#8B0000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B0000]">
              {categoryLabel(category.id, category.name, lang)}
            </a>
          ))}
        </nav>
        <div className="space-y-8">
          {categories.map(category => (
            <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-32 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-200 px-4 py-5 sm:px-6">
                <h2 id={`${category.id}-title`} className="text-2xl font-black">{categoryLabel(category.id, category.name, lang)}</h2>
                <span className="text-sm text-gray-500">
                  {category.kind === "team" ? t.teams : t.individual}
                  {category.updatedAt && ` · ${t.updated} ${new Date(category.updatedAt).toLocaleDateString(lang)}`}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm sm:text-base">
                  <caption className="sr-only">{categoryLabel(category.id, category.name, lang)} — {t.title}</caption>
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600 sm:text-sm">
                    <tr><th scope="col" className="px-3 py-3 sm:px-6">{t.rank}</th><th scope="col" className="px-3 py-3 sm:px-6">{category.kind === "team" ? t.team : t.name}</th><th scope="col" className="px-3 py-3 sm:px-6">{t.bib}</th><th scope="col" className="px-3 py-3 text-right sm:px-6">{t.points}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {category.entries.map((entry, index) => (
                      <tr key={`${entry.rank ?? entry.status}-${index}`} className={entry.rank !== null && entry.rank <= 3 ? "bg-[#FFD54A]/10" : ""}>
                        <td className="px-3 py-3 font-bold tabular-nums sm:px-6">
                          {entry.rank ?? (t.status as Record<string, string>)[entry.status] ?? entry.status}
                        </td>
                        <th scope="row" className="min-w-40 px-3 py-3 font-semibold sm:px-6">
                          {entry.name}
                          {entry.members && entry.members.length > 0 && entry.members.join(" – ") !== entry.name && (
                            <span className="block text-sm font-normal text-gray-600">{t.members} : {entry.members.join(" – ")}</span>
                          )}
                        </th>
                        <td className="px-3 py-3 tabular-nums text-gray-600 sm:px-6">{entry.bib ?? "—"}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums sm:px-6">{entry.points !== null ? entry.points.toLocaleString(lang) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <a href="#results-top" className="inline-block px-4 py-4 text-sm font-semibold text-[#8B0000] underline sm:px-6">{t.top}</a>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-6 text-sm">
          <a href={results.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#8B0000] underline">{t.source}</a>
          <Link href={`/${lang}/editions`} className="font-semibold underline">{t.editions}</Link>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
