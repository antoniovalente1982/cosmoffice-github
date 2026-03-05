'use client';

import Link from 'next/link';
import { Button } from '../components/ui/button';
import {
  Users, Video, MessageSquare, Map, Zap, Shield, Globe,
  ArrowRight, CheckCircle2, Rocket, Star, Wifi, Radio,
  Crown, ArrowUpRight
} from 'lucide-react';
import { Logo } from '../components/ui/logo';
import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import './landing.css';

/* ─── Static data ──────────────────────────── */

const features = [
  { icon: Map, title: 'Virtual Office Space', description: 'Navigate a 2D office map just like a real workspace. Move around freely and interact with your team.', accent: '#8b5cf6' },
  { icon: Video, title: 'Seamless Video Calls', description: 'High-quality video and audio with screen sharing. Proximity-based conversations that feel natural.', accent: '#06b6d4' },
  { icon: MessageSquare, title: 'Team Chat', description: 'Real-time messaging with channels and direct messages. Never miss important conversations.', accent: '#ec4899' },
  { icon: Users, title: 'Team Presence', description: 'See who is online, away, or busy. Know exactly when your teammates are available.', accent: '#f59e0b' },
  { icon: Zap, title: 'Lightning Fast', description: 'Built with modern web technologies for instant load times and smooth interactions.', accent: '#10b981' },
  { icon: Shield, title: 'Enterprise Security', description: 'End-to-end encryption and SSO support. Your data is always protected.', accent: '#6366f1' },
];

const stats = [
  { value: '10K+', label: 'Active Teams', Icon: Users },
  { value: '50+', label: 'Countries', Icon: Globe },
  { value: '99.9%', label: 'Uptime', Icon: Wifi },
  { value: '24/7', label: 'Support', Icon: Radio },
];

