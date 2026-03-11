'use client';

import Link from 'next/link';
import { Button } from '../components/ui/button';
import {
  Users, Video, MessageSquare, Map, Zap, Shield, Globe,
  ArrowRight, CheckCircle2, Rocket, Star, Wifi, Radio,
  Crown, ArrowUpRight
} from 'lucide-react';
import { Logo } from '../components/ui/logo';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useT } from '../lib/i18n';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import './landing.css';

export default function LandingPage() {
  const { t } = useT();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const features = useMemo(() => [
    { icon: Map, title: t('landing.features.presence.title'), description: t('landing.features.presence.desc'), accent: '#8b5cf6' },
    { icon: Video, title: t('landing.features.audio.title'), description: t('landing.features.audio.desc'), accent: '#06b6d4' },
    { icon: MessageSquare, title: t('landing.features.rooms.title'), description: t('landing.features.rooms.desc'), accent: '#ec4899' },
    { icon: Users, title: t('landing.features.screen.title'), description: t('landing.features.screen.desc'), accent: '#f59e0b' },
    { icon: Zap, title: t('landing.features.security.title'), description: t('landing.features.security.desc'), accent: '#10b981' },
    { icon: Shield, title: t('landing.features.analytics.title'), description: t('landing.features.analytics.desc'), accent: '#6366f1' },
  ], [t]);

  const stats = useMemo(() => [
    { value: '10K+', label: t('landing.stat.teams'), Icon: Users },
    { value: '50+', label: t('landing.stat.latency'), Icon: Globe },
    { value: '99.9%', label: 'Uptime', Icon: Wifi },
    { value: '24/7', label: 'Support', Icon: Radio },
  ], [t]);

  const pricingPlans = useMemo(() => [
    { name: t('landing.pricing.free.name'), price: t('landing.pricing.free.price'), features: [t('landing.pricing.free.feature1'), t('landing.pricing.free.feature2'), t('landing.pricing.free.feature3'), t('landing.pricing.free.feature4')], highlighted: false, Icon: Star, cta: t('landing.pricing.free.cta') },
    { name: t('landing.pricing.pro.name'), price: t('landing.pricing.pro.price'), period: t('landing.pricing.pro.period'), features: [t('landing.pricing.pro.feature1'), t('landing.pricing.pro.feature2'), t('landing.pricing.pro.feature3'), t('landing.pricing.pro.feature4'), t('landing.pricing.pro.feature5'), t('landing.pricing.pro.feature6')], highlighted: true, Icon: Rocket, cta: t('landing.pricing.pro.cta') },
    { name: t('landing.pricing.enterprise.name'), price: t('landing.pricing.enterprise.price'), features: [t('landing.pricing.enterprise.feature1'), t('landing.pricing.enterprise.feature2'), t('landing.pricing.enterprise.feature3'), t('landing.pricing.enterprise.feature4'), t('landing.pricing.enterprise.feature5')], highlighted: false, Icon: Crown, cta: t('landing.pricing.enterprise.cta') },
  ], [t]);

  const steps = useMemo(() => [
    { step: '01', title: t('landing.howItWorks.step1.title'), description: t('landing.howItWorks.step1.desc'), Icon: Rocket, accent: '#8b5cf6' },
    { step: '02', title: t('landing.howItWorks.step2.title'), description: t('landing.howItWorks.step2.desc'), Icon: Users, accent: '#06b6d4' },
    { step: '03', title: t('landing.howItWorks.step3.title'), description: t('landing.howItWorks.step3.desc'), Icon: Zap, accent: '#ec4899' },
  ], [t]);

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
            {[{label: t('landing.navFeatures'), href: '#features'}, {label: t('landing.navHowItWorks'), href: '#how-it-works'}, {label: t('landing.navPricing'), href: '#pricing'}].map(item => (
              <a key={item.href} href={item.href} className="landing-nav__link">{item.label}</a>
            ))}
          </div>

          <div className="landing-nav__actions">
            <LanguageSelector compact />
            {user ? (
              <Link href="/office">
                <Button size="sm" className="landing-btn-primary">{t('dashboard.enter')}</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="landing-btn-ghost">{t('auth.login')}</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="landing-btn-primary">{t('landing.ctaStart')}</Button>
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
              {t('landing.badge')}
            </div>

            <h1 className="landing-hero__title fade-up" style={{ animationDelay: '0.15s' }}>
              <span className="landing-text-white">{t('landing.heroTitle1')}</span>
              <br />
              <span className="landing-text-gradient">{t('landing.heroTitle2')}</span>
            </h1>

            <p className="landing-hero__subtitle fade-up" style={{ animationDelay: '0.2s' }}>
              {t('landing.heroSubtitle')}
            </p>

            <div className="landing-hero__cta fade-up" style={{ animationDelay: '0.3s' }}>
              {user ? (
                <Link href="/office">
                  <Button size="lg" className="landing-btn-primary landing-btn-lg">
                    {t('dashboard.enter')} <Rocket className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup">
                    <Button size="lg" className="landing-btn-primary landing-btn-lg">
                      {t('landing.ctaStart')} <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg" className="landing-btn-outline landing-btn-lg">
                      {t('landing.ctaDemo')}
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
              <span className="landing-section-tag" style={{ borderColor: 'rgba(139,92,246,.3)', color: '#a78bfa', background: 'rgba(139,92,246,.08)' }}>{t('landing.features.tag')}</span>
              <h2>
                <span className="landing-text-white">{t('landing.features.title1')}</span><br />
                <span className="landing-text-gradient">{t('landing.features.title2')}</span>
              </h2>
              <p>{t('landing.features.subtitle')}</p>
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
              <span className="landing-section-tag" style={{ borderColor: 'rgba(6,182,212,.3)', color: '#67e8f9', background: 'rgba(6,182,212,.08)' }}>{t('landing.howItWorks.tag')}</span>
              <h2>
                <span className="landing-text-white">{t('landing.howItWorks.title1')}</span><br />
                <span className="landing-text-gradient">{t('landing.howItWorks.title2')}</span>
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
              <span className="landing-section-tag" style={{ borderColor: 'rgba(236,72,153,.3)', color: '#f472b6', background: 'rgba(236,72,153,.08)' }}>{t('landing.pricing.tag')}</span>
              <h2>
                <span className="landing-text-white">{t('landing.pricing.title1')}</span><br />
                <span className="landing-text-gradient">{t('landing.pricing.title2')}</span>
              </h2>
              <p>{t('landing.pricing.subtitle')}</p>
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
                    {plan.cta}
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
              <span className="landing-text-white">{t('landing.cta.title1')}</span><br />
              <span className="landing-text-gradient">{t('landing.cta.title2')}</span>
            </h2>
            <p className="landing-cta__sub">{t('landing.cta.subtitle')}</p>
            <div className="landing-hero__cta">
              <Link href="/signup">
                <Button size="lg" className="landing-btn-primary landing-btn-lg">
                  {t('landing.cta.button')} <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="landing-btn-outline landing-btn-lg">{t('auth.login')}</Button>
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
              <p>{t('landing.heroSubtitle')}</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>{[t('landing.navFeatures'), t('landing.navPricing'), t('landing.features.security.title')].map(i => <li key={i}><a href="#">{i}</a></li>)}</ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>{['About', 'Blog', t('landing.footer.contact')].map(i => <li key={i}><a href="#">{i}</a></li>)}</ul>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <p>{t('landing.footer.rights', { year: String(new Date().getFullYear()) })}</p>
            <div>
              <a href="#">{t('landing.footer.privacy')}</a>
              <a href="#">{t('landing.footer.terms')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
