'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  Users, Video, MessageSquare, Map, Zap, Shield, Globe, Sparkles, 
  ArrowRight, CheckCircle2, Rocket, Orbit, Star, Satellite, 
  CircleDot, Radio, Cpu, Wifi, Crown, ArrowUpRight, Hexagon, 
  Triangle, Circle, Moon
} from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';

// Animated Star Field Component
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    const starCount = 150;
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random()
      });
    }
    
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
        
        const twinkle = Math.sin(Date.now() * 0.003 + star.x) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });
      
      animationId = requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}

// Floating Orbs Component
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Purple Planet */}
      <motion.div
        className="absolute -top-20 -right-20 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(168, 85, 247, 0.4), rgba(88, 28, 135, 0.2))',
          filter: 'blur(60px)',
        }}
        animate={{
          y: [0, 50, 0],
          x: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Cyan Nebula */}
      <motion.div
        className="absolute top-1/3 -left-32 w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{
          y: [0, 80, 0],
          x: [0, 40, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />
      
      {/* Pink Glow */}
      <motion.div
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      
      {/* Orange Accent */}
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251, 146, 60, 0.15), transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{
          y: [0, -40, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3
        }}
      />
    </div>
  );
}

// Floating Icons Animation
function FloatingIcon({ 
  children, 
  delay = 0, 
  x, 
  y,
  duration = 4
}: { 
  children: React.ReactNode; 
  delay?: number; 
  x: string;
  y: string;
  duration?: number;
}) {
  return (
    <motion.div
      className="absolute text-white/20"
      style={{ left: x, top: y }}
      animate={{
        y: [0, -20, 0],
        rotate: [0, 10, -10, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay
      }}
    >
      {children}
    </motion.div>
  );
}

const features = [
  { 
    icon: <Map className="w-7 h-7" />, 
    title: 'Virtual Office Space', 
    description: 'Navigate a 2D office map just like a real workspace. Move around freely and interact with your team.',
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/30'
  },
  { 
    icon: <Video className="w-7 h-7" />, 
    title: 'Seamless Video Calls', 
    description: 'High-quality video and audio with screen sharing. Proximity-based conversations that feel natural.',
    color: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/30'
  },
  { 
    icon: <MessageSquare className="w-7 h-7" />, 
    title: 'Team Chat', 
    description: 'Real-time messaging with channels and direct messages. Never miss important conversations.',
    color: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/30'
  },
  { 
    icon: <Users className="w-7 h-7" />, 
    title: 'Team Presence', 
    description: 'See who is online, away, or busy. Know exactly when your teammates are available.',
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/30'
  },
  { 
    icon: <Zap className="w-7 h-7" />, 
    title: 'Lightning Fast', 
    description: 'Built with modern web technologies for instant load times and smooth interactions.',
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/30'
  },
  { 
    icon: <Shield className="w-7 h-7" />, 
    title: 'Enterprise Security', 
    description: 'End-to-end encryption and SSO support. Your data is always protected.',
    color: 'from-indigo-500 to-violet-600',
    glow: 'shadow-indigo-500/30'
  },
];

const stats = [
  { value: '10K+', label: 'Active Teams', icon: Users },
  { value: '50+', label: 'Countries', icon: Globe },
  { value: '99.9%', label: 'Uptime', icon: Wifi },
  { value: '24/7', label: 'Support', icon: Radio },
];

const pricingPlans = [
  { 
    name: 'Starter', 
    price: 'Free', 
    features: ['Up to 10 members', '1 office', 'Basic video', 'Team chat', 'Community support'],
    highlighted: false,
    icon: Star
  },
  { 
    name: 'Pro', 
    price: '$12', 
    period: '/user/month', 
    features: ['Unlimited members', 'Unlimited offices', 'HD video', 'Screen sharing', 'Priority support', 'Analytics dashboard'],
    highlighted: true,
    icon: Rocket
  },
  { 
    name: 'Enterprise', 
    price: 'Custom', 
    features: ['Everything in Pro', 'SSO & SAML', 'Advanced analytics', 'Custom integrations', 'SLA guarantee', 'Dedicated manager'],
    highlighted: false,
    icon: Crown
  },
];

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const supabase = createClient();
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, [supabase]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-dark-bg">
      <StarField />
      <FloatingOrbs />
      
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-pink-500 z-[100] origin-left"
        style={{ scaleX }}
      />
      
      {/* Cursor Glow Effect */}
      <motion.div
        className="fixed w-96 h-96 rounded-full pointer-events-none z-0 mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/60 backdrop-blur-2xl border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div 
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-shadow"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Hexagon className="w-6 h-6 text-white" />
              </motion.div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Cosmoffice
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              {['Features', 'How it Works', 'Pricing'].map((item, i) => (
                <motion.a 
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} 
                  className="text-sm text-slate-400 hover:text-white transition-colors relative group"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i + 0.3 }}
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 group-hover:w-full transition-all duration-300" />
                </motion.a>
              ))}
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <Link href="/office">
                  <Button size="sm" className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25">
                    Go to Office
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Floating Decorative Icons */}
        <FloatingIcon x="10%" y="20%" delay={0} duration={5}>
          <Star className="w-8 h-8 text-violet-400/30" />
        </FloatingIcon>
        <FloatingIcon x="85%" y="15%" delay={1} duration={6}>
          <Satellite className="w-10 h-10 text-cyan-400/30" />
        </FloatingIcon>
        <FloatingIcon x="75%" y="60%" delay={2} duration={4.5}>
          <Triangle className="w-12 h-12 text-pink-400/30 rotate-45" />
        </FloatingIcon>
        <FloatingIcon x="5%" y="70%" delay={1.5} duration={5.5}>
          <Orbit className="w-10 h-10 text-amber-400/30" />
        </FloatingIcon>
        <FloatingIcon x="90%" y="80%" delay={0.5} duration={4}>
          <Cpu className="w-8 h-8 text-emerald-400/30" />
        </FloatingIcon>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-8 backdrop-blur-sm">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.span>
              Now in Public Beta
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8"
          >
            <span className="block bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Your Office in the
            </span>
            <span className="block mt-2">
              <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                Cosmos
              </span>
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-xl sm:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Bring your remote team together in a virtual workspace that feels like a real office. 
            <span className="text-slate-300"> Move, meet, and collaborate</span> like never before.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {user ? (
              <Link href="/office">
                <Button 
                  size="lg" 
                  className="gap-2 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 text-lg px-8 h-14 group"
                >
                  Enter Your Office
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Rocket className="w-5 h-5" />
                  </motion.span>
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signup">
                  <Button 
                    size="lg" 
                    className="gap-2 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 text-lg px-8 h-14 group"
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-white/5 text-lg px-8 h-14"
                  >
                    Watch Demo
                  </Button>
                </Link>
              </>
            )}
          </motion.div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="mt-20 relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm">
              {/* Window Controls */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <div className="flex-1" />
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 text-xs text-slate-400">
                  <Globe className="w-3 h-3" />
                  cosmoffice.app/office/team
                </div>
              </div>
              
              {/* Mock Content */}
              <div className="aspect-[16/9] relative overflow-hidden">
                {/* Grid Background */}
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />
                
                {/* Office Floor Plan Mock */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full max-w-4xl h-full p-8">
                    {/* Office Rooms */}
                    <motion.div 
                      className="absolute top-1/4 left-1/4 w-48 h-32 rounded-xl border-2 border-violet-500/30 bg-violet-500/5 flex items-center justify-center"
                      animate={{ boxShadow: ['0 0 20px rgba(139, 92, 246, 0.2)', '0 0 40px rgba(139, 92, 246, 0.4)', '0 0 20px rgba(139, 92, 246, 0.2)'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <div className="flex items-center gap-2 text-violet-300">
                        <Video className="w-5 h-5" />
                        <span className="text-sm">Meeting Room A</span>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="absolute top-1/4 right-1/4 w-48 h-32 rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 flex items-center justify-center"
                      animate={{ boxShadow: ['0 0 20px rgba(34, 211, 238, 0.2)', '0 0 40px rgba(34, 211, 238, 0.4)', '0 0 20px rgba(34, 211, 238, 0.2)'] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                    >
                      <div className="flex items-center gap-2 text-cyan-300">
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-sm">Lounge</span>
                      </div>
                    </motion.div>
                    
                    <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-24 rounded-xl border-2 border-pink-500/30 bg-pink-500/5 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-pink-300">
                        <Users className="w-5 h-5" />
                        <span className="text-sm">Open Workspace</span>
                      </div>
                    </div>
                    
                    {/* User Avatars */}
                    {[
                      { x: '30%', y: '35%', color: 'bg-violet-500', name: 'You' },
                      { x: '35%', y: '40%', color: 'bg-cyan-500', name: 'Alex' },
                      { x: '70%', y: '35%', color: 'bg-pink-500', name: 'Sam' },
                      { x: '50%', y: '65%', color: 'bg-amber-500', name: 'Jordan' },
                    ].map((user, i) => (
                      <motion.div
                        key={user.name}
                        className="absolute"
                        style={{ left: user.x, top: user.y }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.2 }}
                      >
                        <motion.div
                          className={`w-10 h-10 rounded-full ${user.color} flex items-center justify-center text-white font-bold text-sm shadow-lg cursor-pointer`}
                          whileHover={{ scale: 1.2 }}
                          animate={{
                            y: [0, -5, 0],
                          }}
                          transition={{
                            y: { duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                          }}
                        >
                          {user.name[0]}
                        </motion.div>
                        <motion.div
                          className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300 whitespace-nowrap"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.2 + i * 0.2 }}
                        >
                          {user.name}
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Glow Effect Behind */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10 rounded-[3rem]" />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon className="w-7 h-7 text-violet-400" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6">
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Everything you need for
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                cosmic collaboration
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to make remote work feel natural and engaging.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div 
                key={feature.title} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full p-8 bg-slate-900/40 backdrop-blur-xl border-white/5 hover:border-white/10 transition-all duration-300 group hover:-translate-y-2 hover:shadow-2xl">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-6 shadow-lg ${feature.glow} group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-violet-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-medium mb-6">
              How it Works
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Three steps to
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                launch your office
              </span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                step: '01', 
                title: 'Create Your Space', 
                description: 'Set up your virtual office in minutes. Customize the layout, add rooms, and make it yours.',
                icon: Rocket,
                color: 'from-violet-500 to-purple-600'
              },
              { 
                step: '02', 
                title: 'Invite Your Team', 
                description: 'Send invites to your team members. They can join instantly from anywhere in the world.',
                icon: Users,
                color: 'from-cyan-500 to-blue-600'
              },
              { 
                step: '03', 
                title: 'Start Collaborating', 
                description: 'Move around, start conversations, and work together just like in a physical office.',
                icon: Zap,
                color: 'from-pink-500 to-rose-600'
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                {/* Connection Line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-white/20 to-transparent" />
                )}
                
                <div className="text-center group">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${item.color} mb-6 shadow-2xl group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-5xl font-bold text-white/10 mb-4">{item.step}</div>
                  <h3 className="text-2xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-slate-400">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-sm font-medium mb-6">
              Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Simple, transparent
              </span>
              <br />
              <span className="bg-gradient-to-r from-pink-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                pricing
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Start free and scale as your team grows. No hidden fees.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div 
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={plan.highlighted ? 'md:-mt-4 md:mb-4' : ''}
              >
                <Card className={`h-full p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-2 ${
                  plan.highlighted 
                    ? 'bg-gradient-to-b from-violet-600/20 to-purple-900/20 border-violet-500/50 shadow-2xl shadow-violet-500/20' 
                    : 'bg-slate-900/40 backdrop-blur-xl border-white/5 hover:border-white/10'
                }`}>
                  {plan.highlighted && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-pink-500" />
                  )}
                  
                  <div className="mb-8">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
                      plan.highlighted 
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600' 
                        : 'bg-white/5'
                    }`}>
                      <plan.icon className={`w-6 h-6 ${plan.highlighted ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-white">{plan.price}</span>
                      {plan.period && <span className="text-slate-400">{plan.period}</span>}
                    </div>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-slate-300">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          plan.highlighted ? 'bg-violet-500/20' : 'bg-white/5'
                        }`}>
                          <CheckCircle2 className={`w-3.5 h-3.5 ${plan.highlighted ? 'text-violet-400' : 'text-slate-400'}`} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    variant={plan.highlighted ? 'default' : 'secondary'}
                    className={`w-full h-12 text-base ${
                      plan.highlighted 
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25' 
                        : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-pink-600/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        
        <motion.div 
          className="max-w-4xl mx-auto text-center relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Ready to launch your
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
              virtual office?
            </span>
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Join thousands of teams already working in the cosmos. Start your free trial today.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl shadow-violet-500/30 text-lg px-10 h-14 group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                variant="outline" 
                size="lg"
                className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-white/5 text-lg px-10 h-14"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
                  <Hexagon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Cosmoffice</span>
              </Link>
              <p className="text-slate-400 max-w-sm mb-6">
                The next generation virtual office platform for remote teams. Work together, anywhere in the cosmos.
              </p>
              <div className="flex items-center gap-4">
                {['Twitter', 'GitHub', 'Discord'].map((social) => (
                  <a 
                    key={social}
                    href="#" 
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'Security', 'Integrations'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3">
                {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © 2024 Cosmoffice. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
