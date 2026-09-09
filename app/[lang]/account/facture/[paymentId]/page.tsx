'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader, Printer } from 'lucide-react';
import {
  buildInvoiceLines,
  formatInvoiceAmount,
  formatInvoiceDate,
  formatInvoiceTime,
  INVOICE_ISSUER,
  invoiceNumber,
  type InvoicePaymentInput,
  type InvoiceSlotInput,
} from '@/lib/invoice/invoice';

interface InvoiceState {
  payment: InvoicePaymentInput & {
    status: string;
    source: string;
    eventId: string;
    stripeInvoiceNumber?: string | null;
    stripeInvoicePdf?: string | null;
    stripeInvoiceUrl?: string | null;
  };
  slots: InvoiceSlotInput[];
  slotParticipants: Record<string, string[]>;
  categoryPrices: Record<string, number>;
  eventName: string;
  buyer: { firstName: string; lastName: string; email: string; address?: string; country?: string };
}

const toDate = (value: unknown): Date =>
  value instanceof Timestamp ? value.toDate() : new Date(value as string);

export default function InvoicePage({
  params,
}: {
  params: Promise<{ lang: string; paymentId: string }>;
}) {
  const { lang, paymentId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(`/${lang}/auth/login?redirect=/account`);
      return;
    }

    const load = async () => {
      try {
        const paymentSnap = await getDoc(doc(db, 'payments', paymentId));
        if (!paymentSnap.exists()) {
          setError("Cette facture est introuvable.");
          setPageLoading(false);
          return;
        }

        const paymentData = paymentSnap.data();
        // 🔒 On ne montre que ses propres factures
        if (paymentData.userId !== user.uid) {
          setError("Cette facture ne vous appartient pas.");
          setPageLoading(false);
          return;
        }

        const payment = {
          id: paymentSnap.id,
          amount: Number(paymentData.amount || 0),
          createdAt: toDate(paymentData.createdAt),
          isPack: !!paymentData.isPack,
          packName: paymentData.packName,
          slotIds: (paymentData.slotIds || []) as string[],
          metadata: (paymentData.metadata || null) as Record<string, string> | null,
          status: paymentData.status || 'paid',
          source: paymentData.source || 'stripe',
          eventId: paymentData.eventId || '',
          stripeInvoiceNumber: paymentData.stripeInvoiceNumber || null,
          stripeInvoicePdf: paymentData.stripeInvoicePdf || null,
          stripeInvoiceUrl: paymentData.stripeInvoiceUrl || null,
        };

        // Créneaux du paiement + catégories associées
        const slots: InvoiceSlotInput[] = [];
        const slotParticipants: Record<string, string[]> = {};
        const categoryPrices: Record<string, number> = {};
        const categoryNames: Record<string, string> = {};

        for (const slotId of payment.slotIds) {
          const slotSnap = await getDoc(doc(db, 'slots', slotId));
          if (!slotSnap.exists()) continue;
          const slotData = slotSnap.data();

          if (!categoryNames[slotData.categoryId]) {
            const categorySnap = await getDoc(doc(db, 'categories', slotData.categoryId));
            categoryNames[slotData.categoryId] = categorySnap.exists()
              ? categorySnap.data().name
              : 'Catégorie';
            categoryPrices[slotData.categoryId] = categorySnap.exists()
              ? Number(categorySnap.data().unitPrice || 0)
              : 0;
          }

          const participants = Array.isArray(slotData.participants) && slotData.participants.length > 0
            ? slotData.participants
            : slotData.participant
              ? [slotData.participant]
              : [];

          slots.push({
            id: slotSnap.id,
            categoryId: slotData.categoryId,
            categoryName: categoryNames[slotData.categoryId],
            date: slotData.date,
            startTime: toDate(slotData.startTime),
            endTime: toDate(slotData.endTime),
          });
          slotParticipants[slotSnap.id] = participants.map(
            (participant: { firstName: string; lastName: string }) =>
              `${participant.firstName} ${participant.lastName}`.trim()
          );
        }

        slots.sort((a, b) =>
          a.date === b.date ? a.startTime.getTime() - b.startTime.getTime() : a.date.localeCompare(b.date)
        );

        let eventName = '';
        if (payment.eventId) {
          const eventSnap = await getDoc(doc(db, 'events', payment.eventId));
          if (eventSnap.exists()) {
            eventName = `${eventSnap.data().name} ${eventSnap.data().eventYear || ''}`.trim();
          }
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};

        setInvoice({
          payment,
          slots,
          slotParticipants,
          categoryPrices,
          eventName,
          buyer: {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || user.email || '',
            country: userData.country || '',
          },
        });
        setPageLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement de la facture:', err);
        setError("Impossible de charger cette facture.");
        setPageLoading(false);
      }
    };

    load();
  }, [user, loading, paymentId, lang, router]);

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-[#8B0000]" />
          <p className="text-gray-600">Préparation de votre facture...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-gray-700">{error}</p>
          <Button asChild variant="outline">
            <Link href={`/${lang}/account`}>Retour à mon compte</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { payment, slots, slotParticipants, categoryPrices, eventName, buyer } = invoice;
  const { lines, total } = buildInvoiceLines(payment, slots, categoryPrices);
  const number = invoiceNumber(payment);

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      {/* 🖨️ Mise en page impression : seule la facture est imprimée */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .invoice-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
          }
          @page {
            margin: 16mm;
          }
        }
      `}</style>

      <div className="container mx-auto px-4 max-w-3xl">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
          <Button asChild variant="outline">
            <Link href={`/${lang}/account`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à mon compte
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {/* 🧾 Facture officielle émise par Stripe, si elle existe */}
            {(payment.stripeInvoicePdf || payment.stripeInvoiceUrl) && (
              <Button asChild variant="outline">
                <a
                  href={payment.stripeInvoicePdf || payment.stripeInvoiceUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Facture officielle
                  {payment.stripeInvoiceNumber ? ` ${payment.stripeInvoiceNumber}` : ''} (PDF)
                </a>
              </Button>
            )}
            <Button className="bg-[#8B0000] hover:bg-[#A50000]" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Télécharger / Imprimer en PDF
            </Button>
          </div>
        </div>

        <div className="invoice-sheet bg-white shadow-lg rounded-lg p-8 md:p-12">
          {/* En-tête */}
          <div className="flex flex-wrap justify-between gap-6 border-b pb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-[#8B0000]">{INVOICE_ISSUER.name}</h1>
              {INVOICE_ISSUER.legalName !== INVOICE_ISSUER.name && (
                <p className="text-sm text-gray-600">{INVOICE_ISSUER.legalName}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">{INVOICE_ISSUER.address}</p>
              <p className="text-sm text-gray-600">{INVOICE_ISSUER.email}</p>
              <p className="text-sm text-gray-600">{INVOICE_ISSUER.phone}</p>
              {INVOICE_ISSUER.registrationNumber && (
                <p className="text-sm text-gray-600">N° {INVOICE_ISSUER.registrationNumber}</p>
              )}
              {INVOICE_ISSUER.vatNumber && (
                <p className="text-sm text-gray-600">TVA {INVOICE_ISSUER.vatNumber}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">
                {payment.stripeInvoicePdf || payment.stripeInvoiceUrl
                  ? 'RÉCAPITULATIF'
                  : 'FACTURE'}
              </p>
              <p className="text-sm text-gray-600 mt-1">N° {number}</p>
              <p className="text-sm text-gray-600">
                Date : {formatInvoiceDate(payment.createdAt)}
              </p>
              <p className="text-sm font-semibold text-green-700 mt-2">
                {payment.status === 'paid' ? '✓ Payée' : payment.status}
              </p>
            </div>
          </div>

          {/* Client & événement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b">
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-2">Facturé à</p>
              <p className="font-semibold text-gray-900">
                {buyer.firstName} {buyer.lastName}
              </p>
              <p className="text-sm text-gray-600">{buyer.email}</p>
              {buyer.country && <p className="text-sm text-gray-600">{buyer.country}</p>}
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase font-semibold text-gray-500 mb-2">Événement</p>
              <p className="font-semibold text-gray-900">{eventName || '—'}</p>
              <p className="text-sm text-gray-600">
                Règlement : {payment.source === 'stripe' ? 'Carte bancaire (Stripe)' : payment.source}
              </p>
            </div>
          </div>

          {/* Lignes */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="pb-2">Désignation</th>
                  <th className="pb-2 text-center">Qté</th>
                  <th className="pb-2 text-right">P.U.</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-gray-900">{line.label}</p>
                      {line.details && <p className="text-xs text-gray-500 mt-1">{line.details}</p>}
                    </td>
                    <td className="py-3 text-center">{line.quantity}</td>
                    <td className="py-3 text-right">{formatInvoiceAmount(line.unitPrice)}</td>
                    <td className="py-3 text-right font-semibold">{formatInvoiceAmount(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end border-t pt-4">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total payé</span>
                <span className="text-[#8B0000]">{formatInvoiceAmount(total)}</span>
              </div>
              {INVOICE_ISSUER.vatNote && (
                <p className="text-xs text-gray-500 text-right">{INVOICE_ISSUER.vatNote}</p>
              )}
            </div>
          </div>

          {/* Détail des passages */}
          {slots.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <p className="text-xs uppercase font-semibold text-gray-500 mb-3">
                Détail des créneaux et participants
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Horaire</th>
                    <th className="pb-2">Catégorie</th>
                    <th className="pb-2">Participant(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot.id} className="border-b last:border-b-0">
                      <td className="py-2 whitespace-nowrap">{formatInvoiceDate(slot.date)}</td>
                      <td className="py-2 whitespace-nowrap">
                        {formatInvoiceTime(slot.startTime)} – {formatInvoiceTime(slot.endTime)}
                      </td>
                      <td className="py-2">{slot.categoryName}</td>
                      <td className="py-2">{slotParticipants[slot.id]?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-8 pt-4 border-t">
            Référence de transaction : {payment.id}
            {payment.metadata?.bookingRef ? ` · ${payment.metadata.bookingRef}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
