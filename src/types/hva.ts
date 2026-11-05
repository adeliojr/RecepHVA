export type TipoAtendimento =
  | 'consulta'
  | 'retorno'
  | 'exames'
  | 'radiografia'
  | 'ultrassom'
  | 'emergencia'
  | 'outros';

export type StatusAtendimento =
  | 'agendado'
  | 'aguardando'
  | 'retorno_aguardando'
  | 'chamado'
  | 'atendimento_recepcao'
  | 'encaminhado'
  | 'em_consulta'
  | 'finalizado'
  | 'nao_compareceu'
  | 'cancelado';

export interface TipoInfo {
  label: string;
  p: string;
  prio: number;
}

export const TIPOS: Record<TipoAtendimento, TipoInfo> = {
  consulta: { label: 'Consulta', p: 'C', prio: 1 },
  retorno: { label: 'Retorno', p: 'R', prio: 1 },
  exames: { label: 'Coleta de exames', p: 'L', prio: 1 },
  radiografia: { label: 'Radiografia', p: 'X', prio: 1 },
  ultrassom: { label: 'Ultrassom', p: 'U', prio: 1 },
  emergencia: { label: 'Emergência', p: 'E', prio: 0 },
  outros: { label: 'Outros', p: 'O', prio: 1 },
};

export const FORM_TIPOS: TipoAtendimento[] = [
  'consulta',
  'retorno',
  'exames',
  'radiografia',
  'ultrassom',
  'outros',
];

export const STATUS_LABELS: Record<StatusAtendimento, string> = {
  agendado: 'Agendado',
  aguardando: 'Aguardando',
  retorno_aguardando: 'Agendando retorno',
  chamado: 'Chamado',
  atendimento_recepcao: 'Na recepção',
  encaminhado: 'Liberado p/ clínico',
  em_consulta: 'Em atendimento',
  finalizado: 'Finalizado',
  nao_compareceu: 'Não compareceu',
  cancelado: 'Cancelado',
};

export const ATIVOS: StatusAtendimento[] = [
  'aguardando',
  'chamado',
  'atendimento_recepcao',
  'encaminhado',
  'em_consulta',
  'retorno_aguardando',
];

export interface Appointment {
  id: string;
  token: string;
  data: string; // YYYY-MM-DD
  horario?: string; // HH:mm
  ficha: string;
  tipo: TipoAtendimento;
  clinico: string;
  pet?: string;
  tutor?: string;
  status: StatusAtendimento;
  senha?: string | null;
  guiche?: number | null;
  origem: 'agenda' | 'balcao' | 'retorno';
  pulos: number;
  filaDesde?: number | null;
  checkinAt?: number | null;
  encaminhadoEm?: number | null;
  consultaEm?: number | null;
  finalizadoEm?: number | null;
  retornoSolicitado?: boolean;
  retornoSolicitadoEm?: number | null;
  retornoVia?: 'clinico' | 'tutor';
  retornoPara?: string | null; // YYYY-MM-DD
  retornoObs?: string;
  retornoSem?: boolean;
  retornoAgendado?: { data: string; apptId: string } | null;
  retornoDe?: string | null;
  retornoIndicadoEm?: number | null;
}

export type GuicheEstado = 'livre' | 'chamando' | 'atendendo' | 'pausa';

export interface GuicheState {
  n: number;
  estado: GuicheEstado;
  id: string | null;
}

export interface ChamadaRecord {
  seq: number;
  senha: string;
  guiche: number;
  ts: number;
}

export interface DaySummary {
  date: string;
  seq: number;
  cont: Record<string, number>;
  guiches: GuicheState[];
  chamadas: ChamadaRecord[];
  updatedAt?: string;
}

export interface HospitalSettings {
  nomeHospital: string;
  clinicos: string[];
  updatedAt?: string;
}

export type ViewRoute =
  | 'inicio'
  | 'recepcao'
  | 'checkin'
  | 'guiche1'
  | 'guiche2'
  | 'guiche3'
  | 'guiche4'
  | 'painel'
  | 'clinico';
