'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Mail, Lock, User, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { signup } from './actions';

export default function SignupPage() {
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMsg('');
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const result = await signup(formData);
            if (result?.error) {
                setErrorMsg(result.error);
            }
        });
    };

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

                <Card className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-100 mb-2">Create an account</h1>
                        <p className="text-slate-400">Join Cosmoffice today</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    name="full_name"
                                    className="w-full pl-10 pr-4 py-3 bg-dark-surface border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                        </div>

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
                                    minLength={6}
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
                            {isPending ? 'Signing up...' : 'Sign Up'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-400">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
                        </p>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
