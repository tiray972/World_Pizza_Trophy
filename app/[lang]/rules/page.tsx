import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type RulesPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function RulesPage({ params }: RulesPageProps) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  const rules = dictionary.rules;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang as any} />
      
      <main className="flex-grow container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#8B0000] mb-4">
            {rules.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {rules.subtitle}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rules.categories.map((cat: any) => (
            <div 
              key={cat.id} 
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1 group"
            >
              <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] font-bold text-xl mb-6 group-hover:bg-[#8B0000] group-hover:text-white transition-colors">
                {cat.name.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {cat.name}
              </h3>
              <p className="text-gray-500 leading-relaxed">
                {cat.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-20 bg-[#8B0000] rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-3xl font-bold mb-6">Prêt à concourir ?</h2>
          <p className="mb-8 text-[#FFD700] font-medium text-lg">
            Choisissez votre catégorie et réservez votre créneau officiel.
          </p>
          <button className="bg-white text-[#8B0000] px-10 py-4 rounded-full font-bold hover:bg-[#FFD700] hover:text-gray-900 transition-all shadow-lg active:scale-95">
            S'INSCRIRE MAINTENANT
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
