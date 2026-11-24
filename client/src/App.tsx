import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { ReadingsPage } from './pages/ReadingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { TargetsPage } from './pages/TargetsPage';
import { Header } from './components/layout/Header';
import { BottomNav, type NavTab } from './components/layout/BottomNav';
import { Shell } from './components/layout/Shell';
import { ClinicalTargetsModal } from './components/common/ClinicalTargetsModal';
import { Droplet } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('readings');
  const [clinicalModalOpen, setClinicalModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center animate-pulse mb-3">
          <Droplet className="w-6 h-6 fill-white/20 stroke-[2.2]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Loading Sweety...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onOpenClinicalInfo={() => setClinicalModalOpen(true)} />

      <Shell>
        {activeTab === 'readings' && <ReadingsPage />}
        {activeTab === 'reports' && (
          <ReportsPage onNavigateToReadings={() => setActiveTab('readings')} />
        )}
        {activeTab === 'clinical' && <TargetsPage />}
      </Shell>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      <ClinicalTargetsModal
        isOpen={clinicalModalOpen}
        onClose={() => setClinicalModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
