// frontend/src/app/booking/[slug]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import BookingEngine from '@/components/booking/BookingEngine';

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  return <BookingEngine slug={slug} />;
}