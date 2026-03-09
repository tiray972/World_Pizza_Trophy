import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function GalleryPage({ params }: { params: { lang: string } }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header lang={params.lang as any} />
      <main className="flex-grow flex items-center justify-center p-8">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-black text-gray-900 mb-6">PHOTO GALLERY</h1>
          <p className="text-xl text-gray-500 mb-8 italic">Relive the highlights of the competition. Photos coming soon!</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-gray-300">
                 📸
               </div>
             ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
