// Importations similaires...
// ...

export async function POST(req: Request) {
    try {
        const { productStripePriceId, slotsToReserve, userId, userEmail } = await req.json();
        // slotsToReserve sera un tableau d'objets : [{ slotId: 'id1', categoryId: 'catA' }, { slotId: 'id2', categoryId: 'catB' }]

        if (!productStripePriceId || !slotsToReserve.length || !userId || !userEmail) {
            return NextResponse.json({ error: "Données de pack/slots manquantes." }, { status: 400 });
        }

        const productDoc = await adminDB.collection("products").where('stripePriceId', '==', productStripePriceId).limit(1).get();
        if (productDoc.empty) throw new Error("Produit non trouvé.");
        const productData = productDoc.docs[0].data() as Product;

        // --- 1. Transaction Firestore : Verrouiller TOUS les slots ---
        const slotRefs = slotsToReserve.map((s: { slotId: string }) => doc(db, "slots", s.slotId));
        let newStripeSessionId: string | null = null;
        
        await runTransaction(db, async (transaction) => {
            const slotDocs = await Promise.all(slotRefs.map(ref => transaction.get(ref)));

            for (const slotDoc of slotDocs) {
                if (!slotDoc.exists() || slotDoc.data().userId) {
                    throw new Error("Au moins un créneau est déjà pris ou introuvable.");
                }
            }

            // Si tout est bon, verrouiller tous les slots avec un placeholder
            slotRefs.forEach(ref => {
                transaction.update(ref, { 
                    userId: userId, 
                    status: "locked", 
                    stripeSessionId: "pending_" + userId,
                });
            });
        });

        // --- 2. Créer la Session Stripe (Hors transaction) ---
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: userEmail,
            line_items: [{ price: productStripePriceId, quantity: 1 }],
            metadata: {
                userId: userId,
                // Stocker les IDs de slot verrouillés dans les métadonnées pour le webhook
                slots: slotsToReserve.map((s: { slotId: string }) => s.slotId).join(','), 
                productName: productData.name
            },
            // ... (URLs de succès et d'annulation)
        });
        
        newStripeSessionId = session.id;

        // --- 3. Mettre à jour les slots avec l'ID de Session Stripe ---
        const batch = adminDB.batch();
        slotsToReserve.forEach((s: { slotId: string }) => {
            batch.update(adminDB.collection("slots").doc(s.slotId), {
                stripeSessionId: newStripeSessionId,
            });
        });
        await batch.commit();

        return NextResponse.json({ url: session.url, sessionId: newStripeSessionId });

    } catch (error: any) {
        // ... (Logique de gestion d'erreur)
        return NextResponse.json({ error: error.message || "Erreur lors du checkout de pack." }, { status: 500 });
    }
}