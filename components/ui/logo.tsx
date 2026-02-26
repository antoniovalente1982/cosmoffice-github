'use client';

import { motion } from 'framer-motion';
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

// SVG Logo Icon - Cosmic Office Building
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="logoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer Ring - Orbit */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="url(#logoGradient)"
        strokeWidth="2"
        strokeDasharray="8 4"
        fill="none"
        opacity="0.6"
      />
      
      {/* Planet/Office Base */}
      <circle
        cx="50"
        cy="50"
        r="32"
        fill="url(#logoGradient)"
        opacity="0.15"
      />
      
      {/* Office Building Shape */}
      <path
        d="M35 65 L35 40 L42 35 L42 65 M45 65 L45 30 L55 30 L55 65 M58 65 L58 38 L65 42 L65 65"
        stroke="url(#logoGradient2)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#glow)"
      />
      
      {/* Windows */}
      <rect x="47" y="38" width="6" height="6" rx="1" fill="#22D3EE" opacity="0.8" />
      <rect x="47" y="48" width="6" height="6" rx="1" fill="#22D3EE" opacity="0.8" />
      <rect x="38" y="45" width="4" height="4" rx="1" fill="#A78BFA" opacity="0.8" />
      <rect x="60" y="48" width="4" height="4" rx="1" fill="#EC4899" opacity="0.8" />
      
      {/* Satellite/Dot orbiting */}
      <circle cx="85" cy="35" r="4" fill="url(#logoGradient)" />
    </svg>
  );
}

// Animated Logo Icon
function AnimatedLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="animGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6">
            <animate attributeName="stop-color" values="#8B5CF6;#06B6D4;#EC4899;#8B5CF6" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor="#06B6D4">
            <animate attributeName="stop-color" values="#06B6D4;#EC4899;#8B5CF6;#06B6D4" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#EC4899">
            <animate attributeName="stop-color" values="#EC4899;#8B5CF6;#06B6D4;#EC4899" dur="4s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <linearGradient id="animGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <filter id="animGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Animated Orbit Ring */}
      <motion.circle
        cx="50"
        cy="50"
        r="45"
        stroke="url(#animGradient)"
        strokeWidth="2"
        strokeDasharray="8 4"
        fill="none"
        opacity="0.8"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: '50px 50px' }}
      />
      
      {/* Planet Base with pulse */}
      <motion.circle
        cx="50"
        cy="50"
        r="32"
        fill="url(#animGradient)"
        opacity="0.2"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: '50px 50px' }}
      />
      
      {/* Office Building */}
      <motion.path
        d="M35 65 L35 40 L42 35 L42 65 M45 65 L45 30 L55 30 L55 65 M58 65 L58 38 L65 42 L65 65"
        stroke="url(#animGradient2)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#animGlow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      
      {/* Animated Windows */}
      <motion.rect 
        x="47" y="38" width="6" height="6" rx="1" fill="#22D3EE"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0 }}
      />
      <motion.rect 
        x="47" y="48" width="6" height="6" rx="1" fill="#22D3EE"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
      />
      <motion.rect 
        x="38" y="45" width="4" height="4" rx="1" fill="#A78BFA"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
      />
      <motion.rect 
        x="60" y="48" width="4" height="4" rx="1" fill="#EC4899"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
      />
      
      {/* Orbiting Satellite */}
      <motion.circle 
        cx="50" 
        cy="5" 
        r="4" 
        fill="url(#animGradient)"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: '50px 50px' }}
      />
    </svg>
  );
}

// 3D Spinning Logo
function SpinningLogo({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("relative", className)}
      animate={{ rotateY: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
    >
      <LogoIcon className="w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/20 to-cyan-500/20 rounded-full blur-xl" />
    </motion.div>
  );
}

// Glow Logo
function GlowLogo({ className, size }: { className?: string; size: string }) {
  return (
    <div className={cn("relative", className)}>
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(6, 182, 212, 0.5), rgba(236, 72, 153, 0.5))',
          filter: 'blur(15px)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className={cn("relative bg-slate-950 rounded-2xl", size)}>
        <AnimatedLogoIcon className="w-full h-full" />
      </div>
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
        return <SpinningLogo className={cn(sizeClasses.container, "w-full h-full")} />;
      default:
        return animated ? (
          <AnimatedLogoIcon className={cn("w-full h-full", sizeClasses.icon)} />
        ) : (
          <LogoIcon className={cn("w-full h-full", sizeClasses.icon)} />
        );
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
          <SpinningLogo className="w-full h-full" />
        ) : (
          <div className={cn(
            "w-full h-full rounded-2xl flex items-center justify-center",
            variant === 'default' && "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20",
            variant === 'minimal' && "bg-transparent"
          )}>
            {animated ? (
              <AnimatedLogoIcon className="w-full h-full" />
            ) : (
              <LogoIcon className="w-full h-full" />
            )}
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

// Favicon generator component
export function LogoFavicon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="20" fill="#0F172A" />
      <circle cx="50" cy="50" r="35" fill="url(#favGradient)" opacity="0.2" />
      <path
        d="M35 65 L35 40 L42 35 L42 65 M45 65 L45 30 L55 30 L55 65 M58 65 L58 38 L65 42 L65 65"
        stroke="url(#favGradient)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="47" y="38" width="6" height="6" rx="1" fill="#22D3EE" />
      <rect x="47" y="48" width="6" height="6" rx="1" fill="#22D3EE" />
      <defs>
        <linearGradient id="favGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Loading/Spinner Logo
export function LogoSpinner({ size = 40 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="url(#spinnerGradient)"
            strokeWidth="4"
            strokeDasharray="60 40"
            fill="none"
          />
          <defs>
            <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1/2 h-1/2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg" />
      </div>
    </div>
  );
}

export default Logo;
