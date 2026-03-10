import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export const dynamic = 'force-dynamic';

interface BookingSuccessPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function BookingSuccessPage({ params }: BookingSuccessPageProps) {
  const { lang } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>}>
      <SuccessClient lang={lang} />
    </Suspense>
  );
}
