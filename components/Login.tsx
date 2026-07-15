
import React, { useState, useEffect, useRef } from 'react';
import { Lock, ChevronRight, AlertCircle } from 'lucide-react';
import { verifyAccessCode } from '../services/dbService';
import { Employee } from '../types';

interface LoginProps {
  onLogin: (user: Employee) => void;
  appVersion: string;
  appStatusColor: string;
  isOnline: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const Login: React.FC<LoginProps> = ({ onLogin, appVersion, appStatusColor, isOnline }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Mouse coordinates for interactive gradient tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y });
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Canvas Particle Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    const particleCount = 65;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2 + 1,
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      // Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off borders
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Interaction with mouse (gentle push)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          p.x -= (dx / dist) * force * 1.5;
          p.y -= (dy / dist) * force * 1.5;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 95) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            const alpha = (1 - dist / 95) * 0.13;
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Faint dynamic line from mouse to particle
        const p = particles[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          const alpha = (1 - dist / 150) * 0.22;
          ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) return;

    setLoading(true);
    setError('');

    try {
      const user = await verifyAccessCode(code);
      if (user) {
        onLogin(user);
      } else {
        setError('Código incorrecto. Intente nuevamente.');
        setCode('');
      }
    } catch (err) {
      setError('Error al conectar. Verifique su red.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(val);
    if (error) setError('');
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
    >
      {/* Interactive Radial Gradient Tracker in background */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-70"
        style={{
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(147, 197, 253, 0.22), transparent 80%)`
        }}
      />

      {/* Interactive Network Canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full z-0"
      />
      
      {/* Version Status Badge - Top Right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gray-200 text-xs font-medium text-gray-600 shadow-sm z-10">
         <span 
           className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors ${!isOnline && 'animate-pulse'}`} 
           style={{ backgroundColor: isOnline ? appStatusColor : '#9ca3af' }}
         ></span>
         <span className="hidden sm:inline-block">v{appVersion}</span>
         {!isOnline && <span className="text-gray-400 text-[10px] ml-1 uppercase">(Offline)</span>}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100">
        {/* Card Header Section */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-8 text-center relative overflow-hidden">
          {/* Subtle light bubble elements */}
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
          
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner relative z-10">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight relative z-10">Mi Oficina</h1>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                Ingrese su Código de Acceso
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={handleInputChange}
                  className="w-full text-center text-4xl tracking-[1em] font-bold text-gray-800 border-b-2 border-gray-200 focus:border-blue-600 outline-none py-4 bg-transparent placeholder-gray-200 transition-all"
                  placeholder="••••"
                  maxLength={4}
                />
              </div>
              {error && (
                <div className="flex items-center justify-center text-red-500 text-sm mt-4 animate-pulse font-medium">
                  <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={code.length !== 4 || loading}
              className={`w-full py-4 rounded-xl flex items-center justify-center font-bold text-white transition-all ${
                code.length === 4 
                  ? 'bg-blue-700 hover:bg-blue-800 shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 relative z-10 font-medium">
        © {new Date().getFullYear()} Mi Oficina
      </p>
    </div>
  );
};
