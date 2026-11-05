import React, { useState } from 'react';
import { addDias, hoje } from '../firebase/hvaService';
import { Calendar, CheckCircle2, Clock, X } from 'lucide-react';

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
  const [opcao, setOpcao] = useState<'7' | '15' | '30' | '60' | 'custom' | 'sem'>('15');
  const [dataCustom, setDataCustom] = useState<string>(addDias(15));
  const [obs, setObs] = useState<string>(initialObs);

  if (!isOpen) return null;

  const handleSalvar = () => {
    if (opcao === 'sem') {
      onConfirm({ sem: true, obs });
    } else if (opcao === 'custom') {
      if (!dataCustom) return;
      onConfirm({ data: dataCustom, obs, sem: false });
    } else {
      const dias = parseInt(opcao, 10);
      onConfirm({ data: addDias(dias), obs, sem: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Indicação de Retorno</h3>
              <p className="text-xs text-slate-500">
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
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Prazo sugerido
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '7', label: '+7 dias', sub: '1 semana' },
                { id: '15', label: '+15 dias', sub: '2 semanas' },
                { id: '30', label: '+30 dias', sub: '1 mês' },
                { id: '60', label: '+60 dias', sub: '2 meses' },
                { id: 'custom', label: 'Outra data', sub: 'Escolher no calendário' },
                { id: 'sem', label: 'Sem retorno', sub: 'Alta definitiva' },
              ].map((item) => {
                const isSelected = opcao === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpcao(item.id as typeof opcao)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {opcao === 'custom' && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data do retorno
              </label>
              <input
                type="date"
                min={hoje()}
                value={dataCustom}
                onChange={(e) => setDataCustom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Observações / Motivo do retorno (opcional)
            </label>
            <textarea
              rows={3}
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
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Salvar e Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
