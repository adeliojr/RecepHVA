import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Appointment, DaySummary, GuicheState, HospitalSettings, TIPOS, TipoAtendimento } from '../types/hva';
import { db, handleFirestoreError, OperationType } from './config';

const PAD = (n: number, l = 2) => String(n).padStart(l, '0');
export const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;

export const hoje = () => ymd(new Date());
export const amanha = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return ymd(d);
};

export const brData = (s: string) => {
  if (!s || !s.includes('-')) return s;
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
};

export const dataLonga = (s: string) => {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  const sem = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${brData(s)} (${sem})`;
};

export const addDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const rid = (n = 8) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) =>
    'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]
  ).join('');

export const novoToken = (data: string) =>
  data.replace(/-/g, '') + rid(8);

export const defaultGuiches = (): GuicheState[] => [
  { n: 1, estado: 'livre', id: null },
  { n: 2, estado: 'livre', id: null },
  { n: 3, estado: 'livre', id: null },
  { n: 4, estado: 'livre', id: null },
];

export const defaultDaySummary = (date: string): DaySummary => ({
  date,
  seq: 0,
  cont: {},
  guiches: defaultGuiches(),
  chamadas: [],
});

export const defaultSettings: HospitalSettings = {
  nomeHospital: 'HVA – Hospital Veterinário Araújo',
  clinicos: ['Dr. Adélio', 'Dra. Maria', 'Dr. Carlos'],
};

// ==================== SUBSCRIPTIONS ====================

export function subscribeSettings(
  callback: (settings: HospitalSettings) => void
): () => void {
  const docRef = doc(db, 'settings', 'hospital');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as HospitalSettings);
      } else {
        // Initialize default settings if not exists
        setDoc(docRef, defaultSettings).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, 'settings/hospital')
        );
        callback(defaultSettings);
      }
    },
    (err) => {
      console.warn('Settings subscription fallback:', err.message);
      callback(defaultSettings);
    }
  );
}

export function subscribeDay(
  date: string,
  callback: (day: DaySummary) => void
): () => void {
  const docRef = doc(db, 'days', date);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DaySummary;
        // Guarantee 4 guiches
        const gs = [1, 2, 3, 4].map((n) => {
          const found = data.guiches?.find((g) => g.n === n);
          return found || { n, estado: 'livre', id: null };
        });
        callback({
          date,
          seq: data.seq || 0,
          cont: data.cont || {},
          guiches: gs as GuicheState[],
          chamadas: data.chamadas || [],
        });
      } else {
        const init = defaultDaySummary(date);
        setDoc(docRef, init).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `days/${date}`)
        );
        callback(init);
      }
    },
    (err) => {
      console.warn(`Day ${date} subscription fallback:`, err.message);
      callback(defaultDaySummary(date));
    }
  );
}

export function subscribeAppointments(
  callback: (appointments: Appointment[]) => void
): () => void {
  const colRef = collection(db, 'appointments');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Appointment);
      });
      callback(list);
    },
    (err) => {
      console.warn('Appointments subscription fallback:', err.message);
      callback([]);
    }
  );
}

// ==================== HELPERS ====================

export function getFilaEspera(appts: Appointment[], date = hoje()): Appointment[] {
  return appts
    .filter(
      (a) =>
        a.data === date &&
        (a.status === 'aguardando' || a.status === 'retorno_aguardando')
    )
    .sort((a, b) => {
      const prioDiff = TIPOS[a.tipo].prio - TIPOS[b.tipo].prio;
      if (prioDiff !== 0) return prioDiff;
      return (a.filaDesde || 0) - (b.filaDesde || 0);
    });
}

function proximaSenha(day: DaySummary, tipo: TipoAtendimento): { senha: string; cont: Record<string, number> } {
  const prefix = TIPOS[tipo].p;
  const currentCount = day.cont[prefix] || 0;
  const newCount = currentCount + 1;
  const newCont = { ...day.cont, [prefix]: newCount };
  const senha = `${prefix}${PAD(newCount, 3)}`;
  return { senha, cont: newCont };
}

// ==================== OPERATIONS ====================

export async function agendarAtendimento(params: {
  ficha: string;
  clinico: string;
  tipo: TipoAtendimento;
  data: string;
  pet?: string;
  tutor?: string;
}): Promise<{ appt: Appointment; isNovo: boolean }> {
  const ficha = (params.ficha || '').replace(/\s+/g, '');
  if (!ficha) throw new Error('Informe o número da ficha');
  if (!params.clinico) throw new Error('Informe o clínico responsável');

  const id = rid(10);
  const token = novoToken(params.data);
  const appt: Appointment = {
    id,
    token,
    ficha,
    tipo: params.tipo,
    clinico: params.clinico,
    data: params.data,
    pet: params.pet || '',
    tutor: params.tutor || '',
    status: 'agendado',
    senha: null,
    guiche: null,
    origem: 'agenda',
    pulos: 0,
  };

  try {
    await setDoc(doc(db, 'appointments', id), appt);
    return { appt, isNovo: true };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `appointments/${id}`);
  }
}

export async function checkinComQr(
  rawToken: string,
  daySummary: DaySummary,
  appts: Appointment[],
  ignorarData = false
): Promise<{ appt: Appointment; jaFeito: boolean; frente: number }> {
  const token = (rawToken || '')
    .trim()
    .replace(/^.*[#?&]token=/, '')
    .split(/[#?&\s]/)[0];

  const a = appts.find(
    (x) =>
      x.token === token ||
      x.token.toLowerCase() === token.toLowerCase() ||
      x.id === token
  );
  if (!a) {
    const match = /^(\d{4})(\d{2})(\d{2})/.exec(token || '');
    if (match && `${match[1]}-${match[2]}-${match[3]}` !== hoje() && !ignorarData) {
      throw new Error(`Este QR code é para o dia ${match[3]}/${match[2]}. Procure a recepção.`);
    }
    throw new Error(`QR code (${token.slice(0, 12)}...) não reconhecido. Procure a recepção.`);
  }

  if (a.status === 'cancelado') {
    throw new Error('Este atendimento foi cancelado. Procure a recepção.');
  }

  const fila = getFilaEspera(appts);

  if (a.status !== 'agendado') {
    if (['aguardando', 'chamado', 'atendimento_recepcao', 'encaminhado', 'em_consulta', 'retorno_aguardando'].includes(a.status)) {
      const idx = fila.findIndex((x) => x.id === a.id);
      return { appt: a, jaFeito: true, frente: idx >= 0 ? idx : 0 };
    }
    throw new Error('Este QR code já foi utilizado. Para agendar retorno, toque em "Agendar retorno".');
  }

  if (a.data !== hoje() && !ignorarData) {
    throw new Error(`Este QR code é para o dia ${brData(a.data)}. Procure a recepção.`);
  }

  const now = Date.now();
  const { senha, cont } = proximaSenha(daySummary, a.tipo);

  const updated: Appointment = {
    ...a,
    status: 'aguardando',
    senha,
    checkinAt: now,
    filaDesde: now,
    data: hoje(),
  };

  try {
    await setDoc(doc(db, 'appointments', a.id), updated);
    await updateDoc(doc(db, 'days', hoje()), { cont });
    return { appt: updated, jaFeito: false, frente: fila.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function checkinManualBalcao(
  ficha: string,
  tipo: TipoAtendimento,
  daySummary: DaySummary,
  appts: Appointment[]
): Promise<{ appt: Appointment; jaFeito: boolean; frente: number }> {
  const f = ficha.trim().replace(/\s+/g, '');
  if (!f && tipo !== 'emergencia') {
    throw new Error('Informe o número da ficha');
  }

  const fila = getFilaEspera(appts);
  const now = Date.now();

  // If already scheduled for today
  if (f) {
    const agendado = appts.find(
      (a) => a.ficha === f && a.data === hoje() && a.status === 'agendado' && a.tipo === tipo
    );
    if (agendado) {
      const { senha, cont } = proximaSenha(daySummary, tipo);
      const updated: Appointment = {
        ...agendado,
        status: 'aguardando',
        senha,
        checkinAt: now,
        filaDesde: now,
      };
      await setDoc(doc(db, 'appointments', agendado.id), updated);
      await updateDoc(doc(db, 'days', hoje()), { cont });
      return { appt: updated, jaFeito: false, frente: fila.length };
    }
  }

  const id = rid(10);
  const { senha, cont } = proximaSenha(daySummary, tipo);
  const novo: Appointment = {
    id,
    token: novoToken(hoje()),
    ficha: f || (tipo === 'emergencia' ? 'EMERG' : 'S/ficha'),
    tipo,
    clinico: '',
    data: hoje(),
    pet: '',
    tutor: '',
    status: 'aguardando',
    senha,
    origem: 'balcao',
    pulos: 0,
    checkinAt: now,
    filaDesde: now,
  };

  try {
    await setDoc(doc(db, 'appointments', id), novo);
    await updateDoc(doc(db, 'days', hoje()), { cont });
    return { appt: novo, jaFeito: false, frente: fila.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `appointments/${id}`);
  }
}

export async function solicitarRetornoPorSenha(
  letra: string,
  num: string,
  daySummary: DaySummary,
  appts: Appointment[]
): Promise<{ appt: Appointment; jaFeito: boolean; frente: number }> {
  const senha = `${letra.toUpperCase()}${PAD(Number(num), 3)}`;
  const a = appts.find((x) => x.senha === senha && x.data === hoje());

  if (!a) {
    throw new Error(`Senha ${senha} não encontrada hoje. Confira a letra e o número.`);
  }

  if (a.retornoAgendado) {
    throw new Error(`O retorno desta senha já foi agendado para ${brData(a.retornoAgendado.data)}.`);
  }

  const fila = getFilaEspera(appts);
  if (a.status === 'retorno_aguardando') {
    const idx = fila.findIndex((x) => x.id === a.id);
    return { appt: a, jaFeito: true, frente: Math.max(0, idx) };
  }

  if (!['finalizado', 'em_consulta'].includes(a.status)) {
    throw new Error('O retorno é marcado depois do atendimento com o clínico. Aguarde ser chamado.');
  }

  const now = Date.now();
  const updated: Appointment = {
    ...a,
    retornoSolicitado: true,
    retornoSolicitadoEm: now,
    status: 'retorno_aguardando',
    filaDesde: now,
    pulos: 0,
    guiche: null,
    finalizadoEm: a.status === 'em_consulta' ? now : a.finalizadoEm,
  };

  try {
    await setDoc(doc(db, 'appointments', a.id), updated);
    return { appt: updated, jaFeito: false, frente: fila.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function chamarProximaSenha(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g) throw new Error(`Guichê ${guicheNum} não encontrado`);
  if (g.estado === 'pausa') throw new Error('Guichê está em pausa');
  if (g.estado !== 'livre') throw new Error('Finalize o atendimento atual antes de chamar outra senha');

  const fila = getFilaEspera(appts);
  const next = fila[0];
  if (!next) throw new Error('Fila de espera vazia');

  const now = Date.now();
  const nextSeq = (daySummary.seq || 0) + 1;
  const newChamada = {
    seq: nextSeq,
    senha: next.senha || '—',
    guiche: guicheNum,
    ts: now,
  };

  const newChamadas = [newChamada, ...(daySummary.chamadas || [])].slice(0, 12);
  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'chamando' as const, id: next.id } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', next.id), {
      status: 'chamado',
      guiche: guicheNum,
    });
    await updateDoc(doc(db, 'days', hoje()), {
      seq: nextSeq,
      chamadas: newChamadas,
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `days/${hoje()}`);
  }
}

export async function rechamarSenha(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id || g.estado !== 'chamando') return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  const nextSeq = (daySummary.seq || 0) + 1;
  const newChamada = {
    seq: nextSeq,
    senha: a.senha || '—',
    guiche: guicheNum,
    ts: Date.now(),
  };
  const newChamadas = [newChamada, ...(daySummary.chamadas || [])].slice(0, 12);

  try {
    await updateDoc(doc(db, 'days', hoje()), {
      seq: nextSeq,
      chamadas: newChamadas,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `days/${hoje()}`);
  }
}

export async function iniciarAtendimentoGuiche(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'atendendo' as const } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', a.id), {
      status: 'atendimento_recepcao',
    });
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `days/${hoje()}`);
  }
}

export async function encaminharAoClinico(
  guicheNum: number,
  clinico: string,
  extra: { ficha?: string; pet?: string; tutor?: string },
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  if (!clinico && !a.clinico) {
    throw new Error('Escolha o clínico responsável');
  }

  const patch: Partial<Appointment> = {
    status: 'encaminhado',
    encaminhadoEm: Date.now(),
    guiche: null,
    clinico: clinico || a.clinico,
  };

  if (extra.ficha?.trim()) patch.ficha = extra.ficha.trim().replace(/\s+/g, '');
  if (extra.pet?.trim()) patch.pet = extra.pet.trim();
  if (extra.tutor?.trim()) patch.tutor = extra.tutor.trim();

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'livre' as const, id: null } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', a.id), patch);
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function pularSenha(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  const isRetorno = a.status === 'retorno_aguardando' || !!a.retornoSolicitado;
  const pulos = (a.pulos || 0) + 1;
  const status = pulos >= 3
    ? (isRetorno ? 'finalizado' : 'nao_compareceu')
    : (isRetorno ? 'retorno_aguardando' : 'aguardando');

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'livre' as const, id: null } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', a.id), {
      status,
      pulos,
      guiche: null,
      filaDesde: Date.now(),
    });
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function marcarNaoCompareceu(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'livre' as const, id: null } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', a.id), {
      status: 'nao_compareceu',
      guiche: null,
    });
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function finalizarGuiche(
  guicheNum: number,
  daySummary: DaySummary,
  appts: Appointment[]
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) return;
  const a = appts.find((x) => x.id === g.id);
  if (!a) return;

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'livre' as const, id: null } : gx
  );

  try {
    await updateDoc(doc(db, 'appointments', a.id), {
      status: 'finalizado',
      finalizadoEm: Date.now(),
      guiche: null,
    });
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
  }
}

export async function agendarRetornoNoGuiche(
  guicheNum: number,
  targetDate: string,
  daySummary: DaySummary,
  appts: Appointment[]
): Promise<Appointment> {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g || !g.id) throw new Error('Não há atendimento selecionado');
  const a = appts.find((x) => x.id === g.id);
  if (!a) throw new Error('Atendimento não encontrado');

  const novoId = rid(10);
  const novo: Appointment = {
    id: novoId,
    token: novoToken(targetDate),
    ficha: a.ficha,
    tipo: 'retorno',
    clinico: a.clinico,
    data: targetDate,
    pet: a.pet || '',
    tutor: a.tutor || '',
    status: 'agendado',
    senha: null,
    guiche: null,
    origem: 'retorno',
    retornoDe: a.id,
    pulos: 0,
  };

  const newGuiches = daySummary.guiches.map((gx) =>
    gx.n === guicheNum ? { ...gx, estado: 'livre' as const, id: null } : gx
  );

  try {
    await setDoc(doc(db, 'appointments', novoId), novo);
    await updateDoc(doc(db, 'appointments', a.id), {
      status: 'finalizado',
      retornoAgendado: { data: targetDate, apptId: novoId },
      guiche: null,
    });
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
    return novo;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `appointments/${novoId}`);
  }
}

export async function togglePausaGuiche(
  guicheNum: number,
  colocarPausa: boolean,
  daySummary: DaySummary
) {
  const g = daySummary.guiches.find((x) => x.n === guicheNum);
  if (!g) return;

  if (colocarPausa && g.estado !== 'livre') {
    throw new Error('Finalize o atendimento antes de pausar');
  }

  const newGuiches = daySummary.guiches.map((gx) => {
    if (gx.n === guicheNum) {
      return {
        ...gx,
        estado: colocarPausa ? ('pausa' as const) : ('livre' as const),
      };
    }
    return gx;
  });

  try {
    await updateDoc(doc(db, 'days', hoje()), {
      guiches: newGuiches,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `days/${hoje()}`);
  }
}

export async function clinicoChamaPaciente(id: string) {
  try {
    await updateDoc(doc(db, 'appointments', id), {
      status: 'em_consulta',
      consultaEm: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
  }
}

export async function clinicoFinalizaConsulta(
  id: string,
  retorno?: { data?: string; obs?: string; sem?: boolean }
) {
  const patch: Partial<Appointment> = {
    status: 'finalizado',
    finalizadoEm: Date.now(),
  };

  if (retorno) {
    patch.retornoIndicadoEm = Date.now();
    patch.retornoObs = retorno.obs || '';
    if (retorno.sem) {
      patch.retornoSem = true;
      patch.retornoPara = null;
    } else if (retorno.data) {
      patch.retornoSem = false;
      patch.retornoPara = retorno.data;
      // Put pet owner back into queue with the same ticket number to schedule return
      patch.retornoSolicitado = true;
      patch.retornoSolicitadoEm = Date.now();
      patch.retornoVia = 'clinico';
      patch.status = 'retorno_aguardando';
      patch.filaDesde = Date.now();
      patch.pulos = 0;
      patch.guiche = null;
    }
  }

  try {
    await updateDoc(doc(db, 'appointments', id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
  }
}

export async function clinicoIndicaRetorno(
  id: string,
  retorno: { data?: string; obs?: string; sem?: boolean }
) {
  const patch: Partial<Appointment> = {
    retornoIndicadoEm: Date.now(),
    retornoObs: retorno.obs || '',
  };

  if (retorno.sem) {
    patch.retornoSem = true;
    patch.retornoPara = null;
  } else if (retorno.data) {
    patch.retornoSem = false;
    patch.retornoPara = retorno.data;
  }

  try {
    await updateDoc(doc(db, 'appointments', id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
  }
}

export async function devolverParaEspera(id: string) {
  try {
    await updateDoc(doc(db, 'appointments', id), {
      status: 'encaminhado',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
  }
}

export async function adicionarClinico(nome: string, current: string[]) {
  const trimmed = nome.trim();
  if (!trimmed || current.includes(trimmed)) return;
  const updated = [...current, trimmed];
  try {
    await updateDoc(doc(db, 'settings', 'hospital'), { clinicos: updated });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/hospital');
  }
}

export async function removerClinico(nome: string, current: string[]) {
  if (current.length <= 1) {
    throw new Error('Mantenha ao menos um clínico cadastrado');
  }
  const updated = current.filter((c) => c !== nome);
  try {
    await updateDoc(doc(db, 'settings', 'hospital'), { clinicos: updated });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/hospital');
  }
}

export async function semearDadosTeste() {
  const ex: [string, TipoAtendimento, string, string][] = [
    ['48213', 'consulta', 'Thor', 'Dr. Adélio'],
    ['48377', 'retorno', 'Mel', 'Dra. Maria'],
    ['48420', 'exames', 'Bob', 'Dr. Adélio'],
    ['48455', 'radiografia', 'Luna', 'Dra. Maria'],
    ['48490', 'ultrassom', 'Nina', 'Dr. Carlos'],
  ];

  for (const [ficha, tipo, pet, clinico] of ex) {
    const id = rid(10);
    const appt: Appointment = {
      id,
      token: novoToken(hoje()),
      ficha,
      tipo,
      clinico,
      data: hoje(),
      pet,
      tutor: `Tutor de ${pet}`,
      status: 'agendado',
      senha: null,
      guiche: null,
      origem: 'agenda',
      pulos: 0,
    };
    await setDoc(doc(db, 'appointments', id), appt);
  }
}

export async function zerarDadosTeste() {
  const snap = await getDocs(collection(db, 'appointments'));
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'appointments', d.id));
  }
  await setDoc(doc(db, 'days', hoje()), defaultDaySummary(hoje()));
}
