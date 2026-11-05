import React, { useState } from 'react';
import { addDias, dataLonga, hoje } from '../firebase/hvaService';
import { Calendar, CheckCircle2, Clock, Hash, X } from 'lucide-react';

interface ModalRetornoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: { data?: string; obs?: string; sem?: boolean }) => void;
  pacienteNome?: string;
  ficha?: string;
  initialObs?: string;
}

export const ModalRetorno: React.FC<ModalRetornoProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pacienteNome,
  ficha,
  initialObs = '',
}) => {
  const [opcao, setOpcao] = useState<'3' | '7' | '15' | '30' | '60' | 'num_dias' | 'custom' | 'sem'>('15');
  const [diasDigitados, setDiasDigitados] = useState<number>(3);
  const [dataCustom, setDataCustom] = useState<string>(addDias(15));
  const [obs, setObs] = useState<string>(initialObs);

  if (!isOpen) return null;

  const handleSalvar = () => {
    if (opcao === 'sem') {
      onConfirm({ sem: true, obs });
    } else if (opcao === 'custom') {
      if (!dataCustom) return;
      onConfirm({ data: dataCustom, obs, sem: false });
    } else if (opcao === 'num_dias') {
      const d = Math.max(1, Number(diasDigitados) || 1);
      onConfirm({ data: addDias(d), obs, sem: false });
    } else {
      const dias = parseInt(opcao, 10);
      onConfirm({ data: addDias(dias), obs, sem: false });
    }
  };

  const dataCalculada =
    opcao === 'custom'
      ? dataCustom
      : opcao === 'num_dias'
      ? addDias(Math.max(1, Number(diasDigitados) || 1))
      : opcao === 'sem'
      ? ''
      : addDias(parseInt(opcao, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">Indicação de Retorno</h3>
              <p className="text-xs text-slate-500 font-semibold">
                {pacienteNome ? `${pacienteNome} • ` : ''}Ficha: {ficha || 'S/N'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Prazo sugerido para o retorno
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '3', label: '+3 dias', sub: 'Retorno rápido' },
                { id: '7', label: '+7 dias', sub: '1 semana' },
                { id: '15', label: '+15 dias', sub: '2 semanas' },
                { id: '30', label: '+30 dias', sub: '1 mês' },
                { id: '60', label: '+60 dias', sub: '2 meses' },
                { id: 'num_dias', label: 'Digitar dias', sub: 'Qualquer número' },
                { id: 'custom', label: 'Calendário', sub: 'Escolher data' },
                { id: 'sem', label: 'Sem retorno', sub: 'Alta médica' },
              ].map((item) => {
                const isSelected = opcao === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpcao(item.id as typeof opcao)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-medium'
                    }`}
                  >
                    <div className="text-sm font-black">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo para o clínico digitar qualquer número de dias que decidir */}
          {opcao === 'num_dias' && (
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-700" />
                <span>Em quantos dias o paciente deve retornar?</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={diasDigitados}
                  onChange={(e) => setDiasDigitados(parseInt(e.target.value, 10) || 1)}
                  className="w-32 px-3 py-2 border-2 border-emerald-300 rounded-xl text-lg font-black text-emerald-950 bg-white focus:outline-emerald-600"
                />
                <span className="text-sm font-bold text-emerald-800">
                  dias a partir de hoje
                </span>
              </div>
            </div>
          )}

          {opcao === 'custom' && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data do retorno
              </label>
              <input
                type="date"
                min={hoje()}
                value={dataCustom}
                onChange={(e) => setDataCustom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-bold"
              />
            </div>
          )}

          {/* Exibição da data calculada */}
          {opcao !== 'sem' && dataCalculada && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">Data estimada do retorno:</span>
              <span className="font-black text-emerald-800 text-sm">
                {dataLonga(dataCalculada)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Observações / Motivo do retorno (opcional)
            </label>
            <textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Reavaliação pós-antibiótico, retirada de pontos, conferir hemograma..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-emerald-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            Salvar e Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
