/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { EduAlumnoView } from './components/EduAlumnoView.tsx';
import { EduDocenteView } from './components/EduDocenteView.tsx';
import { EduGestionView } from './components/EduGestionView.tsx';
import { EduOrganizaView } from './components/EduOrganizaView.tsx';
import { Footer } from './components/Footer.tsx';
import { HomeView } from './components/HomeView.tsx';
import { Navbar, type AppView } from './components/Navbar.tsx';
import { AuthProvider } from './context/AuthContext.tsx';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleNavigateHome = (sectionId?: string) => {
    setCurrentView('home');
    if (sectionId) {
      requestAnimationFrame(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenTutor = () => {
    setCurrentView('edu-alumno');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDocente = () => {
    setCurrentView('edu-docente');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenOrganiza = () => {
    setCurrentView('edu-organiza');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenGestion = () => {
    setCurrentView('edu-gestion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar
          currentView={currentView}
          onNavigateHome={handleNavigateHome}
          onOpenTutor={handleOpenTutor}
          onOpenDocente={handleOpenDocente}
          onOpenOrganiza={handleOpenOrganiza}
          onOpenGestion={handleOpenGestion}
          onOpenAuth={() => setAuthModalOpen(true)}
        />

        <div className="flex-1">
          {currentView === 'home' && (
            <HomeView
              onOpenTutor={handleOpenTutor}
              onOpenDocente={handleOpenDocente}
              onOpenOrganiza={handleOpenOrganiza}
              onOpenGestion={handleOpenGestion}
            />
          )}
          {currentView === 'edu-alumno' && <EduAlumnoView />}
          {currentView === 'edu-docente' && <EduDocenteView />}
          {currentView === 'edu-organiza' && (
            <EduOrganizaView onOpenAuth={() => setAuthModalOpen(true)} />
          )}
          {currentView === 'edu-gestion' && (
            <EduGestionView onOpenAuth={() => setAuthModalOpen(true)} />
          )}
        </div>

        <Footer
          onNavigateHome={handleNavigateHome}
          onOpenTutor={handleOpenTutor}
          onOpenDocente={handleOpenDocente}
          onOpenOrganiza={handleOpenOrganiza}
          onOpenGestion={handleOpenGestion}
        />

        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    </AuthProvider>
  );
}
