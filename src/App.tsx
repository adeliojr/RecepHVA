import React, { useEffect, useState } from 'react';
import {
  Appointment,
  DaySummary,
  HospitalSettings,
  ViewRoute,
} from './types/hva';
import {
  defaultDaySummary,
  defaultSettings,
  getFilaEspera,
  hoje,
  subscribeAppointments,
  subscribeDay,
  subscribeSettings,
} from './firebase/hvaService';
import { testConnection } from './firebase/config';
import { Navbar } from './components/Navbar';
import { InicioView } from './components/views/InicioView';
import { RecepcaoView } from './components/views/RecepcaoView';
import { CheckinView } from './components/views/CheckinView';
import { GuicheView } from './components/views/GuicheView';
import { PainelTvView } from './components/views/PainelTvView';
import { ClinicoView } from './components/views/ClinicoView';
import { AlertTriangle, WifiOff } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<ViewRoute>('inicio');
  const [online, setOnline] = useState<boolean>(true);
  const [settings, setSettings] = useState<HospitalSettings>(defaultSettings);
  const [daySummary, setDaySummary] = useState<DaySummary>(defaultDaySummary(hoje()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Parse hash route on initial load and handle hash change
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as ViewRoute;
      const validRoutes: ViewRoute[] = [
        'inicio',
        'recepcao',
        'checkin',
        'guiche1',
        'guiche2',
        'guiche3',
        'guiche4',
        'painel',
        'clinico',
      ];
      if (validRoutes.includes(hash)) {
        setCurrentRoute(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleRouteChange = (route: ViewRoute) => {
    setCurrentRoute(route);
    window.location.hash = route;
  };

  // Test connection & setup subscriptions
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    async function initFirebase() {
      const isConnected = await testConnection();
      setOnline(isConnected);

      // Subscribe to settings
      const unsubSettings = subscribeSettings((s) => {
        setSettings(s);
      });
      unsubs.push(unsubSettings);

      // Subscribe to today's summary
      const unsubDay = subscribeDay(hoje(), (day) => {
        setDaySummary(day);
      });
      unsubs.push(unsubDay);

      // Subscribe to appointments
      const unsubAppts = subscribeAppointments((list) => {
        setAppointments(list);
        setLoadingInitial(false);
      });
      unsubs.push(unsubAppts);
    }

    initFirebase();

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  const filaCount = getFilaEspera(appointments).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-emerald-200 selection:text-emerald-950">
      {/* Top Navbar */}
      <Navbar
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        online={online}
        hospitalName={settings.nomeHospital}
        filaCount={filaCount}
      />

      {/* Offline Alert Banner */}
      {!online && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm">
          <WifiOff className="w-4 h-4" />
          <span>
            Atenção: Sem conexão direta com o Firebase. Verifique sua conexão para manter as senhas sincronizadas.
          </span>
        </div>
      )}

      {/* Route Views */}
      <main className="flex-1 flex flex-col">
        {currentRoute === 'inicio' && (
          <InicioView
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
            onRouteChange={handleRouteChange}
          />
        )}

        {currentRoute === 'recepcao' && (
          <RecepcaoView
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'checkin' && (
          <CheckinView
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'guiche1' && (
          <GuicheView
            guicheNum={1}
            onSelectGuiche={(n) => handleRouteChange(`guiche${n}` as ViewRoute)}
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'guiche2' && (
          <GuicheView
            guicheNum={2}
            onSelectGuiche={(n) => handleRouteChange(`guiche${n}` as ViewRoute)}
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'guiche3' && (
          <GuicheView
            guicheNum={3}
            onSelectGuiche={(n) => handleRouteChange(`guiche${n}` as ViewRoute)}
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'guiche4' && (
          <GuicheView
            guicheNum={4}
            onSelectGuiche={(n) => handleRouteChange(`guiche${n}` as ViewRoute)}
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'painel' && (
          <PainelTvView
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}

        {currentRoute === 'clinico' && (
          <ClinicoView
            settings={settings}
            daySummary={daySummary}
            appointments={appointments}
          />
        )}
      </main>
    </div>
  );
}
