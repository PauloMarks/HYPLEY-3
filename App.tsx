
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createLiveSession, LiveSessionController, sendTextMessage } from './services/geminiService';
import { ConversationMessage, Conversation, UserProfile } from './types';
import { db, doc, updateDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from './firebase';

const HypleyLogo = ({ className = "" }) => (
    <div className={`text-2xl font-bold flex items-center tracking-tight ${className}`}>
        <span className="text-white">HYPLEY</span><span className="text-blue-500 ml-1">IA</span>
    </div>
);

const AGENT_OPTIONS = [
    { id: 'default', name: 'HYPLEY (Geral)', desc: 'Assistente versátil para tudo', icon: '✨' },
    { id: 'traffic_manager', name: 'ANDROMEDA', desc: 'Especialista em Meta Ads', icon: '🚀' },
    { id: 'google_ads', name: 'GOOGLE ADS', desc: 'Mestre em Tráfego Google', icon: '🔍' },
    { id: 'programmer', name: 'PROGRAMADOR', desc: 'Elite em Código e Dev', icon: '💻' },
];

const VOICE_OPTIONS = [
    { id: 'Luiza', name: 'Hypley Luiza (Paulista)', desc: 'Sexy, carinhosa e sotaque de SP' },
    { id: 'Jade', name: 'Hypley Jade (Carioca)', desc: 'Carinhosa, sexy e carioca' },
    { id: 'Kore', name: 'Hypley Kore (Feminino)', desc: 'Profissional e clara' },
    { id: 'Zephyr', name: 'Hypley Zephyr (Neutro)', desc: 'Amigável e calorosa' },
    { id: 'Fenrir', name: 'Hypley Fenrir (Masculino)', desc: 'Profunda e séria' },
    { id: 'Puck', name: 'Hypley Puck (Juvenil)', desc: 'Energética e rápida' },
    { id: 'Charon', name: 'Hypley Charon (Calmo)', desc: 'Tranquila e estável' },
];

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <button 
            onClick={handleCopy}
            title="Copiar texto"
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-all ml-2 flex-shrink-0"
        >
            {copied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
            )}
        </button>
    );
};

