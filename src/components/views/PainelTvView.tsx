import React, { useEffect, useRef, useState } from 'react';
import { Appointment, DaySummary, HospitalSettings } from '../../types/hva';
import { anunciarSenhaPainel, tocarSineta } from '../../utils/audio';
import { getFilaEspera } from '../../firebase/hvaService';
import { Clock, History, Maximize2, Minimize2, Monitor, Volume2, VolumeX } from 'lucide-react';

interface PainelTvViewProps {
  settings: HospitalSettings;
  daySummary: DaySummary;
  appointments: Appointment[];
}

export const PainelTvView: React.FC<PainelTvViewProps> = ({
  settings,
  daySummary,
  appointments,
}) => {
  const [audioAtivado, setAudioAtivado] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [flashingGuiche, setFlashingGuiche] = useState<number | null>(null);

  // Track the last handled sequence number to trigger speech only on new calls
  const lastSeqRef = useRef<number>(daySummary.seq || 0);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for new calls in daySummary
  useEffect(() => {
    const currentSeq = daySummary.seq || 0;
    if (currentSeq > lastSeqRef.current) {
      lastSeqRef.current = currentSeq;
      const latestCall = daySummary.chamadas?.[0];
      if (latestCall) {
        setFlashingGuiche(latestCall.guiche);

        if (audioAtivado) {
          anunciarSenhaPainel(latestCall.senha, latestCall.guiche);
        }

        // Flash for 4.5 seconds
        setTimeout(() => {
          setFlashingGuiche(null);
        }, 4500);
      }
    } else if (currentSeq === 0) {
      lastSeqRef.current = 0;
    }
  }, [daySummary.seq, audioAtivado]);

  const toggleAudio = () => {
    // Play test chime to unlock audio context in browser
    tocarSineta();
    setAudioAtivado(true);
  };

  const fila = getFilaEspera(appointments);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0b2b25] text-white p-4 sm:p-6 select-none flex flex-col justify-between animate-in fade-in duration-300">
      {/* Audio Activation Banner if disabled */}
      {!audioAtivado && (
        <div
          onClick={toggleAudio}
          className="mb-4 bg-emerald-600 hover:bg-emerald-500 cursor-pointer text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between font-black text-sm sm:text-base border-2 border-emerald-300 transition-all"
        >
          <div className="flex items-center gap-3">
            <Volume2 className="w-6 h-6 animate-pulse text-amber-300" />
            <span>CLIQUE AQUI PARA ATIVAR O SOM DO PAINEL (SINETAS E VOZ DAS SENHAS)</span>
          </div>
          <span className="bg-white text-emerald-950 px-3 py-1 rounded-xl text-xs font-black">
            Ativar Áudio
          </span>
        </div>
      )}

      {/* Top TV Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-emerald-900/60 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐾</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wide text-emerald-100">
              {settings.nomeHospital}
            </h1>
            <p className="text-xs text-emerald-300/80 uppercase tracking-widest font-bold">
              Painel de Atendimento da Sala de Espera
            </p>
          </div>
        </div>

        {/* Digital Clock */}
        <div className="text-right">
          <div className="text-2xl sm:text-4xl font-black font-mono tracking-wider text-emerald-100">
            {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">
            {horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Main Grid: 4 Guichê Displays + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
        {/* 4 Guichê Boxes (Left 8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((num) => {
            const g = daySummary.guiches.find((gx) => gx.n === num);
            const a = g?.id ? appointments.find((x) => x.id === g.id) : null;
            const isFlashing = flashingGuiche === num;

            return (
              <div
                key={num}
                className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center transition-all duration-300 relative border-4 ${
                  isFlashing
                    ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_50px_rgba(251,191,36,0.8)] scale-[1.02]'
                    : g?.estado === 'chamando'
                    ? 'bg-[#0d7a65] border-emerald-400 shadow-xl'
                    : g?.estado === 'atendendo'
                    ? 'bg-[#12403a] border-emerald-600/40 shadow-md'
                    : 'bg-[#0f342e] border-emerald-950/60 opacity-80'
                }`}
              >
                {/* Station Label */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-base sm:text-xl font-black tracking-wider uppercase ${
                      isFlashing ? 'text-slate-950' : 'text-emerald-200'
                    }`}
                  >
                    Guichê {num}
                  </span>
                  <span
                    className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                      isFlashing
                        ? 'bg-slate-950 text-white'
                        : g?.estado === 'chamando'
                        ? 'bg-amber-400 text-amber-950 animate-pulse'
                        : g?.estado === 'atendendo'
                        ? 'bg-emerald-900 text-emerald-200'
                        : 'bg-emerald-950 text-emerald-400'
                    }`}
                  >
                    {isFlashing ? 'CHAMANDO AGORA' : g?.estado || 'livre'}
                  </span>
                </div>

                {/* Giant Ticket Number */}
                <div className="my-6">
                  {a?.senha ? (
                    <div
                      className={`text-6xl sm:text-8xl font-black tracking-widest font-mono ${
                        isFlashing ? 'text-slate-950' : 'text-white'
                      }`}
                    >
                      {a.senha}
                    </div>
                  ) : (
                    <div className="text-4xl sm:text-5xl font-black text-emerald-800/60 tracking-widest font-mono">
                      {g?.estado === 'pausa' ? 'PAUSA' : '— — —'}
                    </div>
                  )}
                </div>

                {/* Patient / Details */}
                <div className="min-h-[40px] flex flex-col items-center justify-center">
                  {a ? (
                    <>
                      <div
                        className={`text-sm sm:text-base font-extrabold ${
                          isFlashing ? 'text-slate-950' : 'text-emerald-100'
                        }`}
                      >
                        {a.pet ? `Pet: ${a.pet}` : `Ficha ${a.ficha}`}
                      </div>
                      <div
                        className={`text-xs ${
                          isFlashing ? 'text-slate-800' : 'text-emerald-300/80'
                        }`}
                      >
                        {a.clinico ? `Dr(a). ${a.clinico}` : 'Recepção'}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-500/60 font-semibold">
                      Aguardando próxima chamada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar: Últimas Chamadas + Próximos da Fila (Right 4 cols) */}
        <div className="lg:col-span-4 bg-[#12403a] rounded-3xl p-5 sm:p-6 border border-emerald-600/30 flex flex-col justify-between space-y-6">
          {/* History of Recent Calls */}
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-emerald-400" />
              Últimas Chamadas
            </h2>

            {daySummary.chamadas && daySummary.chamadas.length > 0 ? (
              <div className="space-y-2">
                {daySummary.chamadas.slice(0, 5).map((c, i) => (
                  <div
                    key={`${c.ts}-${i}`}
                    className="flex items-center justify-between py-2 border-b border-emerald-800/60 font-bold"
                  >
                    <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-wider">
                      {c.senha}
                    </span>
                    <span className="text-xs text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg">
                      Guichê {c.guiche}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-400/60 py-4">Nenhuma chamada registrada hoje.</p>
            )}
          </div>

          {/* Upcoming Queue Tickets */}
          <div className="pt-4 border-t border-emerald-800/60">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 mb-3">
              Próximos na Fila ({fila.length})
            </h2>

            {fila.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fila.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    className="bg-emerald-950/90 text-emerald-200 border border-emerald-700/50 px-3 py-1.5 rounded-xl text-base font-black font-mono"
                  >
                    {p.senha || '—'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-400/60">Fila de espera vazia no momento.</p>
            )}
          </div>

          {/* Bottom audio indicator */}
          <div className="pt-2 text-center text-xs text-emerald-400/80 flex items-center justify-center gap-2">
            {audioAtivado ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-300" />
                <span>Áudio e chamada por voz habilitados</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-amber-400" />
                <span>Áudio em espera (clique no aviso superior)</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
