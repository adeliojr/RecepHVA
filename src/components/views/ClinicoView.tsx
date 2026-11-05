import React, { useEffect, useRef, useState } from 'react';
import { Appointment, DaySummary, HospitalSettings, TIPOS } from '../../types/hva';
import {
  brData,
  clinicoChamaPaciente,
  clinicoFinalizaConsulta,
  clinicoIndicaRetorno,
  devolverParaEspera,
  hoje,
} from '../../firebase/hvaService';
import { tocarSineta } from '../../utils/audio';
import { ModalRetorno } from '../ModalRetorno';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  Filter,
  Heart,
  History,
  Maximize2,
  Minimize2,
  RotateCcw,
  Stethoscope,
  Tv,
  User,
  Users,
} from 'lucide-react';

interface ClinicoViewProps {
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
}

export const ClinicoView: React.FC<ClinicoViewProps> = ({
  settings,
  daySummary,
  appointments,
}) => {
  const [selectedClinico, setSelectedClinico] = useState<string>('todos');
  const [modoConsultorio, setModoConsultorio] = useState<boolean>(false);
  const [avisoNovo, setAvisoNovo] = useState<string | null>(null);

  // Return modal
  const [selectedApptForReturn, setSelectedApptForReturn] = useState<Appointment | null>(null);
  const [modalRetornoOpen, setModalRetornoOpen] = useState(false);

  // Keep track of previously forwarded patient count to show arrival alerts
  const prevEncaminhadosCount = useRef<number>(0);

  // Filter today's appointments
  const hojeAppts = appointments.filter((a) => a.data === hoje());

  const apptsDoClinico = hojeAppts.filter((a) => {
    if (selectedClinico === 'todos') return true;
    return a.clinico === selectedClinico;
  });

  const aguardandoCorredor = apptsDoClinico.filter((a) => a.status === 'encaminhado');
  const emConsulta = apptsDoClinico.filter((a) => a.status === 'em_consulta');
  const finalizados = apptsDoClinico.filter((a) => a.status === 'finalizado');

  // Check for newly arrived patients
  useEffect(() => {
    const currentCount = aguardandoCorredor.length;
    if (currentCount > prevEncaminhadosCount.current && prevEncaminhadosCount.current !== 0) {
      const recemChegado = aguardandoCorredor[aguardandoCorredor.length - 1];
      if (recemChegado) {
        tocarSineta();
        setAvisoNovo(
          `Novo paciente liberado pela recepção: Senha ${recemChegado.senha || '—'} (Ficha ${recemChegado.ficha})`
        );
        setTimeout(() => setAvisoNovo(null), 5000);
      }
    }
    prevEncaminhadosCount.current = currentCount;
  }, [aguardandoCorredor.length]);

  const handleChamarParaSala = async (id: string) => {
    try {
      tocarSineta();
      await clinicoChamaPaciente(id);
    } catch (err: any) {
      alert(err.message || 'Erro ao chamar paciente');
    }
  };

  const handleDevolver = async (id: string) => {
    if (confirm('Devolver paciente para a fila de espera do corredor?')) {
      try {
        await devolverParaEspera(id);
      } catch (err: any) {
        alert(err.message || 'Erro');
      }
    }
  };

  const handleFinalizarConsulta = (appt: Appointment) => {
    setSelectedApptForReturn(appt);
    setModalRetornoOpen(true);
  };

  const handleConfirmarRetorno = async (res: { data?: string; obs?: string; sem?: boolean }) => {
    if (!selectedApptForReturn) return;
    try {
      await clinicoFinalizaConsulta(selectedApptForReturn.id, res);
      setModalRetornoOpen(false);
      setSelectedApptForReturn(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao finalizar consulta');
    }
  };

  return (
    <div
      className={`min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 select-none transition-colors duration-300 ${
        modoConsultorio ? 'bg-[#0f2420] text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Real-time Arrival Alert Floating Banner */}
      {avisoNovo && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-amber-950 font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 border-2 border-white">
          <Bell className="w-5 h-5 animate-bounce" />
          <span>{avisoNovo}</span>
        </div>
      )}

      {/* Header Bar */}
      <div
        className={`max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${
          modoConsultorio ? 'border-emerald-900/80' : 'border-slate-200'
        } mb-6`}
      >
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-black flex items-center gap-2.5 ${
              modoConsultorio ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            <span>Consultório Clínico Veterinário</span>
          </h1>
          <p
            className={`text-xs mt-0.5 ${
              modoConsultorio ? 'text-emerald-300/80' : 'text-slate-500'
            }`}
          >
            Acompanhe os pacientes liberados pela recepção e registre as orientações de retorno.
          </p>
        </div>

        {/* Controls: Doctor Filter + Display Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Doctor filter */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold ${
                modoConsultorio ? 'text-emerald-300' : 'text-slate-600'
              }`}
            >
              Veterinário:
            </span>
            <select
              value={selectedClinico}
              onChange={(e) => setSelectedClinico(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                modoConsultorio
                  ? 'bg-emerald-950 text-white border-emerald-700'
                  : 'bg-white text-slate-800 border-slate-300'
              }`}
            >
              <option value="todos">Todos os Veterinários ({hojeAppts.length})</option>
              {settings.clinicos.map((c) => (
                <option key={c} value={c}>
                  {c} ({hojeAppts.filter((a) => a.clinico === c).length})
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Big Screen Consultorio Mode */}
          <button
            type="button"
            onClick={() => setModoConsultorio(!modoConsultorio)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
              modoConsultorio
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>{modoConsultorio ? 'Modo Normal' : 'Modo Consultório (Tela Grande)'}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout: Liberados / Em Atendimento / Finalizados */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* COLUMN 1: Aguardando no Corredor */}
        <div
          className={`rounded-3xl p-5 sm:p-6 border ${
            modoConsultorio
              ? 'bg-[#13352e] border-emerald-700/40 text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          } space-y-4`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-current/10">
            <h2 className="font-black text-sm uppercase tracking-wider flex items-center gap-2 text-purple-600">
              <Users className="w-4 h-4" />
              <span>Aguardando no Corredor</span>
            </h2>
            <span className="bg-purple-100 text-purple-900 font-black text-xs px-2.5 py-0.5 rounded-full">
              {aguardandoCorredor.length}
            </span>
          </div>

          {aguardandoCorredor.length === 0 ? (
            <div className="text-center py-12 opacity-50 text-xs">
              Nenhum paciente aguardando no corredor agora.
            </div>
          ) : (
            <div className="space-y-3">
              {aguardandoCorredor.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 border transition-all ${
                    modoConsultorio
                      ? 'bg-emerald-950/80 border-emerald-600/50 hover:border-emerald-400'
                      : 'bg-slate-50 border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 tracking-wider">
                        {a.senha || '—'}
                      </div>
                      <div className="font-extrabold text-sm sm:text-base mt-1">
                        {a.pet ? `Pet: ${a.pet}` : `Ficha ${a.ficha}`}
                      </div>
                      <div className="text-xs opacity-75">
                        {TIPOS[a.tipo].label} • Ficha {a.ficha}
                      </div>
                      {a.tutor && <div className="text-[11px] opacity-60">Tutor: {a.tutor}</div>}
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-800">
                      Liberado
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChamarParaSala(a.id)}
                    className="w-full mt-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-98"
                  >
                    <DoorOpen className="w-4 h-4" />
                    <span>Chamar para a Sala</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMN 2: Em Consulta Agora */}
        <div
          className={`rounded-3xl p-5 sm:p-6 border ${
            modoConsultorio
              ? 'bg-[#13352e] border-emerald-700/40 text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          } space-y-4`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-current/10">
            <h2 className="font-black text-sm uppercase tracking-wider flex items-center gap-2 text-emerald-600">
              <Stethoscope className="w-4 h-4" />
              <span>Em Atendimento na Sala</span>
            </h2>
            <span className="bg-emerald-100 text-emerald-900 font-black text-xs px-2.5 py-0.5 rounded-full">
              {emConsulta.length}
            </span>
          </div>

          {emConsulta.length === 0 ? (
            <div className="text-center py-12 opacity-50 text-xs">
              Nenhum paciente sendo atendido no momento.
            </div>
          ) : (
            <div className="space-y-4">
              {emConsulta.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl p-5 border-2 ${
                    modoConsultorio
                      ? 'bg-emerald-950 border-emerald-400'
                      : 'bg-emerald-50/50 border-emerald-300'
                  } space-y-4 shadow-sm`}
                >
                  <div className="text-center">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                      Na Sala Agora
                    </span>
                    <div
                      className={`font-black font-mono text-emerald-700 tracking-wider my-1 ${
                        modoConsultorio ? 'text-6xl sm:text-7xl' : 'text-5xl'
                      }`}
                    >
                      {a.senha || '—'}
                    </div>
                    <div className="text-lg font-black">{a.pet ? `Pet: ${a.pet}` : `Ficha ${a.ficha}`}</div>
                    <div className="text-xs opacity-75">
                      Ficha {a.ficha} • {TIPOS[a.tipo].label}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleFinalizarConsulta(a)}
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finalizar Consulta & Retorno</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDevolver(a.id)}
                      className="w-full py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Devolver para Espera (Exame/Raio-X)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMN 3: Finalizados Hoje */}
        <div
          className={`rounded-3xl p-5 sm:p-6 border ${
            modoConsultorio
              ? 'bg-[#13352e] border-emerald-700/40 text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          } space-y-4`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-current/10">
            <h2 className="font-black text-sm uppercase tracking-wider flex items-center gap-2 text-slate-500">
              <History className="w-4 h-4" />
              <span>Finalizados Hoje</span>
            </h2>
            <span className="bg-slate-200 text-slate-800 font-black text-xs px-2.5 py-0.5 rounded-full">
              {finalizados.length}
            </span>
          </div>

          {finalizados.length === 0 ? (
            <div className="text-center py-12 opacity-50 text-xs">
              Nenhuma consulta finalizada ainda hoje.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {finalizados.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    modoConsultorio
                      ? 'bg-emerald-950/40 border-emerald-800/60'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-black font-mono text-slate-700 text-sm">
                      {a.senha || '—'} • {a.pet || `Ficha ${a.ficha}`}
                    </div>
                    <div className="text-[11px] opacity-70">
                      {a.retornoSem ? (
                        <span className="text-slate-400">Sem retorno</span>
                      ) : a.retornoPara ? (
                        <span className="text-amber-600 font-bold">
                          Retorno: {brData(a.retornoPara)}
                        </span>
                      ) : (
                        <span>Alta</span>
                      )}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Retorno */}
      {selectedApptForReturn && (
        <ModalRetorno
          isOpen={modalRetornoOpen}
          onClose={() => {
            setModalRetornoOpen(false);
            setSelectedApptForReturn(null);
          }}
          onConfirm={handleConfirmarRetorno}
          pacienteNome={selectedApptForReturn.pet}
          ficha={selectedApptForReturn.ficha}
          initialObs={selectedApptForReturn.retornoObs}
        />
      )}
    </div>
  );
};
