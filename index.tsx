import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import VoiceCommandsPage from './VoiceCommandsPage';
import HelpAndSupportPage from './HelpAndSupportPage';
import TermsAndConditionsPage from './TermsAndConditionsPage';
import SecurityPage from './SecurityPage';
import ImageGeneratorPage from './ImageGeneratorPage';
import AdminPanel from './AdminPanel';
import { db, doc, onSnapshot, updateDoc, serverTimestamp, getDoc, setDoc } from './firebase';
import { UserProfile } from './types';

// Helper to get or create a persistent Anonymous ID
const getAnonymousId = () => {
    let id = localStorage.getItem('hypley_anon_id');
    if (!id) {
        id = 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('hypley_anon_id', id);
    }
    return id;
};

const LoadingScreen = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--accent-primary)]"></div>
        <p className="text-[var(--text-primary)] mt-4">{message}</p>
    </div>
);

const applyTheme = (theme: string | undefined, customColor: string | undefined) => {
    const root = document.documentElement;
    root.classList.remove('theme-light'); 
    if (theme === 'light') root.classList.add('theme-light');

    if (customColor) {
        root.style.setProperty('--accent-primary', customColor);
        // Basic brightness adjustment for hover
        root.style.setProperty('--accent-primary-hover', customColor + 'dd'); 
    }
};

const Root = () => {
  const [userData, setUserData] = useState<Partial<UserProfile>>({});
  const [route, setRoute] = useState(window.location.hash);
  const [loading, setLoading] = useState(true);
  const [guestUser, setGuestUser] = useState<any>(null);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange, false);
    return () => window.removeEventListener('hashchange', handleHashChange, false);
  }, []);

  useEffect(() => {
    const setupGuestSession = async () => {
        const anonId = getAnonymousId();
        const userRef = doc(db, 'users', anonId);
        
        // Mock user object to satisfy App.tsx requirements
        const mockUser = {
            uid: anonId,
            email: 'convidado@hypley.ia',
            name: 'Convidado'
        };
        setGuestUser(mockUser);

        try {
            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) {
                await setDoc(userRef, {
                    uid: anonId,
                    name: 'Convidado',
                    subscriptionStatus: 'active', // Bypass payment
                    createdAt: serverTimestamp(),
                    theme: 'dark',
                    customThemeColor: '#3b82f6',
                    termsAccepted: true
                });
            }

            // Listen for changes (themes, tokens etc)
            const unsubscribe = onSnapshot(userRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as UserProfile;
                    setUserData(data);
                    applyTheme(data.theme, data.customThemeColor);
                }
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Guest setup error:", e);
            setLoading(false);
        }
    };

    setupGuestSession();
  }, []);

  const slug = route.replace('#', '');
  if (slug === '/admin' || slug === 'admin') return <AdminPanel />;
  if (loading) return <LoadingScreen message="Iniciando Hypley IA..." />;

  // Render components directly without Auth check
  if (slug === '/comandos-de-voz') return <VoiceCommandsPage />;
  if (slug === '/ajuda-e-suporte') return <HelpAndSupportPage />;
  if (slug === '/termos-e-condicoes') return <TermsAndConditionsPage />;
  if (slug === '/seguranca') return <SecurityPage />;
  if (slug === '/gerador-de-imagens') return <ImageGeneratorPage user={guestUser} />;
  
  return <App user={guestUser} initialUserData={userData} onApplyTheme={applyTheme} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><Root /></React.StrictMode>);