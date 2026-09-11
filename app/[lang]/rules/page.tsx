"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type SupportedLang = "fr" | "en" | "es" | "it";

type Props = {
  params: Promise<{ lang: string }>;
};

export default function RulesPage({ params }: Props) {
  const [dictionary, setDictionary] = useState<any>(null);
  const [lang, setLang] = useState<SupportedLang>("fr");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // 📅 Jours de passage et tarifs réels, lus depuis l'événement ouvert
  const [liveCategories, setLiveCategories] = useState<
    { name: string; dates: string[]; unitPrice: number }[]
  >([]);

  useEffect(() => {
    const loadLiveSchedule = async () => {
      try {
        const eventsSnapshot = await getDocs(
          query(collection(db, "events"), where("status", "==", "open"))
        );
        if (eventsSnapshot.empty) return;

        // Événement le plus proche dans le temps
        const events = eventsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            start:
              doc.data().eventStartDate instanceof Timestamp
                ? (doc.data().eventStartDate as Timestamp).toDate()
                : new Date(doc.data().eventStartDate),
          }))
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        const categoriesSnapshot = await getDocs(
          query(collection(db, "categories"), where("eventId", "==", events[0].id))
        );
        const slotsSnapshot = await getDocs(
          query(collection(db, "slots"), where("eventId", "==", events[0].id))
        );

        const datesByCategory = new Map<string, Set<string>>();
        slotsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const dates = datesByCategory.get(data.categoryId) ?? new Set<string>();
          if (data.date) dates.add(data.date);
          datesByCategory.set(data.categoryId, dates);
        });

        setLiveCategories(
          categoriesSnapshot.docs.map(doc => {
            const data = doc.data();
            const fromSlots = Array.from(datesByCategory.get(doc.id) ?? []);
            const dates = fromSlots.length > 0 ? fromSlots : (data.activeDates || []);
            return {
              name: data.name || "",
              dates: [...dates].sort(),
              unitPrice: Number(data.unitPrice || 0),
            };
          })
        );
      } catch (error) {
        // Page publique : sans accès aux données, on affiche le règlement sans les dates.
        console.warn("Planning indisponible:", error);
      }
    };

    loadLiveSchedule();
  }, []);

  useEffect(() => {
    params.then(({ lang: rawLang }) => {
      const validLang: SupportedLang = ["fr", "en", "es", "it"].includes(rawLang)
        ? (rawLang as SupportedLang)
        : "fr";
      setLang(validLang);
      getDictionary(validLang).then(setDictionary);
    });
  }, [params]);

  if (!dictionary) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const rulesDetail = dictionary.rulesDetail;
  const generalRules = rulesDetail.generalRules;
  const categoryRules = rulesDetail.categoryRules;
  const rules = dictionary.rules;

  const allCategories = [
    { id: "classique", name: categoryRules.classique.name },
    { id: "calzone", name: categoryRules.calzone.name },
    { id: "napolitaine", name: categoryRules.napolitaine.name },
    { id: "dessert", name: categoryRules.dessert.name },
    { id: "focaccia", name: categoryRules.focaccia.name },
    { id: "pala", name: categoryRules.pala.name },
    { id: "teglia", name: categoryRules.teglia.name },
    { id: "doue", name: categoryRules.doue.name },
    { id: "pasta", name: categoryRules.pasta.name },
    { id: "freestyle", name: categoryRules.freestyle.name },
    { id: "rapidite", name: categoryRules.rapidite.name },
    { id: "large", name: categoryRules.large.name },
  ];

  // Rapprochement entre les catégories du règlement et celles de la base
  const CATEGORY_MATCHERS: Record<string, string[]> = {
    classique: ["classique", "classica", "classic"],
    calzone: ["calzone"],
    napolitaine: ["napolit", "napolet"],
    dessert: ["dessert", "dolce"],
    focaccia: ["focaccia"],
    pala: ["pala"],
    teglia: ["teglia"],
    doue: ["due", "duè", "doue", "doué", "ziolo"],
    pasta: ["pasta"],
    freestyle: ["freestyle", "free style"],
    rapidite: ["rapid", "veloce"],
    large: ["large", "xxl"],
  };

  const normalize = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const liveDataFor = (slug: string) => {
    const fragments = CATEGORY_MATCHERS[slug] || [slug];
    return liveCategories.find(category =>
      fragments.some(fragment => normalize(category.name).includes(normalize(fragment)))
    );
  };

  const formatDay = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(
      lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : lang === "it" ? "it-IT" : "fr-FR",
      { day: "numeric", month: "long" }
    );

  const specsLabels = rulesDetail.specsTable;

  const selectedCategoryData = selectedCategory
    ? categoryRules[selectedCategory as keyof typeof categoryRules]
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} />

      <main className="flex-grow container mx-auto px-4 py-16 max-w-7xl">
        {/* Header Section */}
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#8B0000] mb-4">
            {rules.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {rules.subtitle}
          </p>
        </header>

        {/* ⏱️ Temps de prestation et jours de passage */}
        <section className="mb-16 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <h2 className="text-2xl md:text-3xl font-bold text-[#8B0000]">
              ⏱️ {specsLabels.title}
            </h2>
            <p className="text-gray-600 mt-2">{specsLabels.subtitle}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">{specsLabels.category}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{specsLabels.duration}</th>
                  <th className="px-4 py-3">{specsLabels.format}</th>
                  <th className="px-4 py-3">{specsLabels.oven}</th>
                  <th className="px-4 py-3">{specsLabels.days}</th>
                  <th className="px-4 py-3 text-right">{specsLabels.price}</th>
                </tr>
              </thead>
              <tbody>
                {allCategories.map((cat) => {
                  const data = categoryRules[cat.id as keyof typeof categoryRules];
                  const specs = data?.specs;
                  const live = liveDataFor(cat.id);

                  return (
                    <tr
                      key={cat.id}
                      className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">{cat.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-[#8B0000]">
                        {specs?.duration || specsLabels.notSpecified}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{specs?.format || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{specs?.oven || "—"}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {live && live.dates.length > 0
                          ? live.dates.map(formatDay).join(" & ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {live && live.unitPrice > 0 ? `${live.unitPrice} €` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {lang === "fr" ? "Catégories" : lang === "en" ? "Categories" : lang === "es" ? "Categorías" : "Categorie"}
              </h2>

              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-4 py-3 rounded-lg font-semibold mb-3 transition-all ${
                  selectedCategory === null
                    ? "bg-[#8B0000] text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {lang === "fr" ? "Règlement Général" : lang === "en" ? "General Rules" : lang === "es" ? "Reglamento General" : "Regolamento Generale"}
              </button>

              <div className="space-y-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
                      selectedCategory === cat.id
                        ? "bg-[#8B0000] text-white shadow-md"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedCategory === null ? (
              // General Rules
              <div className="bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
                <h2 className="text-4xl font-bold text-[#8B0000] mb-6">
                  {generalRules.title}
                </h2>

                {/* Warning Banner - Highly Visible */}
                <div className="bg-[#8B0000] text-white px-6 py-4 rounded-xl mb-8 shadow-lg">
                  <p className="text-center font-bold text-lg md:text-xl">
                    ⚠️ {generalRules.warning}
                  </p>
                </div>

                <div className="space-y-8">
                  {/* Organization */}
                  <section>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <span className="w-10 h-10 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] font-bold">
                        📋
                      </span>
                      {lang === "fr" ? "Organisation" : lang === "en" ? "Organization" : lang === "es" ? "Organización" : "Organizzazione"}
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-lg">
                      {generalRules.organization}
                    </p>
                  </section>

                  {/* Requirements */}
                  <section>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <span className="w-10 h-10 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] font-bold">
                        ✓
                      </span>
                      {lang === "fr" ? "Conditions de Participation" : lang === "en" ? "Participation Requirements" : lang === "es" ? "Requisitos de Participación" : "Requisiti di Partecipazione"}
                    </h3>
                    <ul className="space-y-4">
                      <li className="flex gap-3">
                        <span className="text-[#8B0000] font-bold">•</span>
                        <p className="text-gray-600 leading-relaxed">{generalRules.ageRequirement}</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-[#8B0000] font-bold">•</span>
                        <p className="text-gray-600 leading-relaxed">{generalRules.uniformRequirement}</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-[#8B0000] font-bold">•</span>
                        <p className="text-gray-600 leading-relaxed">{generalRules.jewelryBan}</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-[#8B0000] font-bold">•</span>
                        <p className="text-gray-600 leading-relaxed">{generalRules.ownProducts}</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-[#8B0000] font-bold">•</span>
                        <p className="text-gray-600 leading-relaxed">{generalRules.preparationRoom}</p>
                      </li>
                    </ul>
                  </section>

                  {/* Penalties */}
                  <section className="bg-red-50 p-6 rounded-xl border-l-4 border-[#8B0000]">
                    <h3 className="text-2xl font-bold text-[#8B0000] mb-4">
                      ⚠️ {generalRules.penalties.title}
                    </h3>
                    <div className="space-y-3">
                      <p className="text-gray-700 font-semibold">
                        {generalRules.penalties.incompleteUniform}
                      </p>
                      <p className="text-gray-700 font-semibold">
                        {generalRules.penalties.noCap}
                      </p>
                      <p className="text-gray-700 font-semibold">
                        {generalRules.penalties.jewelry}
                      </p>
                      <div className="mt-6 pt-4 border-t border-red-200">
                        <p className="text-gray-700 mb-3 font-semibold">
                          {generalRules.penalties.timeExceeded}
                        </p>
                        <ul className="space-y-2">
                          {generalRules.penalties.timeOverruns.map((penalty: string, idx: number) => (
                            <li key={idx} className="text-gray-600 font-semibold ml-4">
                              {penalty}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* Jury Presentation */}
                  <section>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <span className="w-10 h-10 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] font-bold">
                        🏆
                      </span>
                      {generalRules.serving.title}
                    </h3>
                    <div className="space-y-4">
                      <p className="text-gray-600 leading-relaxed text-lg">
                        {generalRules.serving.description}
                      </p>
                      <p className="text-gray-600 leading-relaxed">
                        {generalRules.serving.beverage}
                      </p>
                      <p className="text-gray-600 leading-relaxed font-semibold">
                        {generalRules.serving.jury}
                      </p>
                    </div>
                  </section>

                  {/* Additional Info */}
                  <section className="bg-blue-50 p-6 rounded-xl border-l-4 border-blue-400">
                    <h3 className="text-xl font-bold text-blue-900 mb-3">
                      ℹ️ {lang === "fr" ? "Information Complémentaire" : lang === "en" ? "Additional Information" : lang === "es" ? "Información Adicional" : "Informazioni Aggiuntive"}
                    </h3>
                    <p className="text-gray-700 mb-3">{generalRules.cancellation}</p>
                    <p className="text-gray-700">{generalRules.rights}</p>
                  </section>
                </div>
              </div>
            ) : (
              // Category Details
              selectedCategoryData && (
                <div className="bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold text-[#8B0000] mb-3">
                      {selectedCategoryData.name}
                    </h2>
                    <p className="text-xl text-gray-600 leading-relaxed">
                      {selectedCategoryData.description}
                    </p>
                  </div>

                  {/* ⏱️ Fiche technique de la catégorie */}
                  {selectedCategoryData.specs && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-[#8B0000] text-white rounded-xl p-4">
                        <p className="text-xs uppercase opacity-80">{specsLabels.duration}</p>
                        <p className="text-2xl font-bold mt-1">{selectedCategoryData.specs.duration}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-xs uppercase text-gray-500">{specsLabels.format}</p>
                        <p className="font-semibold text-gray-900 mt-1">{selectedCategoryData.specs.format}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-xs uppercase text-gray-500">{specsLabels.oven}</p>
                        <p className="font-semibold text-gray-900 mt-1">{selectedCategoryData.specs.oven}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-xs uppercase text-gray-500">{specsLabels.days}</p>
                        <p className="font-semibold text-gray-900 mt-1">
                          {(() => {
                            const live = liveDataFor(selectedCategory as string);
                            return live && live.dates.length > 0
                              ? live.dates.map(formatDay).join(" & ")
                              : "—";
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 p-8 rounded-xl">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">
                      {lang === "fr" ? "Critères d'Évaluation" : lang === "en" ? "Evaluation Criteria" : lang === "es" ? "Criterios de Evaluación" : "Criteri di Valutazione"}
                    </h3>
                    <ul className="space-y-4">
                      {selectedCategoryData.rules.map((rule: string, idx: number) => (
                        <li key={idx} className="flex gap-4 items-start">
                          <span className="flex-shrink-0 w-8 h-8 bg-[#8B0000] rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </span>
                          <span className="text-gray-700 text-lg leading-relaxed pt-1">
                            {rule}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="mt-8 flex gap-4">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                      ← {lang === "fr" ? "Retour" : lang === "en" ? "Back" : lang === "es" ? "Atrás" : "Indietro"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* CTA Section */}
        <section className="mt-16 bg-gradient-to-r from-[#8B0000] to-[#A50000] rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {lang === "fr" ? "Prêt à concourir ?" : lang === "en" ? "Ready to compete?" : lang === "es" ? "¿Listo para competir?" : "Pronto a competere?"}
          </h2>
          <p className="mb-8 text-lg text-[#FFD700] font-medium max-w-2xl mx-auto">
            {lang === "fr" ? "Choisissez votre catégorie et réservez votre créneau officiel." : lang === "en" ? "Choose your category and book your official time slot." : lang === "es" ? "Elige tu categoría y reserva tu horario oficial." : "Scegli la tua categoria e prenota il tuo slot ufficiale."}
          </p>
          <button className="bg-white text-[#8B0000] px-10 py-4 rounded-full font-bold text-lg hover:bg-[#FFD700] hover:text-gray-900 transition-all shadow-lg active:scale-95">
            {lang === "fr" ? "S'INSCRIRE MAINTENANT" : lang === "en" ? "REGISTER NOW" : lang === "es" ? "REGISTRARSE AHORA" : "REGISTRATI ORA"}
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
