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
      {/* ─── CSS-only animated background ─── */}
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
            <Logo size="md" animated={false} showText={false} variant="glow" />
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
                <Logo size="md" showText={false} variant="glow" />
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

      {/* ─── Critical CSS (embedded to avoid FOUC) ─── */}
      <style jsx global>{`
        /* ─── Animations ─── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(20px, -15px) scale(1.05); }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .fade-up {
          opacity: 0;
          animation: fadeUp 0.6s ease-out forwards;
        }

        /* ─── Page ─── */
        .landing-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          background: #020617;
          color: #e2e8f0;
          font-family: inherit;
        }

        /* ─── Background ─── */
        .landing-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .landing-orb {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
        }
        .landing-orb--purple {
          width: 45vw; height: 45vw;
          top: -15%; right: -10%;
          background: radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%);
          animation: orbDrift 25s ease-in-out infinite;
        }
        .landing-orb--cyan {
          width: 50vw; height: 50vw;
          top: 30%; left: -15%;
          background: radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%);
          animation: orbDrift 30s ease-in-out infinite reverse;
        }
        .landing-orb--pink {
          width: 35vw; height: 35vw;
          bottom: -10%; right: 20%;
          background: radial-gradient(circle, rgba(236,72,153,0.12), transparent 70%);
          animation: orbDrift 20s ease-in-out infinite 5s;
        }
        .landing-grid {
          position: absolute;
          inset: 0;
          opacity: 0.06;
          background-image:
            linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        /* ─── Nav ─── */
        .landing-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          background: rgba(2,6,23,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .landing-nav__inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
        }
        .landing-nav__logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .landing-nav__logo span {
          font-size: 1.2rem;
          font-weight: 700;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-nav__links {
          display: none;
          gap: 32px;
        }
        @media (min-width: 768px) {
          .landing-nav__links { display: flex; }
        }
        .landing-nav__link {
          font-size: 0.875rem;
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s;
          position: relative;
        }
        .landing-nav__link:hover { color: #fff; }
        .landing-nav__link::after {
          content: '';
          position: absolute;
          bottom: -4px; left: 0;
          width: 0; height: 2px;
          background: linear-gradient(90deg, #8b5cf6, #06b6d4);
          transition: width 0.3s;
        }
        .landing-nav__link:hover::after { width: 100%; }
        .landing-nav__actions { display: flex; gap: 8px; }

        /* ─── Buttons ─── */
        .landing-btn-primary {
          background: linear-gradient(135deg, #8b5cf6, #a855f7, #ec4899) !important;
          color: #fff !important;
          border: none !important;
          box-shadow: 0 4px 20px rgba(139,92,246,0.3);
          transition: box-shadow 0.3s, transform 0.2s !important;
        }
        .landing-btn-primary:hover {
          box-shadow: 0 6px 30px rgba(139,92,246,0.5) !important;
          transform: translateY(-1px);
        }
        .landing-btn-ghost {
          color: #94a3b8 !important;
          background: transparent !important;
        }
        .landing-btn-ghost:hover { color: #fff !important; background: rgba(255,255,255,0.05) !important; }
        .landing-btn-outline {
          border: 1px solid #334155 !important;
          color: #cbd5e1 !important;
          background: transparent !important;
        }
        .landing-btn-outline:hover {
          border-color: #475569 !important;
          color: #fff !important;
          background: rgba(255,255,255,0.05) !important;
        }
        .landing-btn-secondary {
          background: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border: none !important;
        }
        .landing-btn-secondary:hover { background: rgba(255,255,255,0.1) !important; }
        .landing-btn-lg {
          font-size: 1.05rem !important;
          padding: 0 32px !important;
          height: 52px !important;
          gap: 8px;
        }

        /* ─── Hero ─── */
        .landing-hero {
          position: relative;
          z-index: 1;
          padding: 140px 24px 80px;
          text-align: center;
        }
        .landing-hero__content {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .landing-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.2);
          color: #c4b5fd;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .landing-badge__dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #34d399;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .landing-hero__title {
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin-top: 8px;
        }
        .landing-text-white {
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-text-gradient {
          background: linear-gradient(135deg, #a78bfa, #22d3ee, #f472b6);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 4s ease-in-out infinite;
        }
        .landing-hero__subtitle {
          font-size: clamp(1.05rem, 2vw, 1.35rem);
          color: #94a3b8;
          max-width: 680px;
          line-height: 1.7;
        }
        .landing-hero__subtitle strong { color: #cbd5e1; font-weight: 500; }
        .landing-hero__cta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
          margin-top: 8px;
        }

        /* ─── Preview ─── */
        .landing-hero__preview {
          position: relative;
          max-width: 900px;
          margin: 48px auto 0;
          z-index: 1;
        }
        .landing-preview {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(15,23,42,0.8);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .landing-preview__bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }
        .landing-preview__dot {
          width: 10px; height: 10px;
          border-radius: 50%;
        }
        .landing-preview__url {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #64748b;
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(255,255,255,0.05);
        }
        .landing-preview__content {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
        }
        .landing-preview__grid-bg {
          position: absolute;
          inset: 0;
          opacity: 0.12;
          background-image:
            linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px);
          background-size: 36px 36px;
        }
        .landing-preview__room {
          position: absolute;
          padding: 16px 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .landing-preview__room--violet {
          border: 1.5px solid rgba(139,92,246,0.3);
          background: rgba(139,92,246,0.06);
          color: #c4b5fd;
        }
        .landing-preview__room--cyan {
          border: 1.5px solid rgba(6,182,212,0.3);
          background: rgba(6,182,212,0.06);
          color: #67e8f9;
        }
        .landing-preview__room--pink {
          border: 1.5px solid rgba(236,72,153,0.3);
          background: rgba(236,72,153,0.06);
          color: #f9a8d4;
          padding: 16px 48px;
        }
        .landing-preview__avatar {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .landing-preview__avatar-circle {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .landing-preview__avatar-name {
          font-size: 0.65rem;
          color: #94a3b8;
          background: rgba(15,23,42,0.8);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .landing-preview__glow {
          position: absolute;
          inset: -16px;
          z-index: -1;
          background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.1), rgba(236,72,153,0.1));
          border-radius: 28px;
          filter: blur(40px);
        }

        /* ─── Sections ─── */
        .landing-section {
          position: relative;
          z-index: 1;
          padding: 100px 24px;
        }
        .landing-section--accent {
          background: linear-gradient(180deg, transparent, rgba(139,92,246,0.03), transparent);
        }
        .landing-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .landing-section-header {
          text-align: center;
          margin-bottom: 64px;
        }
        .landing-section-header h2 {
          font-size: clamp(2rem, 4.5vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin: 16px 0;
        }
        .landing-section-header p {
          font-size: 1.15rem;
          color: #94a3b8;
          max-width: 600px;
          margin: 0 auto;
        }
        .landing-section-tag {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          border: 1px solid;
        }

        /* ─── Stats ─── */
        .landing-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
        }
        @media (min-width: 768px) { .landing-stats { grid-template-columns: repeat(4, 1fr); } }
        .landing-stat { text-align: center; }
        .landing-stat__icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          margin-bottom: 12px;
        }
        .landing-stat__value {
          font-size: 2.2rem;
          font-weight: 800;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-stat__label { font-size: 0.9rem; color: #64748b; }

        /* ─── Features Grid ─── */
        .landing-features-grid {
          display: grid;
          gap: 20px;
        }
        @media (min-width: 640px) { .landing-features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .landing-features-grid { grid-template-columns: repeat(3, 1fr); } }
        .landing-feature {
          padding: 32px;
          border-radius: 20px;
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(255,255,255,0.06);
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
        }
        .landing-feature:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        }
        .landing-feature__icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .landing-feature h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }
        .landing-feature p {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
        }

        /* ─── Steps ─── */
        .landing-steps {
          display: grid;
          gap: 32px;
        }
        @media (min-width: 768px) { .landing-steps { grid-template-columns: repeat(3, 1fr); } }
        .landing-step {
          text-align: center;
        }
        .landing-step__icon {
          width: 64px; height: 64px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .landing-step__number {
          font-size: 3rem;
          font-weight: 800;
          color: rgba(255,255,255,0.06);
          line-height: 1;
          margin-bottom: 8px;
        }
        .landing-step h3 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }
        .landing-step p {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
        }

        /* ─── Pricing ─── */
        .landing-pricing {
          display: grid;
          gap: 24px;
          max-width: 1000px;
          margin: 0 auto;
        }
        @media (min-width: 768px) { .landing-pricing { grid-template-columns: repeat(3, 1fr); } }
        .landing-plan {
          padding: 32px;
          border-radius: 20px;
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .landing-plan:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        }
        .landing-plan--pro {
          border-color: rgba(139,92,246,0.4);
          background: linear-gradient(180deg, rgba(139,92,246,0.1), rgba(88,28,135,0.05));
          box-shadow: 0 0 40px rgba(139,92,246,0.15);
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 768px) { .landing-plan--pro { transform: scale(1.04); } }
        .landing-plan__ribbon {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #8b5cf6, #06b6d4, #ec4899);
        }
        .landing-plan__header { margin-bottom: 24px; }
        .landing-plan__icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 12px;
        }
        .landing-plan__icon--pro {
          background: linear-gradient(135deg, #8b5cf6, #a855f7);
          color: #fff;
        }
        .landing-plan__header h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }
        .landing-plan__price span {
          font-size: 2.8rem;
          font-weight: 800;
          color: #fff;
        }
        .landing-plan__price small {
          font-size: 0.9rem;
          color: #64748b;
          margin-left: 4px;
        }
        .landing-plan ul {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .landing-plan li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #cbd5e1;
        }
        .landing-plan li svg { color: #64748b; flex-shrink: 0; }
        .landing-plan--pro li svg { color: #a78bfa; }

        /* ─── CTA ─── */
        .landing-cta {
          background: linear-gradient(135deg, rgba(139,92,246,0.06), rgba(168,85,247,0.04), rgba(236,72,153,0.04));
        }
        .landing-cta__title {
          font-size: clamp(2rem, 4.5vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin-bottom: 16px;
        }
        .landing-cta__sub {
          font-size: 1.15rem;
          color: #94a3b8;
          max-width: 600px;
          margin: 0 auto 32px;
        }

        /* ─── Footer ─── */
        .landing-footer {
          position: relative;
          z-index: 1;
          padding: 64px 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(2,6,23,0.95);
        }
        .landing-footer__grid {
          display: grid;
          gap: 40px;
          margin-bottom: 40px;
        }
        @media (min-width: 768px) {
          .landing-footer__grid { grid-template-columns: 2fr 1fr 1fr; }
        }
        .landing-footer__brand p {
          font-size: 0.9rem;
          color: #64748b;
          max-width: 300px;
          line-height: 1.6;
        }
        .landing-footer h4 {
          font-size: 0.9rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 16px;
        }
        .landing-footer ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .landing-footer a {
          font-size: 0.85rem;
          color: #64748b;
          text-decoration: none;
          transition: color 0.2s;
        }
        .landing-footer a:hover { color: #fff; }
        .landing-footer__bottom {
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .landing-footer__bottom { flex-direction: row; justify-content: space-between; }
        }
        .landing-footer__bottom p { font-size: 0.8rem; color: #475569; }
        .landing-footer__bottom div { display: flex; gap: 24px; }
      `}</style>
    </div>
  );
}
