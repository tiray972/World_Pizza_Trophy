export default function ProductCardGrid({ products = [] }) {
  return (
    <section className="py-16 px-4 md:px-12 bg-[#f8f8f8]">
      <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-3">
        {products.map((p, i) => (
          <div key={i} className="bg-white rounded-xl shadow-md p-6 flex flex-col">
            <img src={p.image} alt={p.title} className="w-full h-48 object-cover rounded mb-4" />
            <h3 className="text-xl font-bold mb-2">{p.title}</h3>
            <p className="text-gray-500 mb-4">{p.description}</p>
            {p.buttonText && (
              <button className="mt-auto px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition">
                {p.buttonText}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
