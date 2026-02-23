'use client';

import * as React from 'react';
import { cn } from '../../lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'hover';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-dark-elevated/60 border border-slate-700 rounded-xl',
      glass: 'bg-dark-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl',
      hover: 'bg-dark-elevated/60 border border-slate-700 rounded-xl transition-all duration-300 hover:border-slate-600 hover:shadow-card hover:-translate-y-1'
    };

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

export { Card };
