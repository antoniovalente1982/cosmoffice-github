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
    <div className="relative group">
      {/* Outer Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-[24px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

      {/* Card Content */}
      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-[24px] shadow-2xl">
        <div className="text-center mb-10">
          <motion.div
            className="flex justify-center mb-6"
            whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Logo size="lg" showText={false} variant="glow" />
          </motion.div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent mb-3 tracking-tight">
            {isInvite ? 'Accept Invitation' : 'Welcome Back'}
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {isInvite
              ? 'Sign in to accept your invitation to the workspace'
              : 'Enter your credentials to access your office'}
          </p>
        </div>

        {isInvite && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-cyan-500/20 rounded-2xl text-center shadow-[0_0_15px_rgba(34,211,238,0.1)]"
          >
            <p className="text-xs font-semibold text-cyan-300 uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Invitation Pending
            </p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
            <div className="relative group/input">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within/input:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
                <div className="pl-4 pr-3 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" />
                </div>
                <input
                  type="email"
                  name="email"
                  className="w-full py-3.5 pr-4 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none text-sm"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <Link href="#" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Forgot?</Link>
            </div>
            <div className="relative group/input">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within/input:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
                <div className="pl-4 pr-3 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" />
                </div>
                <input
                  type="password"
                  name="password"
                  className="w-full py-3.5 pr-4 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 text-red-400 text-sm mt-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="font-medium">{errorMsg}</p>
            </motion.div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="relative w-full group/btn overflow-hidden rounded-xl font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-cyan-600 to-violet-600 bg-[length:200%_auto] group-hover/btn:bg-[position:100%_0] transition-all duration-500" />
              <div className="relative px-6 py-4 flex items-center justify-center gap-2">
                {isPending ? 'Authenticating...' : isInvite ? 'Sign In to Join' : 'Sign In'}
                {!isPending && <ArrowLeft className="w-4 h-4 rotate-180 group-hover/btn:translate-x-1 transition-transform" />}
              </div>
            </button>
          </div>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-sm text-slate-400 font-medium">
            Don't have an account?{' '}
            <Link
              href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}
              className="text-cyan-400 hover:text-cyan-300 font-bold tracking-wide transition-colors"
            >
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[#020617]">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] bg-cyan-600/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] bg-purple-600/10 rounded-full blur-[100px]"
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <Link
          href="/"
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 mb-10 transition-all backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          Back to Cosmos
        </Link>

        <Suspense fallback={
          <div className="h-[400px] flex items-center justify-center">
            <div className="w-10 h-10 border-[3px] border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
