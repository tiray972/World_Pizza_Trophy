import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function EditionsPage({ params }: { params: { lang: string } }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header lang={params.lang as any} />
      <main className="flex-grow flex flex-col items-center justify-center p-8">
        <h1 className="text-5xl font-black text-[#8B0000] mb-6">PREVIOUS EDITIONS</h1>
        <div className="space-y-8 max-w-4xl w-full">
          <div className="border-l-4 border-[#FFD700] pl-8 py-4">
             <h2 className="text-3xl font-bold text-gray-900">2024 EDITION</h2>
             <p className="text-gray-500 italic mt-2">The current world championship is underway.</p>
          </div>
          <div className="border-l-4 border-gray-200 pl-8 py-4 opacity-50">
             <h2 className="text-3xl font-bold text-gray-400">2023 EDITION</h2>
             <p className="text-gray-400 italic mt-2">Archives coming soon.</p>
          </div>
          <div className="border-l-4 border-gray-200 pl-8 py-4 opacity-50">
             <h2 className="text-3xl font-bold text-gray-400">2022 EDITION</h2>
             <p className="text-gray-400 italic mt-2">Archives coming soon.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
