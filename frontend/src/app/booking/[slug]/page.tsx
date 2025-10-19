// frontend/src/app/booking/[slug]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import BookingEngine from '@/components/booking/BookingEngine';
import { Loader2 } from 'lucide-react';

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [mounted, setMounted] = useState(false);

  // Só renderiza após montar no cliente (evita hidratação)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <BookingEngine slug={slug} />;
}