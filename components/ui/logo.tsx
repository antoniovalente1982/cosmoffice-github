'use client';

import { cn } from '../../lib/utils/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  animated?: boolean;
  showText?: boolean;
  textClassName?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'glow' | 'spinning';
}

const sizes = {
  sm: { container: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-lg' },
  md: { container: 'w-10 h-10', icon: 'w-6 h-6', text: 'text-xl' },
  lg: { container: 'w-14 h-14', icon: 'w-8 h-8', text: 'text-2xl' },
  xl: { container: 'w-20 h-20', icon: 'w-12 h-12', text: 'text-3xl' },
  hero: { container: 'w-32 h-32', icon: 'w-20 h-20', text: 'text-5xl' },
};

/* ─── SVG Logo Icon — pure static, no filters ─── */
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="logoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="logoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      {/* Orbit */}
      <circle cx="50" cy="50" r="45" stroke="url(#logoGrad1)" strokeWidth="2" strokeDasharray="8 4" fill="none" opacity="0.6" />
      {/* Planet */}
      <circle cx="50" cy="50" r="32" fill="url(#logoGrad1)" opacity="0.15" />
      {/* Building */}
      <path
        d="M35 65 L35 40 L42 35 L42 65 M45 65 L45 30 L55 30 L55 65 M58 65 L58 38 L65 42 L65 65"
        stroke="url(#logoGrad2)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Windows */}
      <rect x="47" y="38" width="6" height="6" rx="1" fill="#22D3EE" opacity="0.8" />
      <rect x="47" y="48" width="6" height="6" rx="1" fill="#22D3EE" opacity="0.8" />
      <rect x="38" y="45" width="4" height="4" rx="1" fill="#A78BFA" opacity="0.8" />
      <rect x="60" y="48" width="4" height="4" rx="1" fill="#EC4899" opacity="0.8" />
      {/* Satellite */}
      <circle cx="85" cy="35" r="4" fill="url(#logoGrad1)" />
    </svg>
  );
}

/* ─── Glow Logo — CSS-only glow pulse, no framer-motion ─── */
function GlowLogo({ className, size }: { className?: string; size: string }) {
  return (
    <div className={cn("relative", className)}>
      <div
        className="logo-glow-pulse absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(6, 182, 212, 0.4), rgba(236, 72, 153, 0.4))',
        }}
      />
      <div className={cn("relative bg-slate-950 rounded-2xl", size)}>
        <LogoIcon className="w-full h-full" />
      </div>

      <style jsx>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.06); }
        }
        .logo-glow-pulse {
          animation: glowPulse 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-glow-pulse { animation: none; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export function Logo({
  size = 'md',
  animated = false,
  showText = true,
  textClassName,
  className,
  variant = 'default',
}: LogoProps) {
  const sizeClasses = sizes[size];

  const renderLogo = () => {
    switch (variant) {
      case 'minimal':
        return <LogoIcon className={cn("text-violet-500", sizeClasses.icon)} />;
      case 'glow':
        return <GlowLogo className={sizeClasses.container} size={sizeClasses.container} />;
      case 'spinning':
        return (
          <div className={cn("logo-spin relative", sizeClasses.container)}>
            <LogoIcon className="w-full h-full" />
            <style jsx>{`
              @keyframes logoSpin { to { transform: rotateY(360deg); } }
              .logo-spin { animation: logoSpin 8s linear infinite; }
              @media (prefers-reduced-motion: reduce) { .logo-spin { animation: none; } }
            `}</style>
          </div>
        );
      default:
        return <LogoIcon className={cn("w-full h-full", sizeClasses.icon)} />;
    }
  };

  if (!showText) {
    return (
      <div className={cn("flex items-center justify-center", sizeClasses.container, className)}>
        {renderLogo()}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex-shrink-0", sizeClasses.container)}>
        {variant === 'glow' ? (
          <GlowLogo className="w-full h-full" size={sizeClasses.container} />
        ) : variant === 'spinning' ? (
          <div className="logo-spin relative w-full h-full">
            <LogoIcon className="w-full h-full" />
          </div>
        ) : (
          <div className={cn(
            "w-full h-full rounded-2xl flex items-center justify-center",
            variant === 'default' && "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20",
            variant === 'minimal' && "bg-transparent"
          )}>
            <LogoIcon className="w-full h-full" />
          </div>
        )}
      </div>

      {showText && (
        <span className={cn(
          "font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent",
          sizeClasses.text,
          textClassName
        )}>
          Cosmoffice
        </span>
      )}
    </div>
  );
}

/* ─── Favicon ─── */
export function LogoFavicon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#0F172A" />
      <circle cx="50" cy="50" r="35" fill="url(#favGrad)" opacity="0.2" />
      <path
        d="M35 65 L35 40 L42 35 L42 65 M45 65 L45 30 L55 30 L55 65 M58 65 L58 38 L65 42 L65 65"
        stroke="url(#favGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <rect x="47" y="38" width="6" height="6" rx="1" fill="#22D3EE" />
      <rect x="47" y="48" width="6" height="6" rx="1" fill="#22D3EE" />
      <defs>
        <linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Spinner Logo ─── */
export function LogoSpinner({ size = 40 }: { size?: number }) {
  return (
    <div className="logo-spinner-wrap relative" style={{ width: size, height: size }}>
      <div className="logo-spinner-ring absolute inset-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50" cy="50" r="45"
            stroke="url(#spinGrad)" strokeWidth="4" strokeDasharray="60 40" fill="none"
          />
          <defs>
            <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1/2 h-1/2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg" />
      </div>
      <style jsx>{`
        @keyframes spinnerRotate { to { transform: rotate(360deg); } }
        .logo-spinner-ring {
          animation: spinnerRotate 2s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default Logo;
