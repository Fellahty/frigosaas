import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '../lib/queryClient';
import { enableOfflinePersistence } from '../lib/firebase';
import { router } from './router';
import './i18n/i18n';

export default function App() {
  // Initialize offline persistence on app start
  useEffect(() => {
    enableOfflinePersistence();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
