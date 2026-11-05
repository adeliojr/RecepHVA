import React, { useEffect, useRef, useState } from 'react';
import { Appointment, DaySummary, HospitalSettings, TIPOS } from '../../types/hva';
import {
  checkinComQr,
  checkinManualBalcao,
  hoje,
  solicitarRetornoPorSenha,
} from '../../firebase/hvaService';
import { scanQrCodeFromVideo } from '../../utils/qr';
import { tocarEmergencia, tocarSineta } from '../../utils/audio';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Delete,
  HeartPulse,
  QrCode,
  RotateCcw,
  Sparkles,
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
  const [modo, setModo] = useState<'scan' | 'balcao' | 'retorno' | 'emergencia' | 'sucesso'>('scan');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);

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

  // Retorno keypad
  const [letraRetorno, setLetraRetorno] = useState<'C' | 'R' | 'L' | 'X' | 'U'>('C');
  const [numeroRetorno, setNumeroRetorno] = useState('');

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelScanRef = useRef<(() => void) | null>(null);

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

  // Start camera on mount when in 'scan' mode
  useEffect(() => {
    if (modo !== 'scan') {
      pararCamera();
      return;
    }

    let isMounted = true;

    async function initCamera() {
      try {
        setCameraErro(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraAtiva(true);

          // Start scanning frames
          cancelScanRef.current = scanQrCodeFromVideo(videoRef.current, (token: string) => {
            handleProcessarToken(token);
          });
        }
      } catch (err: any) {
        console.warn('Camera access issue:', err);
        if (isMounted) {
          setCameraErro(
            'Não foi possível iniciar a câmera frontal (permissão não concedida ou dispositivo sem câmera). Você também pode usar as opções abaixo.'
          );
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      pararCamera();
    };
  }, [modo]);

  const pararCamera = () => {
    if (cancelScanRef.current) {
      cancelScanRef.current();
      cancelScanRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  const handleProcessarToken = async (token: string) => {
    pararCamera();
    try {
      setLoading(true);
      setErroMsg(null);
      const res = await checkinComQr(token, daySummary, appointments);
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
      // Restart camera after short pause
      setTimeout(() => {
        if (modo === 'scan') {
          setErroMsg(null);
        }
      }, 4000);
    } finally {
      setLoading(false);
    }
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

  const handleVoltar = () => {
    setModo('scan');
    setErroMsg(null);
    setFichaBalcao('');
    setNumeroRetorno('');
    setResultado(null);
  };

  // Quick helper: pending scheduled appointments for today that haven't checked in yet
  const agendadosHojeSemCheckin = appointments.filter(
    (a) => a.data === hoje() && a.status === 'agendado'
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0d7a65] text-white flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="max-w-3xl mx-auto w-full text-center">
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
          Totem de Autoatendimento
        </h1>
        <p className="text-emerald-100 text-sm sm:text-lg mt-1 font-medium">
          Aproxime o QR Code do celular da câmera para retirar sua senha
        </p>
      </div>

      {/* Main Content Card Container */}
      <div className="max-w-2xl mx-auto w-full my-auto py-4">
        {erroMsg && (
          <div className="mb-4 bg-red-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 font-bold text-sm sm:text-base animate-bounce">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* 1. SCAN MODE (Default Kiosk Camera) */}
        {modo === 'scan' && (
          <div className="flex flex-col items-center gap-5">
            {/* Camera Box */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-emerald-950 rounded-3xl border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Target Aim Reticle */}
              <div className="absolute inset-10 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-emerald-300 rounded-full animate-ping" />
              </div>

              {!cameraAtiva && !cameraErro && (
                <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-10 h-10 text-emerald-300 animate-pulse mb-2" />
                  <p className="text-xs text-emerald-200">Iniciando câmera frontal...</p>
                </div>
              )}

              {cameraErro && (
                <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center p-4 text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
                  <p className="text-xs text-amber-200 leading-relaxed">{cameraErro}</p>
                </div>
              )}
            </div>

            {/* Quick Test Token chips if running in preview without camera */}
            {agendadosHojeSemCheckin.length > 0 && (
              <div className="bg-emerald-900/50 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-3 max-w-lg w-full text-center">
                <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-200 mb-1.5 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Simular leitura de QR Code de hoje (Teste rápido):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {agendadosHojeSemCheckin.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleProcessarToken(a.token)}
                      className="px-2.5 py-1 bg-white text-emerald-900 hover:bg-emerald-100 rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      Ficha {a.ficha} ({a.pet || TIPOS[a.tipo].label})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons: Sem agendamento / Emergência / Retorno */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <button
                type="button"
                onClick={() => setModo('balcao')}
                className="py-4 px-4 bg-white text-emerald-950 hover:bg-emerald-50 active:scale-98 rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all flex flex-col items-center justify-center text-center gap-1"
              >
                <span>Consulta s/ agendamento</span>
                <span className="text-[11px] font-semibold text-slate-500">Cheguei direto no balcão</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('emergencia')}
                className="py-4 px-4 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all flex flex-col items-center justify-center text-center gap-1 border-2 border-red-300 animate-pulse"
              >
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-5 h-5 text-red-200" />
                  EMERGÊNCIA
                </span>
                <span className="text-[11px] font-semibold text-red-100">Risco imediato de vida</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('retorno')}
                className="py-4 px-4 bg-amber-400 hover:bg-amber-300 active:scale-98 text-amber-950 rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all flex flex-col items-center justify-center text-center gap-1"
              >
                <span>Agendar Retorno</span>
                <span className="text-[11px] font-semibold text-amber-900">Já passei com o médico</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. BALCAO MODE */}
        {modo === 'balcao' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl sm:text-2xl font-black text-emerald-950">
                Consulta sem Agendamento
              </h2>
              <button
                type="button"
                onClick={handleVoltar}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleBalcaoConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Número da Ficha Física (se souber)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 48213 (ou deixe em branco se for paciente novo)"
                  value={fichaBalcao}
                  onChange={(e) => setFichaBalcao(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl text-base font-bold text-slate-900 focus:outline-emerald-600"
                />
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
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-sm shadow-md"
                >
                  {loading ? 'Emitindo...' : 'Emitir Senha de Consulta'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. EMERGENCY CONFIRMATION MODAL */}
        {modo === 'emergencia' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-red-500 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-10 h-10 animate-bounce" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-red-600">
              Atenção: Atendimento de Emergência
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              Utilize esta opção <b>exclusivamente</b> para animais em risco iminente de morte,
              politraumatizados, hemorragias graves, convulsões ativas ou dificuldade respiratória severa.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="flex-1 py-3.5 px-4 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-2xl font-black text-sm"
              >
                Não é emergência (Voltar)
              </button>
              <button
                type="button"
                onClick={handleEmergenciaConfirm}
                disabled={loading}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-xl"
              >
                {loading ? 'Chamando equipe...' : 'CONFIRMAR EMERGÊNCIA'}
              </button>
            </div>
          </div>
        )}

        {/* 4. RETORNO KEYPAD MODE */}
        {modo === 'retorno' && (
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-emerald-950">Agendar Retorno</h2>
                <p className="text-xs text-slate-500">Informe a senha que você utilizou na consulta hoje</p>
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

        {/* 5. SUCCESS SCREEN */}
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
              className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md transition-all"
            >
              Concluir ({countdown}s)
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer Notice */}
      <div className="max-w-2xl mx-auto w-full text-center text-xs text-emerald-200 font-medium">
        Em caso de dúvidas ou dificuldades com a leitura, dirija-se diretamente a um dos nossos guichês.
      </div>
    </div>
  );
};
