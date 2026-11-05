import React, { useState } from 'react';
import { Appointment, DaySummary, HospitalSettings, ViewRoute } from '../../types/hva';
import {
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  HeartPulse,
  Monitor,
  Plus,
  QrCode,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { adicionarClinico, hoje, removerClinico } from '../../firebase/hvaService';

interface InicioViewProps {
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
  onRouteChange: (route: ViewRoute) => void;
}

export const InicioView: React.FC<InicioViewProps> = ({
  settings,
  daySummary,
  appointments,
  onRouteChange,
}) => {
  const [novoNome, setNovoNome] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const hojeStr = hoje();
  const hojeAppts = appointments.filter((a) => a.data === hojeStr);

  const naFila = hojeAppts.filter(
    (a) => a.status === 'aguardando' || a.status === 'retorno_aguardando'
  ).length;
  const noGuiche = hojeAppts.filter(
    (a) => a.status === 'chamado' || a.status === 'atendimento_recepcao'
  ).length;
  const encaminhados = hojeAppts.filter((a) => a.status === 'encaminhado').length;
  const emConsulta = hojeAppts.filter((a) => a.status === 'em_consulta').length;
  const finalizados = hojeAppts.filter((a) => a.status === 'finalizado').length;
  const totalAgendados = hojeAppts.length;

  const handleAddClinico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    try {
      setAdicionando(true);
      await adicionarClinico(novoNome, settings.clinicos);
      setNovoNome('');
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar veterinário');
    } finally {
      setAdicionando(false);
    }
  };

  const handleRemoverClinico = async (nome: string) => {
    if (confirm(`Remover ${nome} da lista de veterinários ativos?`)) {
      try {
        await removerClinico(nome, settings.clinicos);
      } catch (err: any) {
        alert(err.message || 'Erro ao remover');
      }
    }
  };

  const cards: {
    route: ViewRoute;
    title: string;
    badge: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    accent: string;
  }[] = [
    {
      route: 'recepcao',
      title: 'Recepção',
      badge: 'Agendamentos & QR',
      desc: 'Pré-agendamentos para amanhã, envio de QR Code no WhatsApp, leitura rápida de ficha por foto e emissão de senhas.',
      icon: <Calendar className="w-7 h-7 text-emerald-600" />,
      color: 'hover:border-emerald-500 bg-white',
      accent: 'text-emerald-700',
    },
    {
      route: 'checkin',
      title: 'Totem de Autoatendimento',
      badge: 'Kiosk / Tablet',
      desc: 'Leitura instantânea de QR Code via câmera frontal, entrada sem agendamento no balcão, botão de emergência e agendamento de retorno.',
      icon: <UserCheck className="w-7 h-7 text-teal-600" />,
      color: 'hover:border-teal-500 bg-white',
      accent: 'text-teal-700',
    },
    {
      route: 'guiche1',
      title: 'Guichês 1 a 4',
      badge: `${naFila} na fila`,
      desc: 'Chamada de senhas integrada com o painel de TV, atendimento de balcão, encaminhamento para os veterinários e agendamento de retornos.',
      icon: <CheckCircle className="w-7 h-7 text-sky-600" />,
      color: 'hover:border-sky-500 bg-white',
      accent: 'text-sky-700',
    },
    {
      route: 'painel',
      title: 'Painel TV (Sala de Espera)',
      badge: 'Áudio & Voz',
      desc: 'Tela cheia para monitor da recepção com sinal sonoro hospitalar, síntese de voz em português e histórico das últimas chamadas.',
      icon: <Monitor className="w-7 h-7 text-indigo-600" />,
      color: 'hover:border-indigo-500 bg-white',
      accent: 'text-indigo-700',
    },
    {
      route: 'clinico',
      title: 'Consultório Veterinário',
      badge: `${encaminhados + emConsulta} pacientes`,
      desc: 'Painel do médico com alerta visual/sonoro de paciente liberado pela recepção, chamada para sala, finalização e indicação de retorno.',
      icon: <Stethoscope className="w-7 h-7 text-purple-600" />,
      color: 'hover:border-purple-500 bg-white',
      accent: 'text-purple-700',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-emerald-500/30 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Sistema Hospitalar em Tempo Real
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {settings.nomeHospital}
          </h1>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base max-w-xl">
            Gestão completa de fluxo da recepção ao consultório, com senhas, totens, chamadas sonoras
            e sincronização instantânea via Firebase Firestore.
          </p>
        </div>

        {/* Quick Date Banner */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[160px]">
          <div className="text-xs uppercase tracking-wider text-emerald-200 font-bold">Hoje</div>
          <div className="text-2xl font-black mt-1">
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </div>
          <div className="text-xs text-emerald-100 mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
          </div>
        </div>
      </div>

      {/* Real-Time Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agendados</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{totalAgendados}</div>
          <div className="text-[11px] text-slate-400 mt-1">no sistema hoje</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Na Espera</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">{naFila}</div>
          <div className="text-[11px] text-amber-700 mt-1">aguardando guichê</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-200 bg-sky-50/30 shadow-xs">
          <div className="text-xs font-bold text-sky-700 uppercase tracking-wider">No Guichê</div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 mt-1">{noGuiche}</div>
          <div className="text-[11px] text-sky-700 mt-1">sendo atendidos</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/30 shadow-xs">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Liberados</div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">{encaminhados}</div>
          <div className="text-[11px] text-purple-700 mt-1">p/ consultório</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Em Consulta</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{emConsulta}</div>
          <div className="text-[11px] text-emerald-700 mt-1">com veterinário</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finalizados</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-1">{finalizados}</div>
          <div className="text-[11px] text-slate-400 mt-1">atendidos hoje</div>
        </div>
      </div>

      {/* Navigation Hub Cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>Estações de Trabalho & Módulos</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((c) => (
            <div
              key={c.route}
              onClick={() => onRouteChange(c.route)}
              className={`rounded-2xl border-2 border-slate-200 p-6 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-lg hover:-translate-y-0.5 group ${c.color}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl group-hover:scale-105 transition-transform">
                  {c.icon}
                </div>
                <span className="text-xs font-extrabold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                  {c.badge}
                </span>
              </div>
              <h3 className={`text-xl font-black text-slate-900 group-hover:${c.accent}`}>
                {c.title}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{c.desc}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-emerald-700">
                <span>Abrir tela</span>
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Roster Management */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              Corpo Clínico Ativo
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Veterinários disponíveis para seleção na recepção e no encaminhamento de guichê.
            </p>
          </div>

          <form onSubmit={handleAddClinico} className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: Dr. Roberto / Dra. Ana"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-emerald-600 bg-slate-50"
            />
            <button
              type="submit"
              disabled={adicionando || !novoNome.trim()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2.5 mt-4">
          {settings.clinicos.map((clinico) => (
            <div
              key={clinico}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-sm font-semibold"
            >
              <span>{clinico}</span>
              <button
                type="button"
                onClick={() => handleRemoverClinico(clinico)}
                title="Remover veterinário"
                className="text-emerald-600 hover:text-red-600 p-0.5 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Explanation Banner */}
      <div className="bg-slate-100 rounded-3xl p-6 text-slate-700 text-xs sm:text-sm space-y-3">
        <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <span>📋 Como funciona o fluxo do paciente no HVA</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-black text-emerald-700 text-sm block mb-1">1. Recepção</span>
            Cadastra a consulta para o dia seguinte ou hoje, gera o QR Code e envia pelo WhatsApp do tutor com 1 clique.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-black text-emerald-700 text-sm block mb-1">2. Totem (Entrada)</span>
            O tutor aponta o celular para a câmera frontal do Totem. Uma senha é emitida na hora com posição na fila.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-black text-emerald-700 text-sm block mb-1">3. Guichê & Painel TV</span>
            O atendente chama a senha, o Painel TV avisa por voz e sineta, confere a ficha física e libera para o médico.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-black text-emerald-700 text-sm block mb-1">4. Consultório & Retorno</span>
            O veterinário vê o paciente liberado, chama para a sala e ao finalizar já agenda ou orienta o retorno.
          </div>
        </div>
      </div>
    </div>
  );
};
