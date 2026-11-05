import React, { useEffect, useRef, useState } from 'react';
import { Appointment, DaySummary, HospitalSettings, TIPOS } from '../../types/hva';
import {
  checkinComQr,
  checkinManualBalcao,
  hoje,
  solicitarRetornoPorSenha,
} from '../../firebase/hvaService';
import { scanQRCodeFromImageData, scanQrCodeFromVideo } from '../../utils/qr';
import { tocarEmergencia, tocarSineta } from '../../utils/audio';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Delete,
  FileImage,
  Flame,
  HeartPulse,
  Keyboard,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Sparkles,
  SwitchCamera,
  UserCheck,
  Users,
} from 'lucide-react';

interface CheckinViewProps {
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
}

export const CheckinView: React.FC<CheckinViewProps> = ({
  settings,
  daySummary,
  appointments,
}) => {
  const [modo, setModo] = useState<
    'scan' | 'retorno' | 'emergencia' | 'sucesso' | 'manual_token'
  >('scan');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Automatic printer persistence in localStorage
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hva_auto_print') === 'true';
    } catch {
      return false;
    }
  });

  // Success result
  const [resultado, setResultado] = useState<{
    senha: string;
    tipo: string;
    frente: number;
    msg: string;
    jaFeito?: boolean;
    ficha?: string;
    tutor?: string;
    pet?: string;
    clinico?: string;
    horario?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  const [loading, setLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Manual token input
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Retorno keypad
  const [letraRetorno, setLetraRetorno] = useState<'C' | 'R' | 'L' | 'X' | 'U' | 'O'>('C');
  const [numeroRetorno, setNumeroRetorno] = useState('');

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelScanRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toggle and persist automatic printing
  const toggleAutoPrint = () => {
    const nextVal = !autoPrint;
    setAutoPrint(nextVal);
    try {
      localStorage.setItem('hva_auto_print', String(nextVal));
    } catch {}
  };

  // Thermal printing helper for kiosk tickets
  const imprimirSenhaTermica = (data: {
    senha: string;
    tipo: string;
    frente: number;
    ficha?: string;
    tutor?: string;
    pet?: string;
    clinico?: string;
    horario?: string;
  }) => {
    try {
      const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dataStr = new Date().toLocaleDateString('pt-BR');

      // Create a hidden print iframe to avoid leaving the kiosk view
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) return;

      doc.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Senha ${data.senha}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace, sans-serif;
                width: 72mm;
                margin: 0 auto;
                padding: 10px 4px;
                color: #000;
                text-align: center;
              }
              .logo { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
              .sub { font-size: 10px; margin-bottom: 6px; }
              .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
              .tipo { font-size: 13px; font-weight: 800; text-transform: uppercase; }
              .senha { font-size: 48px; font-weight: 900; letter-spacing: 2px; margin: 4px 0; }
              .info { font-size: 11px; text-align: left; margin: 4px 0; line-height: 1.4; }
              .frente { font-size: 11px; font-weight: 800; margin-top: 4px; }
              .footer { font-size: 10px; margin-top: 8px; }
            </style>
          </head>
          <body>
            <div class="logo">HOSPITAL VETERINÁRIO ARAÚJO</div>
            <div class="sub">HVA - Recepção & Triagem</div>
            <div class="divider"></div>
            <div class="tipo">${data.tipo}</div>
            <div class="senha">${data.senha}</div>
            <div class="divider"></div>
            <div class="info">
              <div><b>Data:</b> ${dataStr}  <b>Hora:</b> ${horaStr}</div>
              ${data.ficha ? `<div><b>Ficha:</b> ${data.ficha}</div>` : ''}
              ${data.tutor ? `<div><b>Tutor:</b> ${data.tutor}</div>` : ''}
              ${data.pet ? `<div><b>Paciente:</b> ${data.pet}</div>` : ''}
              ${data.clinico ? `<div><b>Clínico:</b> ${data.clinico}</div>` : ''}
              ${data.horario ? `<div><b>Horário agendado:</b> ${data.horario}</div>` : ''}
            </div>
            <div class="divider"></div>
            <div class="frente">
              ${data.frente > 0 ? `Pessoas na frente: ${data.frente}` : 'Sua vez está próxima!'}
            </div>
            <div class="footer">Acompanhe a chamada pelo Painel TV</div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 250);
    } catch (err) {
      console.warn('Silent print error:', err);
    }
  };

  // Auto-reset timer when in 'sucesso'
  useEffect(() => {
    if (modo !== 'sucesso') return;
    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleVoltar();
          return 4;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [modo]);

  // Start camera when in 'scan' mode or when facingMode changes
  useEffect(() => {
    if (modo !== 'scan') {
      pararCamera();
      return;
    }

    let isMounted = true;

    async function initCamera() {
      pararCamera();
      setCameraErro(null);

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('autoplay', 'true');
          video.setAttribute('muted', 'true');

          video.onloadedmetadata = async () => {
            if (!isMounted) return;
            try {
              await video.play();
              setCameraAtiva(true);

              if (cancelScanRef.current) {
                cancelScanRef.current();
              }

              cancelScanRef.current = scanQrCodeFromVideo(video, (token: string) => {
                if (isMounted) {
                  handleProcessarToken(token);
                }
              });
            } catch (playErr) {
              console.warn('Video play interrupted:', playErr);
            }
          };
        }
      } catch (err: any) {
        console.warn('Camera access issue:', err);
        if (isMounted) {
          setCameraErro(
            'Não foi possível ligar a câmera do dispositivo. Verifique a permissão de câmera do navegador ou utilize as opções abaixo.'
          );
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      pararCamera();
    };
  }, [modo, facingMode]);

  const pararCamera = () => {
    if (cancelScanRef.current) {
      cancelScanRef.current();
      cancelScanRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleProcessarToken = async (rawToken: string) => {
    pararCamera();
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinComQr(rawToken, daySummary, appointments);
      tocarSineta();

      const ticketPayload = {
        senha: res.appt.senha || '—',
        tipo: TIPOS[res.appt.tipo]?.label || 'Consulta',
        frente: res.frente,
        msg: res.jaFeito
          ? 'Check-in já registrado! Esta é a sua senha.'
          : 'Check-in realizado com sucesso!',
        jaFeito: res.jaFeito,
        ficha: res.appt.ficha,
        tutor: res.appt.tutor,
        pet: res.appt.pet,
        clinico: res.appt.clinico,
        horario: res.appt.horario,
      };

      setResultado(ticketPayload);
      setModo('sucesso');

      // Trigger automatic printing if enabled
      if (autoPrint) {
        imprimirSenhaTermica(ticketPayload);
      }
    } catch (err: any) {
      setErroMsg(err.message || 'QR Code não reconhecido.');
      tocarEmergencia();
      setTimeout(() => {
        setErroMsg(null);
        setModo('scan');
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  // Immediate Walk-in Consultation (Consulta sem Agendamento)
  // USER REQUIREMENT: Tutor does NOT need to enter record number. Issues ticket immediately!
  const handleConsultaSemAgendamentoDireta = async () => {
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinManualBalcao('', 'consulta', daySummary, appointments);
      tocarSineta();

      const ticketPayload = {
        senha: res.appt.senha || '—',
        tipo: 'Consulta sem Agendamento',
        frente: res.frente,
        msg: 'Senha emitida! Aguarde ser chamado no guichê para fazer o cadastro da ficha.',
        ficha: 'Aguardando cadastro no guichê',
      };

      setResultado(ticketPayload);
      setModo('sucesso');

      // Automatic print if enabled
      if (autoPrint) {
        imprimirSenhaTermica(ticketPayload);
      }
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao gerar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleScanFromImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const token = scanQRCodeFromImageData(imgData.data, canvas.width, canvas.height);
        if (token) {
          handleProcessarToken(token);
        } else {
          setErroMsg('Nenhum QR Code legível foi detectado nesta imagem.');
          setTimeout(() => setErroMsg(null), 4000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEmergenciaConfirm = async () => {
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinManualBalcao('', 'emergencia', daySummary, appointments);
      tocarEmergencia();

      const ticketPayload = {
        senha: res.appt.senha || '—',
        tipo: 'Emergência Veterinária',
        frente: 0,
        msg: 'EMERGÊNCIA REGISTRADA COM PRIORIDADE MÁXIMA!',
        ficha: 'EMERGÊNCIA',
      };

      setResultado(ticketPayload);
      setModo('sucesso');

      if (autoPrint) {
        imprimirSenhaTermica(ticketPayload);
      }
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao gerar senha de emergência');
    } finally {
      setLoading(false);
    }
  };

  const handleRetornoConfirm = async () => {
    if (!numeroRetorno) {
      setErroMsg('Digite o número da sua senha anterior');
      return;
    }
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await solicitarRetornoPorSenha(
        letraRetorno,
        numeroRetorno,
        daySummary,
        appointments
      );
      tocarSineta();

      const ticketPayload = {
        senha: res.appt.senha || '—',
        tipo: 'Agendamento de Retorno',
        frente: res.frente,
        msg: 'Aguarde ser chamado no guichê para agendar a data do retorno.',
        jaFeito: res.jaFeito,
        ficha: res.appt.ficha,
        tutor: res.appt.tutor,
        pet: res.appt.pet,
      };

      setResultado(ticketPayload);
      setModo('sucesso');

      if (autoPrint) {
        imprimirSenhaTermica(ticketPayload);
      }
    } catch (err: any) {
      setErroMsg(err.message || 'Senha não localizada');
    } finally {
      setLoading(false);
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenInput.trim()) return;
    handleProcessarToken(manualTokenInput.trim());
  };

  const handleVoltar = () => {
    setModo('scan');
    setErroMsg(null);
    setNumeroRetorno('');
    setManualTokenInput('');
    setResultado(null);
  };

  // Scheduled appointments today without checkin
  const agendadosHojeSemCheckin = appointments.filter(
    (a) => a.data === hoje() && a.status === 'agendado'
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-radial from-[#0e6f5c] via-[#0d7a65] to-[#084e40] text-white flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Hidden File Input for QR Code Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleScanFromImage}
        className="hidden"
      />

      {/* Top Banner & Automatic Print Toggle */}
      <div className="max-w-xl mx-auto w-full pt-1">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase border border-white/20">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{settings.nomeHospital}</span>
          </div>

          {/* Persistent Auto-Print Toggle Button */}
          <button
            type="button"
            onClick={toggleAutoPrint}
            title="Ativar/Desativar impressão automática das senhas geradas"
            className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
              autoPrint
                ? 'bg-amber-400 text-amber-950 border-2 border-white ring-2 ring-amber-300/40'
                : 'bg-white/15 text-white/80 border border-white/20 hover:bg-white/25'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${autoPrint ? 'animate-bounce' : ''}`} />
            <span>{autoPrint ? '🖨️ Impressão Auto: ATIVADA' : '🖨️ Impressão Auto: Desativada'}</span>
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-md">
            Totem de Autoatendimento
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base mt-1 font-semibold">
            Aproxime o QR Code do seu celular da câmera ou escolha uma das opções abaixo
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto w-full my-auto py-3">
        {erroMsg && (
          <div className="mb-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm sm:text-base border-2 border-white animate-in zoom-in-95 duration-200">
            <AlertOctagon className="w-6 h-6 shrink-0 text-white animate-bounce" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* ==================== 1. SCAN MODE (Default Kiosk Screen) ==================== */}
        {modo === 'scan' && (
          <div className="flex flex-col items-center gap-5">
            {/* Live Camera Viewport Box */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-slate-950 rounded-3xl border-4 border-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden flex items-center justify-center group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Aiming Reticle Frame */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/90 rounded-2xl pointer-events-none flex items-center justify-center shadow-inner">
                {/* Laser scan line effect */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                <div className="w-4 h-4 border-2 border-emerald-300 rounded-full animate-ping" />
              </div>

              {/* Status Pill */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-emerald-200 border border-white/20 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{cameraAtiva ? 'Aponte o QR Code aqui' : 'Conectando câmera...'}</span>
              </div>

              {!cameraAtiva && !cameraErro && (
                <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-12 h-12 text-emerald-300 animate-pulse mb-3" />
                  <p className="text-sm font-bold text-emerald-100">Iniciando câmera do totem...</p>
                  <p className="text-xs text-emerald-300/80 mt-1">
                    Aguarde um instante para a leitura
                  </p>
                </div>
              )}

              {cameraErro && (
                <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center p-5 text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
                  <p className="text-xs text-amber-200 leading-relaxed font-semibold">
                    {cameraErro}
                  </p>
                </div>
              )}
            </div>

            {/* Camera Utility Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleToggleCamera}
                title="Alternar entre câmera frontal e traseira"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <SwitchCamera className="w-4 h-4" />
                <span>Trocar Câmera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Ler imagem de QR Code"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <FileImage className="w-4 h-4" />
                <span>Ler de Imagem</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('manual_token')}
                title="Digitar código manualmente"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Keyboard className="w-4 h-4" />
                <span>Digitar Código</span>
              </button>
            </div>

            {/* Quick Test Token simulation chips */}
            {agendadosHojeSemCheckin.length > 0 && (
              <div className="bg-emerald-900/60 backdrop-blur-md border border-emerald-400/30 rounded-2xl p-2.5 w-full text-center shadow-md">
                <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-200 mb-1 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Testar QR Code agendado (Simulação):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {agendadosHojeSemCheckin.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleProcessarToken(a.token)}
                      className="px-2.5 py-1 bg-white text-emerald-950 hover:bg-emerald-100 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Ficha {a.ficha} ({a.pet || TIPOS[a.tipo]?.label || 'Consulta'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* =========================================================================
                REQUESTED LAYOUT: TALL BUTTONS STACKED VERTICALLY ONE ABOVE ANOTHER
               ========================================================================= */}
            <div className="flex flex-col gap-3.5 w-full pt-1">
              {/* BUTTON 1: CONSULTA SEM AGENDAMENTO (EMISSÃO DIRETA SEM PEDIR FICHA) */}
              <button
                type="button"
                disabled={loading}
                onClick={handleConsultaSemAgendamentoDireta}
                className="w-full py-5 px-6 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-950 rounded-3xl shadow-xl border-3 border-white/90 transition-all flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight leading-tight">
                      Consulta sem Agendamento
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
                      Toque aqui para retirar sua senha • Cadastro no guichê
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </button>

              {/* BUTTON 2: EMERGÊNCIA (PRIORIDADE MÁXIMA) */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setModo('emergencia')}
                className="w-full py-5 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white rounded-3xl shadow-[0_8px_30px_rgba(220,38,38,0.45)] border-3 border-red-300 transition-all flex items-center justify-between text-left group cursor-pointer animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs border border-white/30">
                    <HeartPulse className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide leading-tight">
                        EMERGÊNCIA
                      </h2>
                      <span className="bg-white text-red-700 font-black text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Prioridade Máxima
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-red-100 font-bold mt-0.5">
                      Animal em risco de vida iminente, convulsão ou atropelamento
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </button>

              {/* BUTTON 3: AGENDAR RETORNO */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setModo('retorno')}
                className="w-full py-5 px-6 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-[0.98] text-amber-950 rounded-3xl shadow-xl border-3 border-amber-200 transition-all flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-amber-500/30 text-amber-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs border border-amber-500/30">
                    <Clock className="w-7 h-7 text-amber-950" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight leading-tight">
                      Agendar Retorno
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-900 font-bold mt-0.5">
                      Já passei pela consulta médica e preciso marcar retorno no guichê
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-950 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ==================== 2. EMERGENCY CONFIRMATION MODAL ==================== */}
        {modo === 'emergencia' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-red-500 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-red-600">
                Atenção: Atendimento de Emergência
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto mt-2 font-medium">
                Utilize esta opção <b>exclusivamente</b> para animais em risco iminente de morte,
                politraumatizados, hemorragias graves, convulsões ativas ou dificuldade respiratória severa.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="flex-1 py-4 px-4 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-2xl font-black text-sm cursor-pointer"
              >
                Não é emergência (Voltar)
              </button>
              <button
                type="button"
                onClick={handleEmergenciaConfirm}
                disabled={loading}
                className="flex-1 py-4 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-xl cursor-pointer"
              >
                {loading ? 'Chamando equipe médica...' : 'CONFIRMAR EMERGÊNCIA'}
              </button>
            </div>
          </div>
        )}

        {/* ==================== 3. RETORNO KEYPAD MODE ==================== */}
        {modo === 'retorno' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-2xl font-black text-emerald-950">Agendar Retorno</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Informe a senha da sua consulta anterior realizada hoje
                </p>
              </div>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            {/* Prefix selector */}
            <div className="flex justify-center gap-2">
              {(['C', 'R', 'L', 'X', 'U', 'O'] as const).map((letra) => (
                <button
                  key={letra}
                  type="button"
                  onClick={() => setLetraRetorno(letra)}
                  className={`w-11 h-11 rounded-xl font-black text-lg border-2 transition-all cursor-pointer ${
                    letraRetorno === letra
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-md scale-105'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {letra}
                </button>
              ))}
            </div>

            {/* Display screen */}
            <div className="bg-slate-100 rounded-2xl p-4 text-center border-2 border-slate-200">
              <span className="text-3xl font-black text-emerald-800 tracking-widest font-mono">
                {letraRetorno} {numeroRetorno ? numeroRetorno.padStart(3, '0') : '___'}
              </span>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (numeroRetorno.length < 3) setNumeroRetorno(numeroRetorno + n);
                  }}
                  className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNumeroRetorno('')}
                className="h-13 bg-slate-100 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (numeroRetorno.length < 3) setNumeroRetorno(numeroRetorno + '0');
                }}
                className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setNumeroRetorno(numeroRetorno.slice(0, -1))}
                className="h-13 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="flex-1 py-3.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRetornoConfirm}
                disabled={loading || !numeroRetorno}
                className="flex-1 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-md cursor-pointer"
              >
                {loading ? 'Localizando...' : 'Entrar na Fila de Retorno'}
              </button>
            </div>
          </div>
        )}

        {/* ==================== 4. MANUAL TOKEN INPUT MODAL ==================== */}
        {modo === 'manual_token' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-2xl font-black text-emerald-950">Digitar Código do QR</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Informe o código ou número da ficha do agendamento
                </p>
              </div>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleManualTokenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Código de Check-in ou Ficha
                </label>
                <input
                  type="text"
                  placeholder="Ex: 20261105abc123 ou 48213"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-lg font-mono font-bold text-slate-900 focus:outline-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVoltar}
                  className="flex-1 py-3.5 px-4 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading || !manualTokenInput.trim()}
                  className="flex-1 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-md cursor-pointer"
                >
                  {loading ? 'Validando...' : 'Confirmar Check-in'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== 5. SUCCESS SCREEN WITH AUTO-RESET & PRINT ==================== */}
        {modo === 'sucesso' && resultado && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-5 border-4 border-emerald-400 animate-in zoom-in-95 duration-200">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-800 rounded-full">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400">
                Sua Senha de Atendimento
              </p>
              <div className="text-6xl sm:text-8xl font-black text-emerald-800 tracking-wider my-2 font-mono">
                {resultado.senha}
              </div>
              <div className="text-lg font-black text-slate-800">{resultado.tipo}</div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{resultado.msg}</p>
            </div>

            {/* Position in queue pill */}
            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 max-w-sm mx-auto">
              <div className="text-xs text-emerald-900 font-semibold">
                {resultado.frente > 0 ? (
                  <>
                    Há <b className="text-emerald-950 font-black text-sm">{resultado.frente}</b>{' '}
                    pessoas na sua frente na fila.
                  </>
                ) : (
                  <>Você é o próximo a ser chamado no guichê!</>
                )}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Acompanhe a chamada no Painel TV da recepção.
              </div>
            </div>

            {/* Action buttons on success */}
            <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto pt-1">
              <button
                type="button"
                onClick={() => imprimirSenhaTermica(resultado)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir Senha</span>
              </button>

              <button
                type="button"
                onClick={handleVoltar}
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Novo Atendimento ({countdown}s)</span>
              </button>
            </div>

            {/* Auto-reset progress indicator */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 4) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Notice */}
      <div className="max-w-xl mx-auto w-full text-center text-xs text-emerald-100 font-semibold pb-1">
        Em caso de dúvidas ou dificuldades, dirija-se diretamente a um dos nossos guichês.
      </div>
    </div>
  );
};
