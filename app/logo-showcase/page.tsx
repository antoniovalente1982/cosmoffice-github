'use client';

import { motion } from 'framer-motion';
import { Logo, LogoFavicon, LogoSpinner } from '../../components/ui/logo';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function LogoShowcase() {
  return (
    <div className="min-h-screen bg-dark-bg text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-12 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            Cosmoffice Logo System
          </h1>
          <p className="text-slate-400 text-xl">A cosmic brand identity for the future of work</p>
        </motion.div>

        {/* Hero Logo */}
        <motion.section
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center py-20 mb-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-cyan-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
          <Logo size="hero" animated={true} variant="glow" />
          <p className="mt-8 text-slate-500">Hero Size with Animation & Glow</p>
        </motion.section>

        {/* Size Variants */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Size Variants</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center justify-items-center p-8 bg-slate-900/50 rounded-2xl border border-white/5">
            {(['sm', 'md', 'lg', 'xl', 'hero'] as const).map((size) => (
              <motion.div key={size} variants={item} className="flex flex-col items-center gap-4">
                <Logo size={size} showText={false} />
                <span className="text-sm text-slate-500 capitalize">{size}</span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Style Variants */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Style Variants</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { variant: 'default', label: 'Default', desc: 'Standard gradient background' },
              { variant: 'minimal', label: 'Minimal', desc: 'Clean without background' },
              { variant: 'glow', label: 'Glow', desc: 'With animated glow effect' },
              { variant: 'spinning', label: '3D Spin', desc: 'Rotating 3D effect' },
            ].map((itemData) => (
              <motion.div
                key={itemData.variant}
                variants={item}
                className="flex flex-col items-center gap-4 p-8 bg-slate-900/50 rounded-2xl border border-white/5"
              >
                <Logo size="lg" showText={false} variant={itemData.variant as any} />
                <div className="text-center">
                  <h3 className="font-medium text-white">{itemData.label}</h3>
                  <p className="text-sm text-slate-500">{itemData.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Animated vs Static */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Animated vs Static</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div variants={item} className="flex flex-col items-center gap-4 p-8 bg-slate-900/50 rounded-2xl border border-white/5">
              <Logo size="xl" animated={false} showText={false} />
              <span className="text-slate-500">Static</span>
            </motion.div>
            <motion.div variants={item} className="flex flex-col items-center gap-4 p-8 bg-slate-900/50 rounded-2xl border border-white/5">
              <Logo size="xl" animated={true} showText={false} />
              <span className="text-slate-500">Animated (SVG)</span>
            </motion.div>
          </div>
        </motion.section>

        {/* With Text */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Logo with Text</h2>
          <div className="flex flex-col items-center gap-8 p-8 bg-slate-900/50 rounded-2xl border border-white/5">
            <Logo size="sm" animated={true} />
            <Logo size="md" animated={true} />
            <Logo size="lg" animated={true} />
            <Logo size="xl" animated={true} />
          </div>
        </motion.section>

        {/* Favicon & Spinner */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Utility Components</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div variants={item} className="flex flex-col items-center gap-4 p-8 bg-slate-900/50 rounded-2xl border border-white/5">
              <LogoFavicon size={64} />
              <span className="text-slate-500">Favicon (64px)</span>
              <div className="flex gap-2 mt-4">
                <LogoFavicon size={16} />
                <LogoFavicon size={32} />
                <LogoFavicon size={48} />
                <LogoFavicon size={64} />
              </div>
            </motion.div>
            <motion.div variants={item} className="flex flex-col items-center gap-4 p-8 bg-slate-900/50 rounded-2xl border border-white/5">
              <LogoSpinner size={64} />
              <span className="text-slate-500">Loading Spinner</span>
              <div className="flex gap-4 mt-4 items-center">
                <LogoSpinner size={24} />
                <LogoSpinner size={32} />
                <LogoSpinner size={48} />
                <LogoSpinner size={64} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Color Palette */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
        >
          <h2 className="text-2xl font-semibold mb-8 text-slate-300">Brand Colors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Violet', color: '#8B5CF6', class: 'bg-violet-500' },
              { name: 'Cyan', color: '#06B6D4', class: 'bg-cyan-500' },
              { name: 'Pink', color: '#EC4899', class: 'bg-pink-500' },
              { name: 'Dark', color: '#0F172A', class: 'bg-slate-900' },
            ].map((c) => (
              <motion.div
                key={c.name}
                variants={item}
                className="p-6 rounded-2xl border border-white/5 bg-slate-900/50"
              >
                <div className={`w-full h-24 rounded-xl ${c.class} mb-4 shadow-lg`} />
                <h3 className="font-medium text-white">{c.name}</h3>
                <p className="text-sm text-slate-500 font-mono">{c.color}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Usage */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20 p-8 bg-slate-900/50 rounded-2xl border border-white/5"
        >
          <h2 className="text-2xl font-semibold mb-6 text-slate-300">Usage</h2>
          <pre className="text-sm text-slate-400 overflow-x-auto">
{`import { Logo, LogoFavicon, LogoSpinner } from './components/ui/logo';

// Basic usage
<Logo />

// Size variants: sm | md | lg | xl | hero
<Logo size="lg" />

// Style variants: default | minimal | glow | spinning
<Logo variant="glow" />

// With/without text
<Logo showText={true} />
<Logo showText={false} />

// Animated SVG
<Logo animated={true} />

// Favicon
<LogoFavicon size={32} />

// Loading spinner
<LogoSpinner size={40} />`}
          </pre>
        </motion.section>
      </div>
    </div>
  );
}