export const App: React.FC<{ user: any, initialUserData: Partial<UserProfile>, onApplyTheme: any }> = ({ user, initialUserData, onApplyTheme }) => {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicLoading, setIsMicLoading] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ConversationMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(initialUserData.voiceName || 'Kore');
  const [selectedAgent, setSelectedAgent] = useState('default');

  const liveSessionControllerRef = useRef<LiveSessionController | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const visionIntervalRef = useRef<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  useEffect(() => {
    return () => {
        if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
        if (liveSessionControllerRef.current) liveSessionControllerRef.current.closeSession();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'conversations'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setAllConversations(fetched);
        if (fetched.length > 0 && !activeConversationId) setActiveConversationId(fetched[0].id);
        else if (fetched.length === 0) handleNewChat();
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeConversationId) return;
    const q = query(collection(db, `conversations/${activeConversationId}/messages`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setActiveMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsubscribe();
  }, [activeConversationId]);

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [activeMessages]);

  const handleNewChat = async () => {
    try {
        const ref = await addDoc(collection(db, 'conversations'), { uid: user.uid, title: "Nova Conversa", createdAt: serverTimestamp() });
        setActiveConversationId(ref.id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleAgentChange = (agentId: string) => {
      setSelectedAgent(agentId);
      if (isMicActive) {
          handleToggleMicrophone();
          setTimeout(handleToggleMicrophone, 500);
      }
  };

  const handleVoiceChange = async (voiceId: string) => {
      setSelectedVoice(voiceId);
      if (user?.uid) {
          try { await updateDoc(doc(db, 'users', user.uid), { voiceName: voiceId }); } catch (e) { console.error(e); }
      }
      if (isMicActive) {
          handleToggleMicrophone();
          setTimeout(handleToggleMicrophone, 500);
      }
  };

  const startVisionLoop = (sessionPromise: Promise<any>) => {
    if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    visionIntervalRef.current = window.setInterval(async () => {
      if (!isScreenSharing || !screenStreamRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (video.videoWidth && ctx) {
        canvas.width = 640;
        canvas.height = (video.videoHeight / video.videoWidth) * 640;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
      }
    }, 1000); 
  };

  const handleToggleScreenSharing = async () => {
    if (isScreenSharing) {
        if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStreamRef.current = stream;
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setIsScreenSharing(true);
            if (liveSessionControllerRef.current) startVisionLoop(liveSessionControllerRef.current.sessionPromise);
        } catch (e) { setErrorMessage("Permissão de tela negada."); }
    }
  };

  const handleToggleMicrophone = async () => {
    if (isMicActive) {
        setIsMicActive(false);
        liveSessionControllerRef.current?.closeSession();
        liveSessionControllerRef.current = null;
    } else {
        setIsMicLoading(true);
        try {
            if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
            if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
            const controller = createLiveSession({
                onOpen: () => { setIsMicActive(true); setIsMicLoading(false); if (isScreenSharing) startVisionLoop(controller.sessionPromise); },
                onClose: () => setIsMicActive(false),
                onError: (e) => { setErrorMessage("Erro de áudio."); setIsMicActive(false); setIsMicLoading(false); },
                onModelStartSpeaking: () => setIsSpeaking(true),
                onModelStopSpeaking: (text) => {
                    setIsSpeaking(false);
                    addDoc(collection(db, `conversations/${activeConversationId}/messages`), { role: 'model', text, timestamp: serverTimestamp() });
                },
                onUserStopSpeaking: (text) => addDoc(collection(db, `conversations/${activeConversationId}/messages`), { role: 'user', text, timestamp: serverTimestamp() }),
                onTurnComplete: () => {},
                onSessionReady: () => {}
            }, inputAudioContextRef.current, outputAudioContextRef.current, nextStartTimeRef, micStreamRef, null, activeMessages, selectedAgent, selectedVoice);
            liveSessionControllerRef.current = controller;
            await controller.startMicrophone();
        } catch (e) { setErrorMessage("Erro ao iniciar microfone."); setIsMicLoading(false); }
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim() || isSendingText) return;
    const text = textInput; setTextInput(''); setIsSendingText(true);
    await addDoc(collection(db, `conversations/${activeConversationId}/messages`), { role: 'user', text, timestamp: serverTimestamp() });
    try {
        const result = await sendTextMessage(text, activeMessages, selectedAgent, undefined, false, 'advanced', undefined, false, selectedVoice);
        if (result?.text) await addDoc(collection(db, `conversations/${activeConversationId}/messages`), { role: 'model', text: result.text, timestamp: serverTimestamp() });
    } catch (e) { setErrorMessage("Erro no chat."); } finally { setIsSendingText(false); }
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">
      
      {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
         <div className="p-6 h-16 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
             <HypleyLogo />
             <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-[var(--text-secondary)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
             </button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4 space-y-6">
             <button onClick={handleNewChat} className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95">Nova Conversa</button>
             
             <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] px-2 font-bold">Agentes Especialistas</p>
                {AGENT_OPTIONS.map(agent => (
                    <button 
                        key={agent.id} 
                        onClick={() => handleAgentChange(agent.id)} 
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedAgent === agent.id ? 'bg-blue-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                    >
                        <span className="text-xl">{agent.icon}</span>
                        <div className="text-left overflow-hidden">
                            <p className="text-xs font-bold truncate">{agent.name}</p>
                            <p className={`text-[10px] truncate ${selectedAgent === agent.id ? 'text-blue-100' : 'opacity-60'}`}>{agent.desc}</p>
                        </div>
                    </button>
                ))}
             </div>

             <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] px-2 font-bold">Voz do Assistente</p>
                {VOICE_OPTIONS.map(voice => (
                    <button 
                        key={voice.id} 
                        onClick={() => handleVoiceChange(voice.id)} 
                        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${selectedVoice === voice.id ? 'bg-[var(--bg-tertiary)] border border-blue-500/50 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedVoice === voice.id ? 'bg-blue-500' : 'bg-[var(--bg-tertiary)]'}`}>
                            {voice.id.charAt(0)}
                        </div>
                        <div className="text-left overflow-hidden">
                            <p className="text-[10px] font-bold truncate">{voice.name}</p>
                        </div>
                    </button>
                ))}
             </div>

             <div className="space-y-1">
                 <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] px-2 font-bold">Histórico Recente</p>
                 {allConversations.slice(0, 8).map(convo => (
                     <button 
                        key={convo.id} 
                        onClick={() => setActiveConversationId(convo.id)} 
                        className={`w-full text-left p-3 rounded-xl truncate text-xs transition-all ${activeConversationId === convo.id ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                     >
                        {convo.title || "Sem título"}
                     </button>
                 ))}
             </div>
         </div>

         <div className="p-4 border-t border-[var(--border-color)] flex-shrink-0">
             <div className="flex items-center space-x-3 text-sm text-[var(--text-secondary)] p-2 rounded-xl bg-[var(--bg-primary)]/50">
                 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">C</div>
                 <span className="flex-1 font-medium truncate">Convidado</span>
             </div>
         </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[var(--bg-primary)]">
         <header className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]/50 backdrop-blur-md z-10">
             <div className="flex items-center gap-3">
                 <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-[var(--text-secondary)]">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
                 <div className="hidden md:flex flex-col">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Contexto Ativo</span>
                    <span className="text-xs font-bold">{AGENT_OPTIONS.find(a => a.id === selectedAgent)?.name}</span>
                 </div>
             </div>
             
             <div className="flex gap-2">
                 <button 
                    onClick={handleToggleScreenSharing} 
                    className={`px-4 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${isScreenSharing ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                 >
                    {isScreenSharing ? 'VISÃO ATIVA' : 'VER TELA'}
                 </button>
                 <button 
                    onClick={handleToggleMicrophone} 
                    className={`px-4 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${isMicActive ? 'bg-green-500 border-green-500 text-white shadow-lg animate-pulse' : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                 >
                    {isMicLoading ? 'INICIANDO...' : isMicActive ? 'OUVINDO...' : 'FALAR'}
                 </button>
             </div>
         </header>

         <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={chatContainerRef}>
             {activeMessages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                    <HypleyLogo className="mb-4 text-6xl" />
                    <p className="max-w-xs text-sm">Olá! Eu sou o assistente especializado em {AGENT_OPTIONS.find(a => a.id === selectedAgent)?.name}. Como posso ajudar?</p>
                 </div>
             )}
             {activeMessages.map(msg => (
                 <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`relative max-w-[85%] p-4 rounded-2xl shadow-md flex items-start ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none flex-row-reverse' : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-tl-none'}`}>
                         <p className="text-sm leading-relaxed flex-1">{msg.text}</p>
                         <CopyButton text={msg.text} />
                     </div>
                 </div>
             ))}
             {isSpeaking && (
                 <div className="flex justify-start">
                    <div className="bg-blue-500/10 border border-blue-500/30 p-2 rounded-xl text-[10px] text-blue-400 font-bold animate-pulse uppercase tracking-wider">
                        HYPLEY respondendo...
                    </div>
                 </div>
             )}
         </div>

         <div className="p-4 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-t border-[var(--border-color)]">
             <div className="max-w-4xl mx-auto flex gap-3 items-center">
                 <div className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl flex items-center px-4 py-1 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                    <input 
                        value={textInput} 
                        onChange={e => setTextInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSendText()} 
                        className="flex-1 bg-transparent p-2 text-sm outline-none" 
                        placeholder={`Perguntar ao ${AGENT_OPTIONS.find(a => a.id === selectedAgent)?.name}...`} 
                    />
                    <button 
                        onClick={handleSendText} 
                        disabled={!textInput.trim() || isSendingText} 
                        className="p-2 text-blue-500 disabled:opacity-20 hover:scale-110 transition-transform"
                    >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                 </div>
             </div>
         </div>
      </main>

      {errorMessage && (
        <div className="fixed bottom-20 right-4 bg-red-600 text-white px-4 py-2 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-2">
            <span className="text-xs font-bold">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-black">&times;</button>
        </div>
      )}
    </div>
  );
};

export default App;
