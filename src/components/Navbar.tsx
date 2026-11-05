import React, { useState } from 'react';
import { ViewRoute } from '../types/hva';
import {
  Calendar,
  CheckCircle,
  Clock,
  Database,
  Maximize2,
  Menu,
  Minimize2,
  Monitor,
  PlusCircle,
  RotateCcw,
  Stethoscope,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { semearDadosTeste, zerarDadosTeste } from '../firebase/hvaService';

interface NavbarProps {
  currentRoute: ViewRoute;
  onRouteChange: (route: ViewRoute) => void;
  online: boolean;
  hospitalName?: string;
  filaCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onRouteChange,
  online,
  hospitalName = 'HVA – Hospital Veterinário Araújo',
  filaCount = 0,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleSemear = async () => {
    try {
      setLoadingAction('semeando');
      await semearDadosTeste();
    } catch (err) {
      console.error(err);
      alert('Erro ao semear dados');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleZerar = async () => {
    if (confirm('Deseja realmente limpar todos os atendimentos e senhas de teste de hoje?')) {
      try {
        setLoadingAction('zerando');
        await zerarDadosTeste();
      } catch (err) {
        console.error(err);
        alert('Erro ao limpar dados');
      } finally {
        setLoadingAction(null);
      }
    }
  };

  const navLinks: { route: ViewRoute; label: string; icon: React.ReactNode; badge?: number }[] = [
    { route: 'inicio', label: 'Início', icon: <Clock className="w-4 h-4" /> },
    { route: 'recepcao', label: 'Recepção', icon: <Calendar className="w-4 h-4" /> },
    { route: 'checkin', label: 'Totem Check-in', icon: <UserCheck className="w-4 h-4" /> },
    { route: 'guiche1', label: 'Guichê 1', icon: <CheckCircle className="w-4 h-4" />, badge: filaCount },
    { route: 'guiche2', label: 'Guichê 2', icon: <CheckCircle className="w-4 h-4" /> },
    { route: 'guiche3', label: 'Guichê 3', icon: <CheckCircle className="w-4 h-4" /> },
    { route: 'guiche4', label: 'Guichê 4', icon: <CheckCircle className="w-4 h-4" /> },
    { route: 'painel', label: 'Painel TV', icon: <Monitor className="w-4 h-4" /> },
    { route: 'clinico', label: 'Clínico', icon: <Stethoscope className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-[#0d7a65] text-white shadow-md sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <div
          onClick={() => onRouteChange('inicio')}
          className="flex items-center gap-2 cursor-pointer font-extrabold tracking-tight hover:opacity-90"
        >
          <span className="text-xl">🐾</span>
          <div className="flex flex-col">
            <span className="text-base font-black leading-tight tracking-wider">HVA</span>
            <span className="text-[10px] text-emerald-200 font-medium hidden sm:inline">
              Hospital Veterinário Araújo
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => onRouteChange(item.route)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white/25 text-white shadow-xs'
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-1.5 py-0.2 rounded-full ml-0.5">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Tools & Status */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Cloud Firestore Live Indicator */}
          <div
            title={online ? 'Sincronizado com Firestore em tempo real' : 'Sem conexão'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              online ? 'bg-emerald-800 text-emerald-200' : 'bg-red-900/70 text-red-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
            />
            <span className="hidden md:inline">{online ? 'Firebase Conectado' : 'Offline'}</span>
          </div>

          {/* Test Utilities */}
          <button
            onClick={handleSemear}
            disabled={loadingAction !== null}
            title="Adicionar 5 agendamentos de teste para hoje"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Teste</span>
          </button>

          <button
            onClick={handleZerar}
            disabled={loadingAction !== null}
            title="Limpar atendimentos e senhas de hoje"
            className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-red-500/80 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#095c4d] border-t border-emerald-700/50 px-4 py-3 space-y-1 animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {navLinks.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  onClick={() => {
                    onRouteChange(item.route);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between ${
                    isActive ? 'bg-white text-emerald-900 shadow-sm' : 'bg-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-emerald-700/40 flex items-center justify-between text-xs">
            <span className="text-emerald-200">Ferramentas de teste:</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleSemear();
                  setMobileMenuOpen(false);
                }}
                className="px-2.5 py-1 bg-white/15 rounded text-white font-medium"
              >
                + 5 Pacientes Teste
              </button>
              <button
                onClick={() => {
                  handleZerar();
                  setMobileMenuOpen(false);
                }}
                className="px-2.5 py-1 bg-red-600/80 rounded text-white font-medium"
              >
                Zerar Hoje
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
