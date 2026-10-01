'use client';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } }),
  );
  return (
    <ThemeProvider nonce={nonce} attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="user">
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
