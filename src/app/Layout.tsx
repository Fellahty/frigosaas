import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/hooks/useAuth';
import { LangSwitcher } from '../components/LangSwitcher';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    operations: false,
    finance: false,
  });
  const isRtl = typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/login');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isSectionActive = (paths: string[]) => {
    return paths.some(path => location.pathname === path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            aria-label="Toggle menu"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="p-2 rounded-md border border-gray-200 text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-semibold text-gray-900">Frigo SaaS</h1>
            {user && (
              <p className="text-xs text-gray-500">{user.name} • {t(`roles.${user.role}`, user.role)}</p>
            )}
          </div>
          <LangSwitcher />
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} w-64 bg-white shadow-lg z-50 transition-transform duration-200 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">LYAZAMI</h1>
            <LangSwitcher />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {/* Dashboard */}
              <li>
                <Link
                  to="/dashboard"
                  className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/dashboard')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                  {t('common.dashboard')}
                </Link>
              </li>

              {/* Clients */}
              <li>
                <Link
                  to="/clients"
                  className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/clients')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('common.clients')}
                </Link>
              </li>

              {/* Réservations */}
              <li>
                <Link
                  to="/reservations"
                  className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/reservations')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                  </svg>
                  {t('sidebar.reservations', 'Réservations')}
                </Link>
              </li>

              {/* Capteurs */}
              <li>
                <Link
                  to="/sensors"
                  className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/sensors')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t('sidebar.sensors', 'Capteurs')}
                  </div>
                  <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-600 border border-orange-200/50 shadow-sm">
                    DEMO
                  </span>
                </Link>
              </li>

              {/* Opérations */}
              <li>
                <button
                  onClick={() => toggleSection('operations')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
                    isSectionActive(['/loans', '/reception'])
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    {t('sidebar.operations', 'Opérations')}
                  </div>
                  <svg 
                    className={`w-3 h-3 transition-transform ${expandedSections.operations ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.operations && (
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>
                      <Link
                        to="/loans"
                        className={`flex items-center px-3 py-1.5 rounded-md transition-colors text-xs ${
                          isActive('/loans')
                            ? 'bg-blue-100 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H3V7zm4-4h10a2 2 0 012 2v2H7V3z" />
                        </svg>
                        {t('loans.title', 'Prêt caisses vides')}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/reception"
                        className={`flex items-center px-3 py-1.5 rounded-md transition-colors text-xs ${
                          isActive('/reception')
                            ? 'bg-blue-100 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        {t('sidebar.receptionFull', 'Réception pleines')}
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {/* Finance */}
              <li>
                <button
                  onClick={() => toggleSection('finance')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
                    isSectionActive(['/billing', '/caisse'])
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    {t('sidebar.finance', 'Finance')}
                  </div>
                  <svg 
                    className={`w-3 h-3 transition-transform ${expandedSections.finance ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.finance && (
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>
                      <Link
                        to="/billing"
                        className={`flex items-center px-3 py-1.5 rounded-md transition-colors text-xs ${
                          isActive('/billing')
                            ? 'bg-blue-100 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2-2 4 4m0 0l4-4m-4 4V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h8z" />
                        </svg>
                        {t('sidebar.invoicesPayments', 'Factures & Paiements')}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/caisse"
                        className={`flex items-center px-3 py-1.5 rounded-md transition-colors text-xs ${
                          isActive('/caisse')
                            ? 'bg-blue-100 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                        </svg>
                        {t('sidebar.cashRegister', 'Caisse')}
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {/* Paramètres */}
              <li>
                <Link
                  to="/settings"
                  className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/settings')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('sidebar.frigoSettings', 'Paramètres')}
                </Link>
              </li>

              {/* Utilisateurs */}
              <li>
                <Link
                  to="/users"
                  className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive('/users')
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  {t('usersRoles.title', 'Utilisateurs')}
                </Link>
              </li>

            </ul>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            {/* User Info */}
            {user && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{t(`roles.${user.role}`, user.role)}</p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`${isRtl ? 'md:mr-64' : 'md:ml-64'} p-4 md:p-8`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
