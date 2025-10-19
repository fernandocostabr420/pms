'use client';

import { ReactNode } from 'react';

export default function UsuariosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-full">
      {children}
    </div>
  );
}