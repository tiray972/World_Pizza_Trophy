"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type SupportedLang = "fr" | "en" | "es" | "it";

type Props = {
  params: Promise<{ lang: string }>;
};

export default function ContactPage({ params }: Props) {
  const [dictionary, setDictionary] = useState<any>(null);
  const [lang, setLang] = useState<SupportedLang>("fr");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    params.then(({ lang: rawLang }) => {
      const validLang: SupportedLang = ["fr", "en", "es", "it"].includes(rawLang)
        ? (rawLang as SupportedLang)
        : "fr";
      setLang(validLang);
      getDictionary(validLang).then(setDictionary);
    });
  }, [params]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    }, 3000);
  };

  if (!dictionary) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const contact = dictionary.contact;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} />

      <main className="flex-grow container mx-auto px-4 py-16 max-w-7xl">
        {/* Header Section */}
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#8B0000] mb-4">
            {contact.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {contact.subtitle}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Info Cards */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] text-2xl">
                ✉️
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {contact.info.email.label}
              </h3>
            </div>
            <p className="text-gray-600 break-all font-semibold">
              {contact.info.email.value}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] text-2xl">
                📞
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {contact.info.phone.label}
              </h3>
            </div>
            <p className="text-gray-600 font-semibold">
              {contact.info.phone.value}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center text-[#8B0000] text-2xl">
                📍
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {contact.info.address.label}
              </h3>
            </div>
            <p className="text-gray-600 font-semibold leading-relaxed">
              {contact.info.address.value}
            </p>
          </div>
        </div>

        {/* Hours Card */}
        <div className="bg-gradient-to-r from-[#8B0000]/5 to-[#8B0000]/10 border-l-4 border-[#8B0000] rounded-xl p-8 mb-16">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🕐</span>
            <h3 className="text-xl font-bold text-gray-900">
              {contact.info.hours.label}
            </h3>
          </div>
          <p className="text-gray-700 whitespace-pre-line font-semibold leading-relaxed">
            {contact.info.hours.value}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-lg border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {lang === "fr"
                ? "Envoyez-nous un Message"
                : lang === "en"
                ? "Send us a Message"
                : lang === "es"
                ? "Envíanos un Mensaje"
                : "Inviaci un Messaggio"}
            </h2>

            {submitted && (
              <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded-lg">
                <p className="text-green-800 font-semibold">
                  {lang === "fr"
                    ? "✓ Message envoyé avec succès !"
                    : lang === "en"
                    ? "✓ Message sent successfully!"
                    : lang === "es"
                    ? "✓ ¡Mensaje enviado con éxito!"
                    : "✓ Messaggio inviato con successo!"}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {contact.form.name}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={contact.form.placeholders.name}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {contact.form.email}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={contact.form.placeholders.email}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {contact.form.phone}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={contact.form.placeholders.phone}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {contact.form.subject}
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder={contact.form.placeholders.subject}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {contact.form.message}
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder={contact.form.placeholders.message}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#8B0000] hover:bg-[#A50000] text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg active:scale-95"
              >
                {contact.form.submit} ✉️
              </button>
            </form>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-lg border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {contact.faq.title}
            </h2>

            <div className="space-y-6">
              {contact.faq.items.map((item: any, idx: number) => (
                <div key={idx} className="border-b border-gray-200 pb-6 last:border-b-0">
                  <h3 className="text-lg font-bold text-[#8B0000] mb-3 flex items-start gap-3">
                    <span className="text-2xl">❓</span>
                    <span>{item.question}</span>
                  </h3>
                  <p className="text-gray-600 leading-relaxed ml-9">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
