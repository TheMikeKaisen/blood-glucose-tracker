import React, { useState } from 'react';
import { Droplet, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ApiError } from '../services/api';

export const AuthPage: React.FC = () => {
  const { login, register, loginAsDemo, error: authError, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const displayError = clientError || authError;

  const handleTabChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setClientError(null);
    clearError();
  };

  const handleDemoFill = async () => {
    setClientError(null);
    clearError();
    setEmail('demo@sweety.dev');
    setPassword('Demo1234!');
    setDemoLoading(true);
    try {
      await loginAsDemo();
    } catch {
      // Handled in context
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    clearError();

    // Client validation
    if (mode === 'register' && name.trim().length < 2) {
      setClientError('Name must be at least 2 characters.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setClientError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setClientError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setClientError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Brand Hero */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-900/10">
            <Droplet className="w-8 h-8 fill-white/20 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sweety
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Clinical Blood Glucose Tracker for Diabetes Management
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90">
          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`min-h-[40px] text-xs font-bold rounded-lg transition-transform active:scale-95 ${
                mode === 'login'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`min-h-[40px] text-xs font-bold rounded-lg transition-transform active:scale-95 ${
                mode === 'register'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Quick Demo Fill Button */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleDemoFill}
              disabled={demoLoading || loading}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Use Demo Account (Priya Sharma · 30 Days Data)</span>
            </button>
          </div>

          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-[11px] text-slate-400 uppercase font-medium">
              or enter credentials
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {displayError && (
            <div
              role="alert"
              className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Full Name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. patient@example.com"
              required
            />

            <Input
              label="Password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              hint={mode === 'register' ? 'Minimum 8 characters' : undefined}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full text-base font-bold shadow-md shadow-teal-900/10 min-h-[48px]"
              >
                {mode === 'login' ? 'Sign In to Tracker' : 'Create Free Account'}
              </Button>
            </div>
          </form>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 text-center text-[11px] text-slate-400 space-y-1">
          <p>Protected by Argon2id cryptographic hashing &amp; Double-Submit CSRF</p>
          <p>HttpOnly session cookies · 100% IDOR isolated</p>
        </div>
      </div>
    </div>
  );
};
