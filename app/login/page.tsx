'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { login } from './actions';

function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const isInvite = redirectTo.startsWith('/invite/');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo size="lg" showText={false} variant="glow" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">
          {isInvite ? 'Accedi per entrare' : 'Welcome back'}
        </h1>
        <p className="text-slate-400">
          {isInvite
            ? 'Accedi al tuo account per accettare l\'invito'
            : 'Sign in to your Cosmoffice account'}
        </p>
      </div>

      {isInvite && (
        <div className="mb-6 p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl text-center">
          <p className="text-xs text-primary-300">🔗 Hai un invito! Accedi per entrare nel workspace.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="email"
              name="email"
              className="w-full pl-10 pr-4 py-3 bg-dark-surface border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="password"
              name="password"
              className="w-full pl-10 pr-4 py-3 bg-dark-surface border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-400/10 p-3 rounded-md border border-red-400/20">
            <AlertCircle className="w-4 h-4" />
            <p>{errorMsg}</p>
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? 'Signing in...' : isInvite ? 'Accedi e entra' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}
            className="text-primary-400 hover:text-primary-300 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-100 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to home
        </Link>

        <Suspense fallback={<Card className="p-8 text-center text-slate-400">Caricamento...</Card>}>
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
