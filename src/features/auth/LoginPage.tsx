import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/hooks/useAuth';
import { authenticateUser } from '../../lib/auth';
import { Card } from '../../components/Card';

const loginSchema = z.object({
  loginField: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState<'username' | 'phone'>('username');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });


  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      const user = await authenticateUser(data.loginField, data.password, 'YAZAMI');
      
      if (user) {
        // Store user in localStorage for session management
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          name: user.name,
          phone: user.phone,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId
        }));
        navigate('/dashboard');
      } else {
        setError(t('auth.invalidCredentials', 'Invalid username or password') as string);
      }
    } catch (error) {
      setError(t('auth.invalidCredentials', 'Invalid username or password') as string);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Frigo SaaS
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.signIn')}
          </p>
        </div>

        <Card className="mt-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Login Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.loginType', 'Type de connexion')}
              </label>
              <div className="flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setLoginType('username')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-md border ${
                    loginType === 'username'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('auth.username', 'Nom d\'utilisateur')}
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('phone')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    loginType === 'phone'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('auth.phone', 'Téléphone')}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="loginField" className="block text-sm font-medium text-gray-700">
                {loginType === 'username' 
                  ? t('auth.username', 'Nom d\'utilisateur')
                  : t('auth.phone', 'Téléphone')
                }
              </label>
              <input
                {...register('loginField')}
                type={loginType === 'phone' ? 'tel' : 'text'}
                id="loginField"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={loginType === 'username' ? 'nom_utilisateur' : '0666507474'}
              />
              {errors.loginField && (
                <p className="mt-1 text-sm text-red-600">{errors.loginField.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className="mt-1 block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('usersRoles.hidePassword', 'Masquer le mot de passe') as string : t('usersRoles.showPassword', 'Afficher le mot de passe') as string}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  t('auth.signIn')
                )}
              </button>
              
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
