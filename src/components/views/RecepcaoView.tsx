import React, { useEffect, useRef, useState } from 'react';
import {
  Appointment,
  DaySummary,
  HospitalSettings,
  STATUS_LABELS,
  TIPOS,
  TipoAtendimento,
} from '../../types/hva';
import {
  adicionarClinico,
  agendarAtendimento,
  amanha,
  brData,
  checkinManualBalcao,
  dataLonga,
  hoje,
} from '../../firebase/hvaService';
import { drawQrToCanvas, getQrDataUrl } from '../../utils/qr';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Image,
  Plus,
  Printer,
  QrCode,
  Search,
  Send,
  Share2,
  Trash2,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';

interface RecepcaoViewProps {
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
}

export const RecepcaoView: React.FC<RecepcaoViewProps> = ({
  settings,
  daySummary,
  appointments,
}) => {
  // Form state
  const [dataAgendamento, setDataAgendamento] = useState<string>(amanha());
  const [horario, setHorario] = useState<string>('09:00');
  const [ficha, setFicha] = useState<string>('');
  const [tipo, setTipo] = useState<TipoAtendimento>('consulta');
  const [clinico, setClinico] = useState<string>(settings.clinicos[0] || 'Adélio Gurgel do Amaral Junior');
  const [isNovoClinico, setIsNovoClinico] = useState<boolean>(false);
  const [novoClinicoNome, setNovoClinicoNome] = useState<string>('');
  const [pet, setPet] = useState<string>('');
  const [tutor, setTutor] = useState<string>('');
  const [telefoneTutor, setTelefoneTutor] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  // Active created appointment modal/view
  const [lastCreated, setLastCreated] = useState<Appointment | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter state for appointments list
  const [filtroData, setFiltroData] = useState<'hoje' | 'amanha' | 'todos'>('hoje');
  const [busca, setBusca] = useState<string>('');

  // Keep clinico synced with settings if not set
  useEffect(() => {
    if (!clinico && settings.clinicos.length > 0) {
      setClinico(settings.clinicos[0]);
    }
  }, [settings.clinicos]);

  // Builds comprehensive QR code payload with all patient & appointment information
  const getPayload = (appt: Appointment) => {
    return JSON.stringify({
      token: appt.token,
      id: appt.id,
      ficha: appt.ficha,
      tutor: appt.tutor || '',
      pet: appt.pet || '',
      clinico: appt.clinico,
      horario: appt.horario || '',
      data: appt.data,
      tipo: appt.tipo,
    });
  };

  // Redraw QR code when lastCreated changes
  useEffect(() => {
    if (lastCreated && qrCanvasRef.current) {
      drawQrToCanvas(qrCanvasRef.current, getPayload(lastCreated), 260);
    }
  }, [lastCreated]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ficha.trim()) {
      setFeedback({ tipo: 'err', msg: 'Por favor, informe o número da ficha física.' });
      return;
    }

    const clinicoFinal = isNovoClinico ? novoClinicoNome.trim() : clinico;
    if (!clinicoFinal) {
      setFeedback({ tipo: 'err', msg: 'Selecione ou digite o clínico responsável.' });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      // If a new clinician name was typed, add to hospital settings
      if (isNovoClinico && novoClinicoNome.trim()) {
        try {
          await adicionarClinico(novoClinicoNome.trim(), settings.clinicos);
        } catch (err) {
          console.warn('Could not save new clinician to settings:', err);
        }
      }

      const res = await agendarAtendimento({
        ficha: ficha.trim(),
        clinico: clinicoFinal,
        tipo,
        data: dataAgendamento,
        horario: horario.trim(),
        pet: pet.trim(),
        tutor: tutor.trim(),
      });

      setLastCreated(res.appt);
      setFeedback({
        tipo: 'ok',
        msg: `Agendamento cadastrado com sucesso! QR Code gerado para ${brData(dataAgendamento)} às ${horario}.`,
      });

      // Clear fields for next entry
      setFicha('');
      setPet('');
      setTutor('');
      if (isNovoClinico) {
        setNovoClinicoNome('');
        setIsNovoClinico(false);
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ tipo: 'err', msg: err.message || 'Falha ao agendar atendimento.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQr = async () => {
    if (!lastCreated) return;
    const url = await getQrDataUrl(getPayload(lastCreated), 400);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_HVA_Ficha_${lastCreated.ficha}_${lastCreated.data}.png`;
    link.click();
  };

  const handlePrintQr = async () => {
    if (!lastCreated) return;
    const url = await getQrDataUrl(getPayload(lastCreated), 400);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>QR Code - ${lastCreated.ficha}</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 20px; }
              .card { border: 2px dashed #0d7a65; border-radius: 16px; padding: 24px; max-width: 320px; margin: 0 auto; }
              img { width: 220px; height: 220px; margin: 12px 0; }
              h2 { color: #0d7a65; margin: 0; font-size: 20px; }
              p { margin: 4px 0; font-size: 14px; }
              .token { font-family: monospace; font-size: 11px; color: #555; word-break: break-all; margin-top: 6px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>${settings.nomeHospital}</h2>
              <p><b>Data:</b> ${dataLonga(lastCreated.data)}</p>
              ${lastCreated.horario ? `<p><b>Horário:</b> ${lastCreated.horario}</p>` : ''}
              <p><b>Ficha:</b> ${lastCreated.ficha} • <b>Tipo:</b> ${TIPOS[lastCreated.tipo].label}</p>
              ${lastCreated.pet ? `<p><b>Pet:</b> ${lastCreated.pet}</p>` : ''}
              ${lastCreated.tutor ? `<p><b>Tutor:</b> ${lastCreated.tutor}</p>` : ''}
              <p><b>Clínico:</b> ${lastCreated.clinico}</p>
              <img src="${url}" />
              <p>Apresente este código no totem ao chegar.</p>
              <div class="token">Token: ${lastCreated.token}</div>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const handleShareWhatsApp = () => {
    if (!lastCreated) return;
    const petText = lastCreated.pet ? ` (*${lastCreated.pet}*)` : '';
    const horarioText = lastCreated.horario ? `\n⏰ *Horário agendado:* ${lastCreated.horario}` : '';
    const msg =
      `🐾 *${settings.nomeHospital}*\n\n` +
      `Olá! Seu atendimento para o pet${petText} está agendado.\n` +
      `📅 *Data:* ${dataLonga(lastCreated.data)}${horarioText}\n` +
      `📋 *Ficha:* ${lastCreated.ficha}\n` +
      `🩺 *Tipo:* ${TIPOS[lastCreated.tipo].label}\n` +
      `👨‍⚕️ *Clínico:* ${lastCreated.clinico}\n\n` +
      `📱 *Código de Check-in:* ${lastCreated.token}\n\n` +
      `Ao chegar no hospital, aproxime a tela com o QR code da câmera do nosso totem de autoatendimento para retirar sua senha automaticamente.`;

    const cleanPhone = telefoneTutor.replace(/\D/g, '');
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  // Quick OCR / Image Paste extractor for Ficha number
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nameDigits = file.name.match(/\d{4,6}/);
    if (nameDigits) {
      setFicha(nameDigits[0]);
      setFeedback({ tipo: 'ok', msg: `Número de ficha ${nameDigits[0]} identificado pelo arquivo!` });
    } else {
      setFeedback({
        tipo: 'ok',
        msg: 'Foto carregada! Digite o número correspondente à ficha física abaixo.',
      });
    }
  };

  // Filtered appointments
  const apptsFiltrados = appointments
    .filter((a) => {
      if (filtroData === 'hoje') return a.data === hoje();
      if (filtroData === 'amanha') return a.data === amanha();
      return true;
    })
    .filter((a) => {
      if (!busca.trim()) return true;
      const term = busca.toLowerCase();
      return (
        a.ficha.toLowerCase().includes(term) ||
        (a.pet && a.pet.toLowerCase().includes(term)) ||
        (a.tutor && a.tutor.toLowerCase().includes(term)) ||
        (a.senha && a.senha.toLowerCase().includes(term)) ||
        (a.clinico && a.clinico.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-700" />
            Recepção – Agendamentos & Emissão de QR
          </h1>
          <p className="text-sm text-slate-600 mt-0.5 font-medium">
            Cadastre os agendamentos com data, horário e equipe clínica, e emita o QR Code para o tutor.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold shadow-xs ${
            feedback.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {feedback.tipo === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Main Grid: Form + QR Code Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Novo Agendamento</span>
          </h2>

          <form onSubmit={handleCadastrar} className="space-y-4">
            {/* Data e Horário do Atendimento */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Data do Atendimento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDataAgendamento(amanha())}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      dataAgendamento === amanha()
                        ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Amanhã ({brData(amanha())})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataAgendamento(hoje())}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      dataAgendamento === hoje()
                        ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Hoje ({brData(hoje())})
                  </button>
                  <input
                    type="date"
                    value={dataAgendamento}
                    onChange={(e) => setDataAgendamento(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* USER REQUIREMENT: Horário do Atendimento */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Horário Agendado</span>
                </label>
                <input
                  type="time"
                  required
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm font-black text-slate-900 bg-white focus:outline-emerald-600"
                />
              </div>
            </div>

            {/* Número da Ficha Física */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Número da Ficha Física <span className="text-red-500">*</span>
                </label>
                <label className="cursor-pointer text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Foto da ficha</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <input
                type="text"
                required
                value={ficha}
                onChange={(e) => setFicha(e.target.value)}
                placeholder="Ex: 48213"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-base font-bold tracking-wider text-slate-900 focus:outline-emerald-600 focus:border-emerald-600"
              />
            </div>

            {/* USER REQUIREMENT: Tipo de Atendimento com opção "Outros" */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Tipo de Atendimento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['consulta', 'retorno', 'exames', 'radiografia', 'ultrassom', 'outros'] as TipoAtendimento[]).map(
                  (t) => {
                    const info = TIPOS[t];
                    const isSelected = tipo === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold'
                        }`}
                      >
                        <div className="text-sm font-extrabold">{info.label}</div>
                        <div className="text-[10px] text-slate-400">Prefixo ({info.p})</div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* USER REQUIREMENT: Veterinários Responsáveis com opção de digitar novo clínico */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Clínico Veterinário Responsável <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsNovoClinico(!isNovoClinico)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isNovoClinico ? 'Escolher da lista' : '+ Digitar novo clínico'}</span>
                </button>
              </div>

              {!isNovoClinico ? (
                <select
                  value={clinico}
                  onChange={(e) => setClinico(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white"
                >
                  {settings.clinicos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do novo clínico..."
                    value={novoClinicoNome}
                    onChange={(e) => setNovoClinicoNome(e.target.value)}
                    className="flex-1 px-3 py-2.5 border-2 border-emerald-500 rounded-xl text-sm font-bold text-slate-900 bg-emerald-50/30 focus:outline-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setIsNovoClinico(false)}
                    className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Pet e Tutor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Paciente (Pet)
                </label>
                <input
                  type="text"
                  value={pet}
                  onChange={(e) => setPet(e.target.value)}
                  placeholder="Ex: Thor, Mel, Luna..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Tutor
                </label>
                <input
                  type="text"
                  value={tutor}
                  onChange={(e) => setTutor(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                WhatsApp do Tutor (para envio do QR code)
              </label>
              <input
                type="tel"
                value={telefoneTutor}
                onChange={(e) => setTelefoneTutor(e.target.value)}
                placeholder="Ex: 11999998888 (com DDD)"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-5 h-5" />
              {loading ? 'Cadastrando...' : 'Gerar Agendamento e Criar QR Code'}
            </button>
          </form>
        </div>

        {/* QR Code Preview & Share Actions Column */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center text-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-700" />
              QR Code do Atendimento
            </h3>
            {lastCreated && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                Pronto para leitura
              </span>
            )}
          </div>

          {lastCreated ? (
            <div className="w-full space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center">
                <canvas ref={qrCanvasRef} className="rounded-xl shadow-xs bg-white p-2" />
                
                {/* Details shown to the user & encoded in QR code */}
                <div className="mt-3 text-center space-y-1 w-full">
                  <div className="text-xl font-black text-slate-900 tracking-wider">
                    Ficha {lastCreated.ficha}
                  </div>
                  <div className="text-xs text-emerald-800 font-black flex items-center justify-center gap-2">
                    <span>{TIPOS[lastCreated.tipo].label}</span>
                    {lastCreated.horario && (
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                        às {lastCreated.horario}
                      </span>
                    )}
                  </div>
                  {lastCreated.pet && (
                    <div className="text-xs text-slate-700 font-bold">
                      Paciente: {lastCreated.pet} {lastCreated.tutor ? `• Tutor: ${lastCreated.tutor}` : ''}
                    </div>
                  )}
                  <div className="text-xs text-slate-600 font-medium">
                    Clínico: {lastCreated.clinico}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 break-all px-2 pt-1">
                    Token: {lastCreated.token}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2 w-full">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Enviar QR pelo WhatsApp
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PNG
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintQr}
                    className="py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 px-4 text-center text-slate-400">
              <QrCode className="w-16 h-16 mx-auto stroke-1 opacity-30 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Nenhum QR Code gerado ainda</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Preencha os dados do agendamento à esquerda para gerar o código de acesso rápido ao totem.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Appointments List & Records Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700" />
              Agendamentos Cadastrados
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Lista de atendimentos salvos no Firebase Firestore com sincronização em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Date Buttons */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFiltroData('hoje')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filtroData === 'hoje' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Hoje ({appointments.filter((a) => a.data === hoje()).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroData('amanha')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filtroData === 'amanha'
                    ? 'bg-white text-emerald-900 font-bold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Amanhã ({appointments.filter((a) => a.data === amanha()).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroData('todos')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filtroData === 'todos'
                    ? 'bg-white text-emerald-900 font-bold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Todos ({appointments.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar ficha, pet ou clínico..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {apptsFiltrados.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Nenhum agendamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Data / Horário</th>
                  <th className="py-2.5 px-3">Ficha</th>
                  <th className="py-2.5 px-3">Senha</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Paciente / Tutor</th>
                  <th className="py-2.5 px-3">Clínico</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apptsFiltrados.map((a) => {
                  const isHoje = a.data === hoje();
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        <div>
                          {brData(a.data)} {isHoje && <span className="text-emerald-700 font-bold">(Hoje)</span>}
                        </div>
                        {a.horario && (
                          <div className="text-[11px] font-bold text-slate-500">
                            {a.horario}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900 tracking-wider">
                        {a.ficha}
                      </td>
                      <td className="py-3 px-3">
                        {a.senha ? (
                          <span className="font-black text-emerald-800 text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {a.senha}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Não emitida</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700">{TIPOS[a.tipo]?.label || a.tipo}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{a.pet || '—'}</div>
                        {a.tutor && <div className="text-slate-400 text-[11px]">{a.tutor}</div>}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-semibold">{a.clinico || '—'}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            a.status === 'agendado'
                              ? 'bg-slate-100 text-slate-700'
                              : a.status === 'aguardando'
                              ? 'bg-amber-100 text-amber-800'
                              : a.status === 'retorno_aguardando'
                              ? 'bg-yellow-100 text-yellow-900'
                              : a.status === 'chamado' || a.status === 'atendimento_recepcao'
                              ? 'bg-sky-100 text-sky-800'
                              : a.status === 'encaminhado'
                              ? 'bg-purple-100 text-purple-800'
                              : a.status === 'em_consulta'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.status === 'finalizado'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setLastCreated(a)}
                          title="Visualizar QR Code"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
