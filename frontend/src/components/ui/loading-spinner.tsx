// frontend/src/components/ui/loading-spinner.tsx

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

export default function LoadingSpinner({ 
  size = 'md', 
  className,
  text 
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 
          className={cn(
            "animate-spin text-gray-500",
            sizeClasses[size]
          )} 
        />
        {text && (
          <p className="text-sm text-gray-600">{text}</p>
        )}
      </div>
    </div>
  );
}

// Variação alternativa com círculos
export function CircleSpinner({ 
  size = 'md', 
  className 
}: Omit<LoadingSpinnerProps, 'text'>) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(
        "border-gray-300 border-t-blue-600 rounded-full animate-spin border-2",
        sizeClasses[size]
      )} />
    </div>
  );
}

// Variação para skeleton loading
export function SkeletonSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div className="h-4 bg-gray-200 rounded col-span-2"></div>
          <div className="h-4 bg-gray-200 rounded col-span-1"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}