'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Video, MessageSquare, Map, Zap, Shield, Globe, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const features = [
  { icon: <Map className="w-6 h-6" />, title: 'Virtual Office Space', description: 'Navigate a 2D office map just like a real workspace.' },
  { icon: <Video className="w-6 h-6" />, title: 'Seamless Video Calls', description: 'High-quality video and audio with screen sharing.' },
  { icon: <MessageSquare className="w-6 h-6" />, title: 'Team Chat', description: 'Real-time messaging with channels and direct messages.' },
  { icon: <Users className="w-6 h-6" />, title: 'Team Presence', description: 'See who is online, away, or busy.' },
  { icon: <Zap className="w-6 h-6" />, title: 'Lightning Fast', description: 'Built with modern web technologies.' },
  { icon: <Shield className="w-6 h-6" />, title: 'Enterprise Security', description: 'End-to-end encryption and SSO support.' },
];

const pricingPlans = [
  { name: 'Starter', price: 'Free', features: ['Up to 10 members', '1 office', 'Basic video', 'Team chat'], highlighted: false },
  { name: 'Pro', price: '$12', period: '/user/month', features: ['Unlimited members', 'Unlimited offices', 'HD video', 'Screen sharing', 'Priority support'], highlighted: true },
  { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO & SAML', 'Analytics', 'Custom integrations', 'SLA'], highlighted: false },
];

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, [supabase]);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-lg font-semibold text-slate-100">Cosmoffice</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Link href="/office"><Button size="sm">Go to Office</Button></Link>
              ) : (
                <>
                  <Link href="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
                  <Link href="/signup"><Button size="sm">Get Started</Button></Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />Now in Public Beta
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            <span className="text-gradient">Virtual Office</span><br /><span className="text-slate-100">for Remote Teams</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Bring your team together in a virtual workspace that feels like a real office.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link href="/office"><Button size="lg" className="gap-2">Go to your Office<ArrowRight className="w-4 h-4" /></Button></Link>
            ) : (
              <>
                <Link href="/signup"><Button size="lg" className="gap-2">Get Started Free<ArrowRight className="w-4 h-4" /></Button></Link>
                <Link href="/login"><Button variant="secondary" size="lg">Watch Demo</Button></Link>
              </>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }} className="mt-16 relative">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl glass">
              <div className="aspect-[16/9] bg-gradient-to-br from-dark-surface to-dark-elevated flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center border border-primary-500/30">
                    <Globe className="w-16 h-16 text-primary-400" />
                  </div>
                  <p className="text-slate-500">Interactive Demo Coming Soon</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">Everything you need for <span className="text-gradient">remote collaboration</span></h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">Powerful features designed to make remote work feel natural.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                <Card className="h-full p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400 mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">Simple, <span className="text-gradient">transparent pricing</span></h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">Start free and scale as your team grows.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                <Card className={`h-full p-6 ${plan.highlighted ? 'ring-2 ring-primary-500' : ''}`}>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-slate-100">{plan.price}</span>
                      {plan.period && <span className="text-slate-500">{plan.period}</span>}
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />{feature}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.highlighted ? 'default' : 'secondary'} className="w-full">{plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}</Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-semibold text-slate-100">Cosmoffice</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Privacy</a>
            <a href="#" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Terms</a>
          </div>
          <p className="text-sm text-slate-500">© 2024 Cosmoffice. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