const pricingPlans = [
  { name: 'Starter', price: 'Free', features: ['Up to 10 members', '1 office', 'Basic video', 'Team chat', 'Community support'], highlighted: false, Icon: Star },
  { name: 'Pro', price: '$12', period: '/user/month', features: ['Unlimited members', 'Unlimited offices', 'HD video', 'Screen sharing', 'Priority support', 'Analytics dashboard'], highlighted: true, Icon: Rocket },
  { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO & SAML', 'Advanced analytics', 'Custom integrations', 'SLA guarantee', 'Dedicated manager'], highlighted: false, Icon: Crown },
];

const steps = [
  { step: '01', title: 'Create Your Space', description: 'Set up your virtual office in minutes. Customize the layout, add rooms, and make it yours.', Icon: Rocket, accent: '#8b5cf6' },
  { step: '02', title: 'Invite Your Team', description: 'Send invites to your team members. They can join instantly from anywhere in the world.', Icon: Users, accent: '#06b6d4' },
  { step: '03', title: 'Start Collaborating', description: 'Move around, start conversations, and work together just like in a physical office.', Icon: Zap, accent: '#ec4899' },
];

/* ─── Component ────────────────────────────── */

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  return (
    <div className="landing-page">
      {/* ─── Lightweight background ─── */}
      <div className="landing-bg" aria-hidden>
        <div className="landing-orb landing-orb--purple" />
        <div className="landing-orb landing-orb--cyan" />
        <div className="landing-orb landing-orb--pink" />
        <div className="landing-grid" />
      </div>

      {/* ─── Navigation ─── */}
      <nav className="landing-nav">
        <div className="landing-nav__inner">
          <Link href="/" className="landing-nav__logo">
            <Logo size="md" animated={false} showText={false} variant="default" />
            <span>Cosmoffice</span>
          </Link>

          <div className="landing-nav__links">
            {['Features', 'How it Works', 'Pricing'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="landing-nav__link">{item}</a>
            ))}
          </div>

          <div className="landing-nav__actions">
            {user ? (
              <Link href="/office">
                <Button size="sm" className="landing-btn-primary">Go to Office</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="landing-btn-ghost">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="landing-btn-primary">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        {/* ─── Hero ─── */}
        <section className="landing-hero">
          <div className="landing-hero__content fade-up">
            <Logo size="xl" animated={false} showText={false} variant="default" />

            <div className="landing-badge fade-up" style={{ animationDelay: '0.1s' }}>
              <span className="landing-badge__dot" />
              Now in Public Beta
            </div>

            <h1 className="landing-hero__title fade-up" style={{ animationDelay: '0.15s' }}>
              <span className="landing-text-white">Your Office in the</span>
              <br />
              <span className="landing-text-gradient">Cosmos</span>
            </h1>

            <p className="landing-hero__subtitle fade-up" style={{ animationDelay: '0.2s' }}>
              Bring your remote team together in a virtual workspace that feels like a real office.{' '}
              <strong>Move, meet, and collaborate</strong> like never before.
            </p>

            <div className="landing-hero__cta fade-up" style={{ animationDelay: '0.3s' }}>
              {user ? (
                <Link href="/office">
                  <Button size="lg" className="landing-btn-primary landing-btn-lg">
                    Enter Your Office <Rocket className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup">
                    <Button size="lg" className="landing-btn-primary landing-btn-lg">
                      Start Free Trial <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg" className="landing-btn-outline landing-btn-lg">
                      Watch Demo
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mock Office Preview */}
          <div className="landing-hero__preview fade-up" style={{ animationDelay: '0.45s' }}>
            <div className="landing-preview">
              <div className="landing-preview__bar">
                <div className="landing-preview__dot" style={{ background: '#ef4444' }} />
                <div className="landing-preview__dot" style={{ background: '#f59e0b' }} />
                <div className="landing-preview__dot" style={{ background: '#22c55e' }} />
                <div className="landing-preview__url">
                  <Globe className="w-3 h-3" />
                  cosmoffice.app/office/team
                </div>
              </div>
              <div className="landing-preview__content">
                <div className="landing-preview__grid-bg" />
                {/* Office rooms */}
                <div className="landing-preview__room landing-preview__room--violet" style={{ top: '20%', left: '15%' }}>
                  <Video className="w-4 h-4" /> Meeting Room A
                </div>
                <div className="landing-preview__room landing-preview__room--cyan" style={{ top: '20%', right: '15%' }}>
                  <MessageSquare className="w-4 h-4" /> Lounge
                </div>
                <div className="landing-preview__room landing-preview__room--pink" style={{ bottom: '20%', left: '50%', transform: 'translateX(-50%)' }}>
                  <Users className="w-4 h-4" /> Open Workspace
                </div>
                {/* Avatars */}
                {[
                  { x: '25%', y: '35%', color: '#8b5cf6', name: 'You' },
                  { x: '30%', y: '42%', color: '#06b6d4', name: 'Alex' },
                  { x: '70%', y: '30%', color: '#ec4899', name: 'Sam' },
                  { x: '52%', y: '60%', color: '#f59e0b', name: 'Jordan' },
                ].map(u => (
                  <div key={u.name} className="landing-preview__avatar" style={{ left: u.x, top: u.y }}>
                    <div className="landing-preview__avatar-circle" style={{ background: u.color }}>{u.name[0]}</div>
                    <span className="landing-preview__avatar-name">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="landing-preview__glow" />
          </div>
        </section>

        {/* ─── Stats ─── */}
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-stats">
              {stats.map((s, i) => (
                <div key={s.label} className="landing-stat fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="landing-stat__icon"><s.Icon className="w-6 h-6" /></div>
                  <div className="landing-stat__value">{s.value}</div>
                  <div className="landing-stat__label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header fade-up">
              <span className="landing-section-tag" style={{ borderColor: 'rgba(139,92,246,.3)', color: '#a78bfa', background: 'rgba(139,92,246,.08)' }}>Features</span>
              <h2>
                <span className="landing-text-white">Everything you need for</span><br />
                <span className="landing-text-gradient">cosmic collaboration</span>
              </h2>
              <p>Powerful features designed to make remote work feel natural and engaging.</p>
            </div>
            <div className="landing-features-grid">
              {features.map((f, i) => (
                <div key={f.title} className="landing-feature fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="landing-feature__icon" style={{ background: `linear-gradient(135deg, ${f.accent}, ${f.accent}88)` }}>
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How it Works ─── */}
        <section id="how-it-works" className="landing-section landing-section--accent">
          <div className="landing-container">
            <div className="landing-section-header fade-up">
              <span className="landing-section-tag" style={{ borderColor: 'rgba(6,182,212,.3)', color: '#67e8f9', background: 'rgba(6,182,212,.08)' }}>How it Works</span>
              <h2>
                <span className="landing-text-white">Three steps to</span><br />
                <span className="landing-text-gradient">launch your office</span>
              </h2>
            </div>
            <div className="landing-steps">
              {steps.map((s, i) => (
                <div key={s.step} className="landing-step fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                  <div className="landing-step__icon" style={{ background: `linear-gradient(135deg, ${s.accent}, ${s.accent}88)` }}>
                    <s.Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="landing-step__number">{s.step}</div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header fade-up">
              <span className="landing-section-tag" style={{ borderColor: 'rgba(236,72,153,.3)', color: '#f472b6', background: 'rgba(236,72,153,.08)' }}>Pricing</span>
              <h2>
                <span className="landing-text-white">Simple, transparent</span><br />
                <span className="landing-text-gradient">pricing</span>
              </h2>
              <p>Start free and scale as your team grows. No hidden fees.</p>
            </div>
            <div className="landing-pricing">
              {pricingPlans.map((plan, i) => (
                <div key={plan.name} className={`landing-plan fade-up ${plan.highlighted ? 'landing-plan--pro' : ''}`} style={{ animationDelay: `${i * 0.1}s` }}>
                  {plan.highlighted && <div className="landing-plan__ribbon" />}
                  <div className="landing-plan__header">
                    <div className={`landing-plan__icon ${plan.highlighted ? 'landing-plan__icon--pro' : ''}`}>
                      <plan.Icon className="w-5 h-5" />
                    </div>
                    <h3>{plan.name}</h3>
                    <div className="landing-plan__price">
                      <span>{plan.price}</span>
                      {plan.period && <small>{plan.period}</small>}
                    </div>
                  </div>
                  <ul>
                    {plan.features.map(f => (
                      <li key={f}><CheckCircle2 className="w-4 h-4" />{f}</li>
                    ))}
                  </ul>
                  <Button className={`w-full h-12 ${plan.highlighted ? 'landing-btn-primary' : 'landing-btn-secondary'}`}>
                    {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="landing-section landing-cta fade-up">
          <div className="landing-container" style={{ textAlign: 'center' }}>
            <h2 className="landing-cta__title">
              <span className="landing-text-white">Ready to launch your</span><br />
              <span className="landing-text-gradient">virtual office?</span>
            </h2>
            <p className="landing-cta__sub">Join thousands of teams already working in the cosmos. Start your free trial today.</p>
            <div className="landing-hero__cta">
              <Link href="/signup">
                <Button size="lg" className="landing-btn-primary landing-btn-lg">
                  Get Started Free <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="landing-btn-outline landing-btn-lg">Sign In</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer__grid">
            <div className="landing-footer__brand">
              <Link href="/" className="landing-nav__logo" style={{ marginBottom: 16 }}>
                <Logo size="md" showText={false} variant="default" />
                <span>Cosmoffice</span>
              </Link>
              <p>The next generation virtual office platform for remote teams. Work together, anywhere in the cosmos.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>{['Features', 'Pricing', 'Security', 'Integrations'].map(i => <li key={i}><a href="#">{i}</a></li>)}</ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>{['About', 'Blog', 'Careers', 'Contact'].map(i => <li key={i}><a href="#">{i}</a></li>)}</ul>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <p>© 2024 Cosmoffice. All rights reserved.</p>
            <div>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
