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
      let signupUser = null;
      if (isSignUp) {
        const { data, error } = await signUp(email, password);
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        signupUser = data?.user;
        // Immediately create brand and profile after signup
        if (signupUser) {
          // Create a brand for this user
          const { data: brandData } = await supabase.rpc('create_brand_for_user', {
            user_id: signupUser.id,
            user_email: signupUser.email
          });
          
          const brandId = brandData || 1; // Fallback to 1 if function fails
          
          await supabase.from('profiles').insert([
            { id: signupUser.id, email: signupUser.email, brand_id: brandId }
          ]);
        }
        if (!signupUser?.email_confirmed_at) {
          setShowVerifyTab(true);
          setUserNeedsVerification(true);
          setPendingUser(signupUser);
          setLoading(false);
          return;
        }
      }
      // Continue with login or post-signup flow
      const { data, error } = isSignUp
        ? await signIn(email, password)
        : await signIn(email, password);
      if (error) {
        setError(error.message);
      } else if (data?.user) {
        await createProfileIfNeeded(data.user);
        onAuthSuccess(data.user);
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
      // Create a brand for this user
      const { data: brandData } = await supabase.rpc('create_brand_for_user', {
        user_id: user.id,
        user_email: user.email
      });
      
      const brandId = brandData || 1; // Fallback to 1 if function fails
      
      await supabase.from('profiles').insert([
        { id: user.id, email: user.email, brand_id: brandId }
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
    }}>
      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-2xl p-8 border border-white/20 relative overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div className="relative z-10">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            {/* Logo with glowing radial effect */}
            <div className="mx-auto w-32 h-32 mb-4 relative flex items-center justify-center">
              {/* Radial glow effect */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Multiple glowing rings for depth */}
                <div className="absolute w-24 h-24 rounded-full animate-pulse opacity-25" style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, rgba(37, 99, 235, 0.2) 40%, transparent 70%)',
                  animationDuration: '3s'
                }}></div>
                <div className="absolute w-28 h-28 rounded-full animate-pulse opacity-20" style={{
                  background: 'radial-gradient(circle, rgba(37, 99, 235, 0.4) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 80%)',
                  animationDuration: '4s',
                  animationDelay: '1s'
                }}></div>
                <div className="absolute w-32 h-32 rounded-full animate-pulse opacity-15" style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 60%)',
                  animationDuration: '5s',
                  animationDelay: '2s'
                }}></div>
              </div>
              
              {/* Main logo */}
              <div className="relative z-10 transform hover:scale-105 transition-transform duration-500">
                <img 
                  src="/logo.png?v=5" 
                  alt="Logo" 
                  className="w-20 h-20 object-contain drop-shadow-lg"
                  onError={(e) => {
                    // Fallback if logo doesn't load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 items-center justify-center rounded-full shadow-lg">
                  <span className="text-white text-2xl font-bold">LOGO</span>
                </div>
              </div>
            </div>
            
            {/* Header */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 text-sm">
              {isSignUp 
                ? 'Start your 7-day free trial - 10,000 leads included' 
                : 'Sign in to access your lead management platform'
              }
            </p>
          </div>

        {showVerifyTab ? (
          <div className="text-center">
            <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-blue-50/80 to-cyan-50/80 backdrop-blur-sm border border-blue-200/50 shadow-sm">
              <div className="relative inline-flex items-center justify-center mb-4">
                <div className="absolute inset-0 bg-blue-400 rounded-full opacity-20 animate-ping"></div>
                <Mail className="w-12 h-12 text-blue-500 relative z-10" />
              </div>
              <h2 className="text-xl font-semibold mb-3 text-gray-900">Check your email</h2>
              <p className="mb-3 text-gray-700 text-sm">
                We've sent a confirmation link to<br/>
                <span className="font-semibold text-blue-600 font-mono text-xs px-2 py-1 bg-blue-100 rounded">{pendingUser?.email}</span>
              </p>
              <p className="text-xs text-gray-500">
                Click the link to verify your account. This page will update automatically.
              </p>
            </div>
            
            <div className="flex items-center justify-center p-4 rounded-xl bg-gray-50/80 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 border-t-blue-500"></div>
              <span className="ml-3 text-sm text-gray-600 font-medium">Waiting for verification...</span>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail style={{ width: '20px', height: '20px', color: '#000000', stroke: '#000000', fill: 'none' }} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border-0 rounded-xl text-gray-900 placeholder-gray-400 bg-gray-50/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white focus:shadow-lg transition-all duration-300 text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock style={{ width: '20px', height: '20px', color: '#000000', stroke: '#000000', fill: 'none' }} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border-0 rounded-xl text-gray-900 placeholder-gray-400 bg-gray-50/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white focus:shadow-lg transition-all duration-300 text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200/50 shadow-sm">
                <div className="flex items-center space-x-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white relative overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
              }}
            >
              {/* Button hover effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  {isSignUp ? (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      Create Account
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Sign In
                    </>
                  )}
                </>
              )}
            </button>

            {/* Toggle Link */}
            <div className="text-center pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200"
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
      </div>
    </div>
  );
};

export default Auth; 