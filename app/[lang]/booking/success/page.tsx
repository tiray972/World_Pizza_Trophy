import { Suspense } from 'react';
import SuccessClient from './SuccessClient';
import { bookingTexts } from '@/lib/i18n/booking-texts';

export const dynamic = 'force-dynamic';

interface BookingSuccessPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function BookingSuccessPage({ params }: BookingSuccessPageProps) {
  const { lang } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p role="status">{bookingTexts(lang).loading}</p></div>}>
      <SuccessClient lang={lang} />
    </Suspense>
  );
}
