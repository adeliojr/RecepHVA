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
    'scan' | 'balcao' | 'retorno' | 'emergencia' | 'sucesso' | 'manual_token'
  >('scan');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Success result
  const [resultado, setResultado] = useState<{
    senha: string;
    tipo: string;
    frente: number;
    msg: string;
    jaFeito?: boolean;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(10);

  // Balcao form
  const [fichaBalcao, setFichaBalcao] = useState('');
  const [loading, setLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Manual token modal
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Retorno keypad
  const [letraRetorno, setLetraRetorno] = useState<'C' | 'R' | 'L' | 'X' | 'U'>('C');
  const [numeroRetorno, setNumeroRetorno] = useState('');

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelScanRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-reset timer when in 'sucesso'
  useEffect(() => {
    if (modo !== 'sucesso') return;
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleVoltar();
          return 10;
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
          // Attempt 1: with preferred facingMode and HD resolution
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Attempt 2: generic video constraints if ideal fails
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
            'Não foi possível ligar a câmera do dispositivo. Verifique a permissão de câmera do navegador ou utilize os botões abaixo.'
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
      setResultado({
        senha: res.appt.senha || '—',
        tipo: TIPOS[res.appt.tipo].label,
        frente: res.frente,
        msg: res.jaFeito
          ? 'Check-in já havia sido registrado anteriormente!'
          : 'Check-in realizado com sucesso!',
        jaFeito: res.jaFeito,
      });
      setModo('sucesso');
    } catch (err: any) {
      setErroMsg(err.message || 'QR Code inválido.');
      tocarEmergencia();
      // Restart camera after brief pause to allow tutor to try again
      setTimeout(() => {
        setErroMsg(null);
        setModo('scan');
      }, 4500);
    } finally {
      setLoading(false);
    }
  };

  // Image file QR scanner fallback
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
    // Reset file input
    e.target.value = '';
  };

  const handleBalcaoConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinManualBalcao(fichaBalcao, 'consulta', daySummary, appointments);
      tocarSineta();
      setResultado({
        senha: res.appt.senha || '—',
        tipo: 'Consulta Balcão',
        frente: res.frente,
        msg: 'Senha emitida para atendimento no guichê!',
      });
      setModo('sucesso');
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao gerar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergenciaConfirm = async () => {
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinManualBalcao('', 'emergencia', daySummary, appointments);
      tocarEmergencia();
      setResultado({
        senha: res.appt.senha || '—',
        tipo: 'Emergência Veterinária',
        frente: 0,
        msg: 'EMERGÊNCIA REGISTRADA COM PRIORIDADE MÁXIMA!',
      });
      setModo('sucesso');
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
      setResultado({
        senha: res.appt.senha || '—',
        tipo: 'Agendamento de Retorno',
        frente: res.frente,
        msg: 'Aguarde ser chamado no guichê para marcar a data do retorno.',
        jaFeito: res.jaFeito,
      });
      setModo('sucesso');
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
    setFichaBalcao('');
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

      {/* Top Banner */}
      <div className="max-w-3xl mx-auto w-full text-center pt-2">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-2 border border-white/20">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{settings.nomeHospital}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-md">
          Totem de Autoatendimento
        </h1>
        <p className="text-emerald-100 text-sm sm:text-lg mt-1 font-semibold max-w-xl mx-auto">
          Aproxime o QR Code do seu celular da câmera ou escolha uma das opções abaixo
        </p>
      </div>

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto w-full my-auto py-4">
        {erroMsg && (
          <div className="mb-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm sm:text-base border-2 border-white animate-in zoom-in-95 duration-200">
            <AlertOctagon className="w-6 h-6 shrink-0 text-white animate-bounce" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* ==================== 1. SCAN MODE (Default Kiosk Screen) ==================== */}
        {modo === 'scan' && (
          <div className="flex flex-col items-center gap-6">
            {/* Live Camera Viewport Box */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-slate-950 rounded-3xl border-4 border-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden flex items-center justify-center group">
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

            {/* Camera Utility Quick Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleToggleCamera}
                title="Trocar entre câmera frontal e traseira"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs"
              >
                <SwitchCamera className="w-4 h-4" />
                <span>Trocar Câmera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Ler imagem de QR Code"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs"
              >
                <FileImage className="w-4 h-4" />
                <span>Ler de Foto / Arquivo</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('manual_token')}
                title="Digitar código manualmente"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Keyboard className="w-4 h-4" />
                <span>Digitar Código</span>
              </button>
            </div>

            {/* Quick Test Token simulation chips */}
            {agendadosHojeSemCheckin.length > 0 && (
              <div className="bg-emerald-900/60 backdrop-blur-md border border-emerald-400/30 rounded-2xl p-3 w-full text-center shadow-md">
                <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-200 mb-1.5 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Testar leitura de QR Code agendado para hoje (Simulação):</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {agendadosHojeSemCheckin.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleProcessarToken(a.token)}
                      className="px-3 py-1.5 bg-white text-emerald-950 hover:bg-emerald-100 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95"
                    >
                      Ficha {a.ficha} ({a.pet || TIPOS[a.tipo].label})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* =========================================================================
                REQUESTED CHANGE: LARGER BUTTONS STACKED VERTICALLY ONE ABOVE ANOTHER
               ========================================================================= */}
            <div className="flex flex-col gap-4 w-full pt-1">
              {/* BUTTON 1: CONSULTA SEM AGENDAMENTO (BALCÃO) */}
              <button
                type="button"
                onClick={() => setModo('balcao')}
                className="w-full py-5 sm:py-6 px-6 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-950 rounded-3xl shadow-xl border-3 border-white/80 transition-all flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight leading-tight">
                      Consulta sem Agendamento
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
                      Cheguei direto no hospital ou sem horário marcado
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
                onClick={() => setModo('emergencia')}
                className="w-full py-5 sm:py-6 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white rounded-3xl shadow-[0_8px_30px_rgba(220,38,38,0.45)] border-3 border-red-300 transition-all flex items-center justify-between text-left group cursor-pointer animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs border border-white/30">
                    <HeartPulse className="w-8 h-8 text-white" />
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
                onClick={() => setModo('retorno')}
                className="w-full py-5 sm:py-6 px-6 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-[0.98] text-amber-950 rounded-3xl shadow-xl border-3 border-amber-200 transition-all flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/30 text-amber-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs border border-amber-500/30">
                    <Clock className="w-8 h-8 text-amber-950" />
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

        {/* ==================== 2. BALCAO MODE ==================== */}
        {modo === 'balcao' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-2xl font-black text-emerald-950">Consulta sem Agendamento</h2>
                <p className="text-xs text-slate-500">Retirada de senha para atendimento no guichê</p>
              </div>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleBalcaoConfirm} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Número da Ficha Física (se souber)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 48213 (ou deixe em branco se for paciente novo)"
                  value={fichaBalcao}
                  onChange={(e) => setFichaBalcao(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:outline-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVoltar}
                  className="flex-1 py-3.5 px-4 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm shadow-md"
                >
                  {loading ? 'Emitindo...' : 'Emitir Senha de Atendimento'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== 3. EMERGENCY CONFIRMATION MODAL ==================== */}
        {modo === 'emergencia' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-red-500 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-red-600">
                Atenção: Atendimento de Emergência
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto mt-2">
                Utilize esta opção <b>exclusivamente</b> para animais em risco iminente de morte,
                politraumatizados, hemorragias graves, convulsões ativas ou dificuldade respiratória severa.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="flex-1 py-4 px-4 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-2xl font-black text-sm"
              >
                Não é emergência (Voltar)
              </button>
              <button
                type="button"
                onClick={handleEmergenciaConfirm}
                disabled={loading}
                className="flex-1 py-4 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-xl"
              >
                {loading ? 'Chamando equipe médica...' : 'CONFIRMAR EMERGÊNCIA'}
              </button>
            </div>
          </div>
        )}

        {/* ==================== 4. RETORNO KEYPAD MODE ==================== */}
        {modo === 'retorno' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-2xl font-black text-emerald-950">Agendar Retorno</h2>
                <p className="text-xs text-slate-500">
                  Informe a senha da sua consulta anterior realizada hoje
                </p>
              </div>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            {/* Prefix selector */}
            <div className="flex justify-center gap-2">
              {(['C', 'R', 'L', 'X', 'U'] as const).map((letra) => (
                <button
                  key={letra}
                  type="button"
                  onClick={() => setLetraRetorno(letra)}
                  className={`w-12 h-12 rounded-xl font-black text-lg border-2 transition-all ${
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
                  className="h-14 bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 rounded-xl font-black text-xl text-slate-800 transition-colors"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNumeroRetorno('')}
                className="h-14 bg-slate-100 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (numeroRetorno.length < 3) setNumeroRetorno(numeroRetorno + '0');
                }}
                className="h-14 bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 rounded-xl font-black text-xl text-slate-800 transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setNumeroRetorno(numeroRetorno.slice(0, -1))}
                className="h-14 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-600"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="flex-1 py-3 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRetornoConfirm}
                disabled={loading || !numeroRetorno}
                className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-md"
              >
                {loading ? 'Localizando...' : 'Entrar na Fila de Retorno'}
              </button>
            </div>
          </div>
        )}

        {/* ==================== 5. MANUAL TOKEN INPUT MODAL ==================== */}
        {modo === 'manual_token' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-2xl font-black text-emerald-950">Digitar Código do QR</h2>
                <p className="text-xs text-slate-500">
                  Informe o código alfanumérico enviado para o seu WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleManualTokenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Código de Check-in
                </label>
                <input
                  type="text"
                  placeholder="Ex: 20261105abc123"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-lg font-mono font-bold text-slate-900 focus:outline-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVoltar}
                  className="flex-1 py-3.5 px-4 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading || !manualTokenInput.trim()}
                  className="flex-1 py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-md"
                >
                  {loading ? 'Validando...' : 'Confirmar Check-in'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== 6. SUCCESS SCREEN ==================== */}
        {modo === 'sucesso' && resultado && (
          <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 border-4 border-emerald-400 animate-in zoom-in-95 duration-200">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-800 rounded-full">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400">
                Sua Senha de Atendimento
              </p>
              <div className="text-6xl sm:text-8xl font-black text-emerald-800 tracking-wider my-3 font-mono">
                {resultado.senha}
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-700">{resultado.tipo}</div>
              <p className="text-xs text-slate-500 mt-1">{resultado.msg}</p>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 max-w-sm mx-auto">
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
              <div className="text-[11px] text-emerald-700 mt-1">
                Acompanhe as chamadas de voz e tela pelo Painel TV na recepção.
              </div>
            </div>

            <button
              type="button"
              onClick={handleVoltar}
              className="py-3 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer"
            >
              Concluir ({countdown}s)
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer Notice */}
      <div className="max-w-2xl mx-auto w-full text-center text-xs text-emerald-100 font-semibold pb-1">
        Em caso de dúvidas ou dificuldades com a leitura, dirija-se diretamente a um dos nossos guichês.
      </div>
    </div>
  );
};
