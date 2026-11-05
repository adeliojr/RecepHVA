import React, { useEffect, useState } from 'react';
import {
  Appointment,
  DaySummary,
  GuicheState,
  HospitalSettings,
  STATUS_LABELS,
  TIPOS,
  TipoAtendimento,
} from '../../types/hva';
import {
  agendarRetornoNoGuiche,
  brData,
  chamarProximaSenha,
  checkinManualBalcao,
  dataLonga,
  encaminharAoClinico,
  finalizarGuiche,
  getFilaEspera,
  hoje,
  iniciarAtendimentoGuiche,
  marcarNaoCompareceu,
  pularSenha,
  rechamarSenha,
  togglePausaGuiche,
} from '../../firebase/hvaService';
import { ModalRetorno } from '../ModalRetorno';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Coffee,
  Forward,
  HelpCircle,
  Play,
  PlusCircle,
  RefreshCw,
  SkipForward,
  Stethoscope,
  UserCheck,
  Users,
  Volume2,
  XCircle,
} from 'lucide-react';

interface GuicheViewProps {
  guicheNum: number;
  onSelectGuiche: (n: number) => void;
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
}

export const GuicheView: React.FC<GuicheViewProps> = ({
  guicheNum,
  onSelectGuiche,
  settings,
  daySummary,
  appointments,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Edit fields when in atendimento
  const [selectedClinico, setSelectedClinico] = useState<string>('');
  const [editFicha, setEditFicha] = useState<string>('');
  const [editPet, setEditPet] = useState<string>('');
  const [editTutor, setEditTutor] = useState<string>('');

  // Quick Balcao form
  const [balcaoFicha, setBalcaoFicha] = useState<string>('');
  const [balcaoTipo, setBalcaoTipo] = useState<TipoAtendimento>('consulta');

  // Modal retorno
  const [modalRetornoOpen, setModalRetornoOpen] = useState(false);

  // Current guiche state
  const guicheAtual = daySummary.guiches.find((g) => g.n === guicheNum) || {
    n: guicheNum,
    estado: 'livre',
    id: null,
  };

  const apptAtual = guicheAtual.id
    ? appointments.find((a) => a.id === guicheAtual.id) || null
    : null;

  // Sync edit fields when current appointment loads
  useEffect(() => {
    if (apptAtual) {
      setSelectedClinico(apptAtual.clinico || settings.clinicos[0] || '');
      setEditFicha(apptAtual.ficha || '');
      setEditPet(apptAtual.pet || '');
      setEditTutor(apptAtual.tutor || '');
    } else {
      setSelectedClinico(settings.clinicos[0] || '');
      setEditFicha('');
      setEditPet('');
      setEditTutor('');
    }
  }, [apptAtual?.id]);

  const fila = getFilaEspera(appointments);

  // Actions
  const handleChamarProxima = async () => {
    try {
      setLoading(true);
      setErro(null);
      await chamarProximaSenha(guicheNum, daySummary, appointments);
    } catch (err: any) {
      setErro(err.message || 'Erro ao chamar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleRechamar = async () => {
    try {
      setLoading(true);
      setErro(null);
      await rechamarSenha(guicheNum, daySummary, appointments);
    } catch (err: any) {
      setErro(err.message || 'Erro ao rechamar');
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarAtendimento = async () => {
    try {
      setLoading(true);
      setErro(null);
      await iniciarAtendimentoGuiche(guicheNum, daySummary, appointments);
    } catch (err: any) {
      setErro(err.message || 'Erro ao iniciar atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleEncaminhar = async () => {
    try {
      setLoading(true);
      setErro(null);
      await encaminharAoClinico(
        guicheNum,
        selectedClinico,
        { ficha: editFicha, pet: editPet, tutor: editTutor },
        daySummary,
        appointments
      );
    } catch (err: any) {
      setErro(err.message || 'Erro ao encaminhar');
    } finally {
      setLoading(false);
    }
  };

  const handlePular = async () => {
    try {
      setLoading(true);
      setErro(null);
      await pularSenha(guicheNum, daySummary, appointments);
    } catch (err: any) {
      setErro(err.message || 'Erro ao pular senha');
    } finally {
      setLoading(false);
    }
  };

  const handleNaoCompareceu = async () => {
    if (confirm('Confirmar que o paciente não compareceu após as chamadas?')) {
      try {
        setLoading(true);
        setErro(null);
        await marcarNaoCompareceu(guicheNum, daySummary, appointments);
      } catch (err: any) {
        setErro(err.message || 'Erro ao marcar falta');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFinalizarDireto = async () => {
    try {
      setLoading(true);
      setErro(null);
      await finalizarGuiche(guicheNum, daySummary, appointments);
    } catch (err: any) {
      setErro(err.message || 'Erro ao finalizar atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePausa = async () => {
    try {
      setLoading(true);
      setErro(null);
      const colocarPausa = guicheAtual.estado !== 'pausa';
      await togglePausaGuiche(guicheNum, colocarPausa, daySummary);
    } catch (err: any) {
      setErro(err.message || 'Erro ao alterar pausa');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBalcao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErro(null);
      await checkinManualBalcao(balcaoFicha, balcaoTipo, daySummary, appointments);
      setBalcaoFicha('');
    } catch (err: any) {
      setErro(err.message || 'Erro ao emitir senha');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarRetorno = async (res: { data?: string; obs?: string; sem?: boolean }) => {
    if (!res.data) {
      // Sem retorno
      handleFinalizarDireto();
      setModalRetornoOpen(false);
      return;
    }
    try {
      setLoading(true);
      setErro(null);
      await agendarRetornoNoGuiche(guicheNum, res.data, daySummary, appointments);
      setModalRetornoOpen(false);
    } catch (err: any) {
      setErro(err.message || 'Erro ao agendar retorno');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Guiche Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>Guichê de Atendimento {guicheNum}</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                guicheAtual.estado === 'livre'
                  ? 'bg-emerald-100 text-emerald-800'
                  : guicheAtual.estado === 'chamando'
                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                  : guicheAtual.estado === 'atendendo'
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {guicheAtual.estado}
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Painel da estação de trabalho para chamada e triagem de pacientes.
          </p>
        </div>

        {/* Guiche 1 to 4 Switcher */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 shadow-inner">
          {[1, 2, 3, 4].map((num) => {
            const isSelected = guicheNum === num;
            const gInfo = daySummary.guiches.find((g) => g.n === num);
            const isBusy = gInfo && gInfo.estado !== 'livre' && gInfo.estado !== 'pausa';
            return (
              <button
                key={num}
                type="button"
                onClick={() => onSelectGuiche(num)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span>Guichê {num}</span>
                {isBusy && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-900 border border-red-200 flex items-center gap-3 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Main Grid: Counter Station + Queue & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Patient / Action Controls */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {/* Guiche is LIVRE */}
          {guicheAtual.estado === 'livre' && (
            <div className="text-center py-10 space-y-5">
              <div className="p-4 bg-emerald-50 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-emerald-700">
                <Users className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Guichê {guicheNum} Livre
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Existem <b className="text-emerald-700 font-black">{fila.length}</b> pessoas aguardando
                  na fila de espera hoje.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
                <button
                  type="button"
                  disabled={loading || fila.length === 0}
                  onClick={handleChamarProxima}
                  className="flex-1 py-4 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-black text-base shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <Bell className="w-5 h-5" />
                  <span>Chamar Próxima Senha ({fila.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleTogglePausa}
                  className="py-4 px-4 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5"
                >
                  <Coffee className="w-4 h-4" />
                  Pausar
                </button>
              </div>
            </div>
          )}

          {/* Guiche is PAUSA */}
          {guicheAtual.estado === 'pausa' && (
            <div className="text-center py-10 space-y-4">
              <div className="p-4 bg-amber-50 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-amber-700">
                <Coffee className="w-10 h-10" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Guichê em Pausa</h2>
              <p className="text-xs text-slate-500">
                O guichê está temporariamente indisponível para chamadas.
              </p>
              <button
                type="button"
                onClick={handleTogglePausa}
                className="py-3 px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm shadow-md"
              >
                Retomar Atendimento
              </button>
            </div>
          )}

          {/* Guiche is CHAMANDO or ATENDENDO */}
          {(guicheAtual.estado === 'chamando' || guicheAtual.estado === 'atendendo') && apptAtual && (
            <div className="space-y-6">
              {/* Giant Ticket Banner */}
              <div className="bg-gradient-to-r from-emerald-900 to-teal-800 rounded-3xl p-6 sm:p-8 text-white text-center shadow-lg relative overflow-hidden space-y-3">
                <div className="text-xs uppercase tracking-widest text-emerald-200 font-bold">
                  {guicheAtual.estado === 'chamando' ? 'Chamando no Painel TV' : 'Em Atendimento'}
                </div>
                <div className="text-6xl sm:text-8xl font-black tracking-wider font-mono my-1">
                  {apptAtual.senha || '—'}
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-100">
                  {TIPOS[apptAtual.tipo]?.label || apptAtual.tipo}
                </div>

                {/* USER REQUIREMENT: Ficha, Tutor, Paciente, Veterinário, Horário Agendado */}
                <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 text-left grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-emerald-300 font-semibold block text-[11px] uppercase tracking-wider">Número da Ficha</span>
                    <span className="font-black text-white text-sm tracking-wide">{apptAtual.ficha || 'S/N'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-300 font-semibold block text-[11px] uppercase tracking-wider">Horário Agendado</span>
                    <span className="font-bold text-white text-sm">
                      {apptAtual.horario ? `⏰ ${apptAtual.horario}` : 'Sem horário pré-fixado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300 font-semibold block text-[11px] uppercase tracking-wider">Nome do Paciente (Pet)</span>
                    <span className="font-bold text-white text-sm">{apptAtual.pet || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-300 font-semibold block text-[11px] uppercase tracking-wider">Nome do Tutor</span>
                    <span className="font-bold text-white text-sm">{apptAtual.tutor || 'Não informado'}</span>
                  </div>
                  <div className="sm:col-span-2 pt-1 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-emerald-300 font-semibold text-[11px] uppercase tracking-wider">Veterinário Responsável: </span>
                      <span className="font-black text-emerald-100">{apptAtual.clinico || 'A definir'}</span>
                    </div>
                  </div>
                </div>

                {/* Notice for walk-in appointment without prior registration */}
                {(apptAtual.ficha.includes('cadastro') || !apptAtual.tutor || apptAtual.tutor.includes('cadastro')) && (
                  <div className="bg-amber-400 text-amber-950 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-xs text-center animate-pulse">
                    ⚠️ Consulta sem agendamento: Coletar os dados do tutor e cadastrar a ficha física abaixo.
                  </div>
                )}

                {apptAtual.retornoPara && (
                  <div className="inline-block bg-amber-400 text-amber-950 font-black text-xs px-3.5 py-1 rounded-full shadow-xs">
                    Retorno indicado pelo médico para {brData(apptAtual.retornoPara)}
                  </div>
                )}
              </div>

              {/* Action buttons when CHAMANDO */}
              {guicheAtual.estado === 'chamando' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleIniciarAtendimento}
                      disabled={loading}
                      className="py-4 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Paciente Chegou ao Guichê</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRechamar}
                      disabled={loading}
                      className="py-4 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <Volume2 className="w-5 h-5" />
                      <span>Rechamar no Painel (Voz)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePular}
                      disabled={loading}
                      className="py-2.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span>Pular Senha ({apptAtual.pulos || 0}/3)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNaoCompareceu}
                      disabled={loading}
                      className="py-2.5 px-3 border border-red-300 hover:bg-red-50 text-red-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Não Compareceu</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Form & Routing when ATENDENDO */}
              {guicheAtual.estado === 'atendendo' && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Conferência e Encaminhamento
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Clínico Veterinário Responsável
                      </label>
                      <select
                        value={selectedClinico}
                        onChange={(e) => setSelectedClinico(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white"
                      >
                        {settings.clinicos.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Ficha Física
                      </label>
                      <input
                        type="text"
                        value={editFicha}
                        onChange={(e) => setEditFicha(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nome do Pet
                      </label>
                      <input
                        type="text"
                        value={editPet}
                        onChange={(e) => setEditPet(e.target.value)}
                        placeholder="Ex: Bob"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nome do Tutor
                      </label>
                      <input
                        type="text"
                        value={editTutor}
                        onChange={(e) => setEditTutor(e.target.value)}
                        placeholder="Ex: Carlos"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Main Actions during consultation routing */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-3">
                    <button
                      type="button"
                      onClick={handleEncaminhar}
                      disabled={loading}
                      className="flex-1 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <Forward className="w-4 h-4" />
                      <span>Liberar Paciente p/ {selectedClinico || 'Clínico'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalRetornoOpen(true)}
                      className="py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Agendar Retorno</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalizarDireto}
                      className="py-3.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs"
                    >
                      Finalizar Balcão
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Quick Balcao + Queue Preview */}
        <div className="lg:col-span-4 space-y-6">
          {/* USER REQUIREMENT: Nomenclatura alterada para "Nova Senha" e botão "Emitir Senha" */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              Nova Senha
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Emita uma senha avulsa para atendimento presencial no guichê.
            </p>

            <form onSubmit={handleQuickBalcao} className="space-y-3">
              <input
                type="text"
                placeholder="Número da Ficha (opcional)"
                value={balcaoFicha}
                onChange={(e) => setBalcaoFicha(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />

              <div className="grid grid-cols-2 gap-1.5">
                {(['consulta', 'retorno', 'exames', 'emergencia', 'outros'] as TipoAtendimento[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBalcaoTipo(t)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      balcaoTipo === t
                        ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {TIPOS[t]?.label || t}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
              >
                Emitir Senha
              </button>
            </form>
          </div>

          {/* Waiting Queue Preview */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700" />
                Fila de Espera ({fila.length})
              </h3>
            </div>

            {fila.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhum paciente aguardando no momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {fila.map((a, idx) => (
                  <div
                    key={a.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      a.tipo === 'emergencia'
                        ? 'bg-red-50 border-red-300 text-red-950 font-bold'
                        : a.status === 'retorno_aguardando'
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-emerald-800 font-mono">
                        {a.senha || '—'}
                      </span>
                      <div>
                        <div className="font-bold">{TIPOS[a.tipo].label}</div>
                        <div className="text-[10px] text-slate-500">Ficha: {a.ficha}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Counters Status */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Demais Guichês</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[1, 2, 3, 4]
                .filter((n) => n !== guicheNum)
                .map((n) => {
                  const g = daySummary.guiches.find((gx) => gx.n === n);
                  const a = g?.id ? appointments.find((x) => x.id === g.id) : null;
                  return (
                    <div
                      key={n}
                      onClick={() => onSelectGuiche(n)}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500 cursor-pointer transition-colors"
                    >
                      <div className="font-bold text-slate-700">Guichê {n}</div>
                      <div className="text-emerald-800 font-black text-sm my-0.5">
                        {a?.senha || 'Livre'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">{g?.estado || 'livre'}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Retorno */}
      {apptAtual && (
        <ModalRetorno
          isOpen={modalRetornoOpen}
          onClose={() => setModalRetornoOpen(false)}
          onConfirm={handleConfirmarRetorno}
          pacienteNome={apptAtual.pet}
          ficha={apptAtual.ficha}
          initialObs={apptAtual.retornoObs}
        />
      )}
    </div>
  );
};
