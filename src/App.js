import React, { useState, useEffect } from 'react';
import InboxManager from './components/InboxManager';
import CRMManager from './components/CRMManager';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import { getCurrentUser, onAuthStateChange, supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');
  const [brandId, setBrandId] = useState(null);
  
  // Check if we're in demo mode based on URL path
  const isDemoMode = window.location.pathname === '/demo';

  // Fetch brandId after login
  useEffect(() => {
    const fetchBrandId = async () => {
      if (!user) return setBrandId(null);
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();
      setBrandId(profile?.brand_id || null);
    };
    fetchBrandId();
  }, [user]);

  // Check for existing session and verification status on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await getCurrentUser();
        if (user) {
          if (!user.email_confirmed_at) {
            setNeedsVerification(true);
            setPendingUser(user);
            setUser(null);
          } else {
            setUser(user);
            setNeedsVerification(false);
            setPendingUser(null);
          }
        } else {
          setUser(null);
          setNeedsVerification(false);
          setPendingUser(null);
        }
      } catch (error) {
        setUser(null);
        setNeedsVerification(false);
        setPendingUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          setNeedsVerification(true);
          setPendingUser(session.user);
          setUser(null);
        } else {
          setUser(session.user);
          setNeedsVerification(false);
          setPendingUser(null);
        }
      } else {
        setUser(null);
        setNeedsVerification(false);
        setPendingUser(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Poll for verification if needed
  useEffect(() => {
    let interval;
    if (needsVerification && pendingUser) {
      interval = setInterval(async () => {
        const { data: refreshedUser } = await supabase.auth.getUser();
        if (refreshedUser?.user?.email_confirmed_at) {
          setUser(refreshedUser.user);
          setNeedsVerification(false);
          setPendingUser(null);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [needsVerification, pendingUser]);

  const handleAuthSuccess = (user) => {
    if (!user.email_confirmed_at) {
      setNeedsVerification(true);
      setPendingUser(user);
      setUser(null);
    } else {
      setUser(user);
      setNeedsVerification(false);
      setPendingUser(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNeedsVerification(false);
    setPendingUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (needsVerification && pendingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8">
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
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-gray-50 dark:bg-gray-900">
        {isDemoMode ? (
          // Demo mode - show InboxManager with sample data, no auth required
          <InboxManager 
            user={{ email: "demo@emaillink.com", id: "demo-user" }} 
            onSignOut={() => window.location.href = '/'}
            demoMode={true}
          />
        ) : user ? (
          // Normal mode - authenticated user
          <InboxManager user={user} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setBrandId(null); }} />
        ) : (
          // Login screen
          <Auth onAuthSuccess={setUser} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
