import React from 'react';
import { createBrowserRouter, Navigate, Outlet, useRouteError } from 'react-router-dom';
import { Layout } from './Layout';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ClientsPage } from '../features/clients/ClientsPage';
import { StockAndLocations } from '../features/dashboard/StockAndLocations';
import { BillingPage } from '../features/billing/BillingPage';
import { UsersRolesPage } from '../features/users/UsersRolesPage';
import { CaissePage } from '../features/caisse/CaissePage';
import { SettingsLayout } from '../features/settings/SettingsLayout';
import AppSettingsPage from '../features/settings/AppSettingsPage';
import { AlertsPage } from '../features/alerts/AlertsPage';
import { EmptyCrateLoansPage } from '../features/loans/EmptyCrateLoansPage';
import { ReceptionPage } from '../features/operations/ReceptionPage';
import { ReservationsPage } from '../features/reservations/ReservationsPage';
import { ProtectedRoute } from './ProtectedRoute';

// Error Boundary Component
const ErrorBoundary = () => {
  const error = useRouteError() as any;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {error?.status === 404 ? 'Page non trouvée' : 'Erreur inattendue'}
        </h1>
        <p className="text-gray-600 mb-4">
          {error?.status === 404 
            ? 'La page que vous recherchez n\'existe pas.' 
            : 'Une erreur s\'est produite. Veuillez réessayer.'}
        </p>
        <div className="space-y-2">
          <button
            onClick={() => window.history.back()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retour
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Aller au tableau de bord
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Détails de l'erreur</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Layout>
            <DashboardPage />
          </Layout>
        ),
      },
      {
        path: 'clients',
        element: (
          <Layout>
            <ClientsPage />
          </Layout>
        ),
      },
      {
        path: 'reservations',
        element: (
          <Layout>
            <ReservationsPage />
          </Layout>
        ),
      },
      {
        path: 'stock',
        element: (
          <Layout>
            <StockAndLocations />
          </Layout>
        ),
      },
      {
        path: 'billing',
        element: (
          <Layout>
            <BillingPage />
          </Layout>
        ),
      },
      {
        path: 'users',
        element: (
          <Layout>
            <UsersRolesPage />
          </Layout>
        ),
      },
      {
        path: 'caisse',
        element: (
          <Layout>
            <CaissePage />
          </Layout>
        ),
      },
      {
        path: 'settings',
        element: (
          <Layout>
            <SettingsLayout />
          </Layout>
        ),
      },
      {
        path: 'settings/app',
        element: (
          <Layout>
            <AppSettingsPage />
          </Layout>
        ),
      },
      {
        path: 'alerts',
        element: (
          <Layout>
            <AlertsPage />
          </Layout>
        ),
      },
      {
        path: 'loans',
        element: (
          <Layout>
            <EmptyCrateLoansPage />
          </Layout>
        ),
      },
      {
        path: 'reception',
        element: (
          <Layout>
            <ReceptionPage />
          </Layout>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <ErrorBoundary />,
  },
]);
