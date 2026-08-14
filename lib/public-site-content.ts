export type PublicLang = "fr" | "en" | "es" | "it";

export const supportedPublicLanguages: PublicLang[] = ["fr", "en", "es", "it"];

export function getPublicLang(lang: string): PublicLang {
  return supportedPublicLanguages.includes(lang as PublicLang)
    ? (lang as PublicLang)
    : "fr";
}

export const homeContent = {
  fr: {
    eventLabel: "Édition 2026",
    date: "27 et 28 octobre 2026",
    title: "Trophée Mondial de la Pizza 2026",
    subtitle:
      "Deux jours de compétition internationale pour révéler votre savoir-faire, défendre votre spécialité et rejoindre une communauté de pizzaiolos passionnés.",
    register: "Réserver ma participation",
    categories: "Découvrir les 12 catégories",
    urgency: "Les inscriptions sont ouvertes",
    urgencyText: "Choisissez vos catégories et votre créneau de passage dès maintenant.",
    introEyebrow: "Le rendez-vous des professionnels",
    introTitle: "Votre talent mérite une scène internationale",
    introText:
      "Le Trophée Mondial de la Pizza rassemble des professionnels venus confronter leur technique, leur créativité et leur maîtrise devant un jury qualifié. Chaque passage est une occasion de se mesurer, de progresser et de faire rayonner son métier.",
    stats: [
      { value: "12", label: "catégories officielles" },
      { value: "2", label: "jours de compétition" },
      { value: "757", label: "photos de l'édition 2025" },
    ],
    benefitsEyebrow: "Pourquoi participer",
    benefitsTitle: "Bien plus qu'un concours",
    benefits: [
      {
        title: "Valoriser votre savoir-faire",
        text: "Présentez votre travail, votre identité culinaire et vos techniques face à des professionnels du métier.",
      },
      {
        title: "Gagner en visibilité",
        text: "Faites connaître votre établissement, développez votre image et créez de nouvelles opportunités.",
      },
      {
        title: "Rejoindre un réseau",
        text: "Rencontrez pizzaiolos, jurés, partenaires et fournisseurs réunis par la même exigence.",
      },
    ],
    archiveEyebrow: "Édition 2025",
    archiveTitle: "L'intensité du trophée, en images",
    archiveText:
      "Des gestes techniques aux moments de partage, découvrez l'ambiance qui anime chaque édition.",
    archiveLink: "Voir toutes les photos 2025",
    galleryLink: "Ouvrir la galerie",
    stepsEyebrow: "Votre inscription",
    stepsTitle: "Trois étapes pour entrer en compétition",
    steps: [
      {
        title: "Créez votre compte",
        text: "Renseignez votre profil professionnel et vos coordonnées.",
      },
      {
        title: "Choisissez vos épreuves",
        text: "Sélectionnez une ou plusieurs catégories selon vos spécialités.",
      },
      {
        title: "Réservez votre passage",
        text: "Validez votre inscription et choisissez votre créneau disponible.",
      },
    ],
    stepsCta: "Commencer mon inscription",
    faqEyebrow: "Questions fréquentes",
    faqTitle: "Préparer votre participation",
    faq: [
      {
        question: "À qui s'adresse le Trophée ?",
        answer:
          "Le concours est ouvert aux professionnels des métiers de bouche âgés de 16 ans minimum.",
      },
      {
        question: "Puis-je participer à plusieurs catégories ?",
        answer:
          "Oui. Vous pouvez sélectionner plusieurs catégories et organiser vos créneaux depuis votre espace d'inscription.",
      },
      {
        question: "Dois-je apporter mes ingrédients ?",
        answer:
          "Oui. Chaque concurrent utilise ses propres produits. Les modalités techniques sont détaillées dans le règlement.",
      },
      {
        question: "Comment choisir mon horaire ?",
        answer:
          "Après validation de votre inscription, les créneaux disponibles sont proposés directement en ligne.",
      },
    ],
    faqLink: "Consulter le règlement complet",
    finalTitle: "Votre prochain titre commence ici",
    finalText:
      "Rejoignez l'édition 2026 du Trophée Mondial de la Pizza les 27 et 28 octobre.",
    finalCta: "Je m'inscris maintenant",
  },
  en: {
    eventLabel: "2026 edition",
    date: "27 & 28 October 2026",
    title: "World Pizza Trophy 2026",
    subtitle:
      "Two days of international competition to showcase your craft, represent your speciality and join a passionate community of pizza professionals.",
    register: "Reserve my place",
    categories: "Explore the 12 categories",
    urgency: "Registration is open",
    urgencyText: "Choose your categories and competition slot today.",
    introEyebrow: "The professional meeting place",
    introTitle: "Your talent deserves an international stage",
    introText:
      "The World Pizza Trophy brings professionals together to challenge their technique, creativity and precision before a qualified jury. Every performance is a chance to compete, improve and celebrate the craft.",
    stats: [
      { value: "12", label: "official categories" },
      { value: "2", label: "days of competition" },
      { value: "757", label: "photos from the 2025 edition" },
    ],
    benefitsEyebrow: "Why enter",
    benefitsTitle: "More than a competition",
    benefits: [
      {
        title: "Showcase your craft",
        text: "Present your work, culinary identity and techniques to recognised industry professionals.",
      },
      {
        title: "Build your visibility",
        text: "Promote your business, strengthen your image and create new professional opportunities.",
      },
      {
        title: "Join the network",
        text: "Meet pizza chefs, judges, partners and suppliers who share the same standards.",
      },
    ],
    archiveEyebrow: "2025 edition",
    archiveTitle: "The energy of the Trophy, in pictures",
    archiveText:
      "From technical performances to shared moments, discover the atmosphere behind every edition.",
    archiveLink: "View all 2025 photos",
    galleryLink: "Open the gallery",
    stepsEyebrow: "Your registration",
    stepsTitle: "Three steps to enter the competition",
    steps: [
      { title: "Create your account", text: "Add your professional profile and contact details." },
      { title: "Choose your events", text: "Select one or more categories that match your specialities." },
      { title: "Book your slot", text: "Confirm your registration and choose an available time." },
    ],
    stepsCta: "Start my registration",
    faqEyebrow: "Frequently asked questions",
    faqTitle: "Prepare your participation",
    faq: [
      { question: "Who can enter the Trophy?", answer: "The competition is open to food professionals aged 16 and over." },
      { question: "Can I enter several categories?", answer: "Yes. You can select several categories and organise your slots from your registration area." },
      { question: "Should I bring my ingredients?", answer: "Yes. Each competitor uses their own products. Technical details are listed in the rules." },
      { question: "How do I choose my time?", answer: "Available slots are offered online once your registration has been confirmed." },
    ],
    faqLink: "Read the complete rules",
    finalTitle: "Your next title starts here",
    finalText: "Join the 2026 World Pizza Trophy on 27 and 28 October.",
    finalCta: "Register now",
  },
  es: {
    eventLabel: "Edición 2026",
    date: "27 y 28 de octubre de 2026",
    title: "World Pizza Trophy 2026",
    subtitle:
      "Dos días de competición internacional para mostrar tu talento, defender tu especialidad y unirte a una comunidad apasionada de pizzeros.",
    register: "Reservar mi participación",
    categories: "Descubrir las 12 categorías",
    urgency: "Las inscripciones están abiertas",
    urgencyText: "Elige tus categorías y tu horario de competición desde ahora.",
    introEyebrow: "La cita de los profesionales",
    introTitle: "Tu talento merece un escenario internacional",
    introText:
      "El World Pizza Trophy reúne a profesionales para poner a prueba su técnica, creatividad y precisión ante un jurado cualificado. Cada actuación permite competir, progresar y dar visibilidad al oficio.",
    stats: [
      { value: "12", label: "categorías oficiales" },
      { value: "2", label: "días de competición" },
      { value: "757", label: "fotos de la edición 2025" },
    ],
    benefitsEyebrow: "Por qué participar",
    benefitsTitle: "Mucho más que un concurso",
    benefits: [
      { title: "Mostrar tu saber hacer", text: "Presenta tu trabajo, identidad culinaria y técnicas ante profesionales del sector." },
      { title: "Ganar visibilidad", text: "Da a conocer tu negocio, refuerza tu imagen y crea nuevas oportunidades." },
      { title: "Unirte a una red", text: "Conoce a pizzeros, jurados, colaboradores y proveedores con la misma exigencia." },
    ],
    archiveEyebrow: "Edición 2025",
    archiveTitle: "La intensidad del Trofeo, en imágenes",
    archiveText: "Desde los gestos técnicos hasta los momentos compartidos, descubre el ambiente de cada edición.",
    archiveLink: "Ver todas las fotos de 2025",
    galleryLink: "Abrir la galería",
    stepsEyebrow: "Tu inscripción",
    stepsTitle: "Tres pasos para entrar en competición",
    steps: [
      { title: "Crea tu cuenta", text: "Completa tu perfil profesional y tus datos de contacto." },
      { title: "Elige tus pruebas", text: "Selecciona una o varias categorías según tus especialidades." },
      { title: "Reserva tu turno", text: "Confirma la inscripción y elige un horario disponible." },
    ],
    stepsCta: "Empezar mi inscripción",
    faqEyebrow: "Preguntas frecuentes",
    faqTitle: "Preparar tu participación",
    faq: [
      { question: "¿A quién se dirige el Trofeo?", answer: "El concurso está abierto a profesionales de la alimentación mayores de 16 años." },
      { question: "¿Puedo participar en varias categorías?", answer: "Sí. Puedes elegir varias categorías y organizar tus turnos desde tu espacio de inscripción." },
      { question: "¿Debo llevar mis ingredientes?", answer: "Sí. Cada participante utiliza sus propios productos. Los detalles técnicos están en el reglamento." },
      { question: "¿Cómo elijo mi horario?", answer: "Los horarios disponibles se proponen en línea tras confirmar la inscripción." },
    ],
    faqLink: "Consultar el reglamento completo",
    finalTitle: "Tu próximo título empieza aquí",
    finalText: "Únete al World Pizza Trophy 2026 los días 27 y 28 de octubre.",
    finalCta: "Inscribirme ahora",
  },
  it: {
    eventLabel: "Edizione 2026",
    date: "27 e 28 ottobre 2026",
    title: "World Pizza Trophy 2026",
    subtitle:
      "Due giorni di competizione internazionale per mostrare il tuo talento, rappresentare la tua specialità e unirti a una comunità di pizzaioli appassionati.",
    register: "Prenota la partecipazione",
    categories: "Scopri le 12 categorie",
    urgency: "Le iscrizioni sono aperte",
    urgencyText: "Scegli subito le categorie e il tuo turno di gara.",
    introEyebrow: "L'appuntamento dei professionisti",
    introTitle: "Il tuo talento merita un palcoscenico internazionale",
    introText:
      "Il World Pizza Trophy riunisce professionisti che mettono alla prova tecnica, creatività e precisione davanti a una giuria qualificata. Ogni prova è un'occasione per confrontarsi, crescere e valorizzare il mestiere.",
    stats: [
      { value: "12", label: "categorie ufficiali" },
      { value: "2", label: "giorni di gara" },
      { value: "757", label: "foto dell'edizione 2025" },
    ],
    benefitsEyebrow: "Perché partecipare",
    benefitsTitle: "Molto più di una gara",
    benefits: [
      { title: "Valorizza la tua esperienza", text: "Presenta il tuo lavoro, la tua identità culinaria e le tue tecniche ai professionisti del settore." },
      { title: "Aumenta la tua visibilità", text: "Promuovi la tua attività, rafforza la tua immagine e crea nuove opportunità." },
      { title: "Entra nella rete", text: "Incontra pizzaioli, giudici, partner e fornitori che condividono la stessa passione." },
    ],
    archiveEyebrow: "Edizione 2025",
    archiveTitle: "L'intensità del Trofeo, in immagini",
    archiveText: "Dai gesti tecnici ai momenti di condivisione, scopri l'atmosfera di ogni edizione.",
    archiveLink: "Guarda tutte le foto del 2025",
    galleryLink: "Apri la galleria",
    stepsEyebrow: "La tua iscrizione",
    stepsTitle: "Tre passi per entrare in gara",
    steps: [
      { title: "Crea il tuo account", text: "Inserisci il profilo professionale e i tuoi contatti." },
      { title: "Scegli le prove", text: "Seleziona una o più categorie in base alle tue specialità." },
      { title: "Prenota il turno", text: "Conferma l'iscrizione e scegli un orario disponibile." },
    ],
    stepsCta: "Inizia l'iscrizione",
    faqEyebrow: "Domande frequenti",
    faqTitle: "Prepara la tua partecipazione",
    faq: [
      { question: "A chi è rivolto il Trofeo?", answer: "La gara è aperta ai professionisti della ristorazione dai 16 anni in su." },
      { question: "Posso partecipare a più categorie?", answer: "Sì. Puoi scegliere più categorie e organizzare i turni nell'area di iscrizione." },
      { question: "Devo portare gli ingredienti?", answer: "Sì. Ogni concorrente usa i propri prodotti. I dettagli tecnici sono nel regolamento." },
      { question: "Come scelgo l'orario?", answer: "Gli orari disponibili vengono proposti online dopo la conferma dell'iscrizione." },
    ],
    faqLink: "Consulta il regolamento completo",
    finalTitle: "Il tuo prossimo titolo inizia qui",
    finalText: "Partecipa al World Pizza Trophy 2026 il 27 e 28 ottobre.",
    finalCta: "Iscriviti ora",
  },
} satisfies Record<PublicLang, Record<string, unknown>>;
