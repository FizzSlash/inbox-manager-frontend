import React, { useState, useEffect } from 'react';
import { signIn, signUp, supabase } from '../lib/supabase';
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle } from 'lucide-react';

const Auth = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerifyTab, setShowVerifyTab] = useState(false);
  const [userNeedsVerification, setUserNeedsVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
      } else if (data?.user) {
        if (isSignUp && !data.user.email_confirmed_at) {
          setShowVerifyTab(true);
          setUserNeedsVerification(true);
          setPendingUser(data.user);
        } else {
          // Always create profile if needed after any successful login/signup
          await createProfileIfNeeded(data.user);
          onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Helper to create profile if it doesn't exist
  const createProfileIfNeeded = async (user) => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!profile) {
      // Set brand_id to null for new users
      await supabase.from('profiles').insert([
        { id: user.id, email: user.email, brand_id: null }
      ]);
    }
  };

  // Poll for email verification if needed
  useEffect(() => {
    let interval;
    if (userNeedsVerification && pendingUser) {
      interval = setInterval(async () => {
        const { data: refreshedUser } = await supabase.auth.getUser();
        if (refreshedUser?.user?.email_confirmed_at) {
          setShowVerifyTab(false);
          setUserNeedsVerification(false);
          await createProfileIfNeeded(refreshedUser.user);
          onAuthSuccess(refreshedUser.user);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [userNeedsVerification, pendingUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isSignUp 
              ? 'Get started with your multi-brand inbox' 
              : 'Access your multi-brand inbox'
            }
          </p>
        </div>

        {showVerifyTab ? (
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Verify your email</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              We've sent a confirmation link to <span className="font-semibold">{pendingUser?.email}</span>.<br/>
              Please check your inbox and click the link to verify your email.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Once verified, this page will automatically update.
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    {isSignUp ? (
                      <>
                        <UserPlus className="h-5 w-5 mr-2" />
                        Sign up
                      </>
                    ) : (
                      <>
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign in
                      </>
                    )}
                  </>
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth; 