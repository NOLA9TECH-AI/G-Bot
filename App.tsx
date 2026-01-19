
import React, { useState, useRef, useEffect } from 'react';
import { 
  getGeminiResponse, 
  generateImage, 
} from './services/geminiService';
import { 
  connectLive, 
  LiveCallbacks 
} from './services/geminiLiveService';
import { 
  MessageRole, 
  ChatMessage, 
  RobotStyle, 
  ArtStyle,
  RobotAnimation, 
  RobotVisualMood,
  GroundingSource,
  SystemTheme,
  EnvironmentType
} from './types';
import RobotCanvas, { RobotRef } from './components/RobotCanvas';

const App: React.FC = () => {
  const [theme, setTheme] = useState<SystemTheme>(() => {
    const savedTheme = localStorage.getItem('g3_system_theme');
    return (savedTheme as SystemTheme) || SystemTheme.HOOD;
  });

  const [environment, setEnvironment] = useState<EnvironmentType>(() => {
    const savedEnv = localStorage.getItem('g3_environment');
    return (savedEnv as EnvironmentType) || EnvironmentType.NONE;
  });

  const [robotColor, setRobotColor] = useState<string>(() => {
    const savedColor = localStorage.getItem('g3_robot_color');
    return savedColor || '#00FF41';
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [robotStyle, setRobotStyle] = useState<RobotStyle>(RobotStyle.CYBER); 
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.STREET);
  const [robotSize, setRobotSize] = useState(1.0);
  const [transcriptionFontSize, setTranscriptionFontSize] = useState(18);
  const [robotMood, setRobotMood] = useState<RobotVisualMood>(RobotVisualMood.NONE);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'CONFIG'>('CHAT');
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isBotTalking, setIsBotTalking] = useState(false);
  const [liveBotTranscription, setLiveBotTranscription] = useState('');
  
  const activeUserMsgIdRef = useRef<string | null>(null);
  const activeBotMsgIdRef = useRef<string | null>(null);
  
  const liveSessionRef = useRef<any>(null);
  const robotRef = useRef<RobotRef>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) {
      setRobotMood(RobotVisualMood.LOADING);
    } else if (isBotTalking) {
      setRobotMood(RobotVisualMood.TALKING);
    } else {
      setRobotMood(RobotVisualMood.NONE);
    }
  }, [isLoading, isBotTalking]);

  useEffect(() => {
    if (isBotTalking) {
      robotRef.current?.triggerAnimation(RobotAnimation.YES);
    }
  }, [isBotTalking]);

  useEffect(() => {
    const saved = localStorage.getItem('g3_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 CORE ONLINE. NEURAL LINK ESTABLISHED.' }]);
      }
    } else {
      setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 CORE ONLINE. NEURAL LINK ESTABLISHED.' }]);
    }
  }, []);

  useEffect(() => {
    if (isChatVisible && activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, liveBotTranscription, isChatVisible, activeTab]);

  const saveSettings = () => {
    setSaveStatus('SAVING');
    localStorage.setItem('g3_system_theme', theme);
    localStorage.setItem('g3_environment', environment);
    localStorage.setItem('g3_robot_color', robotColor);
    localStorage.setItem('g3_chat_history', JSON.stringify(messages.slice(-50)));
    setTimeout(() => {
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    }, 600);
  };

  const toggleEnvironment = () => {
    const allEnvs = Object.values(EnvironmentType);
    const currentIndex = allEnvs.indexOf(environment);
    const nextIndex = (currentIndex + 1) % allEnvs.length;
    setEnvironment(allEnvs[nextIndex]);
  };

  const toggleLiveVoice = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      setIsLiveActive(false);
      setIsBotTalking(false);
      setLiveBotTranscription('');
      activeUserMsgIdRef.current = null;
      activeBotMsgIdRef.current = null;
      return;
    }

    try {
      const callbacks: LiveCallbacks = {
        onAudioChunk: () => setIsBotTalking(true),
        onInterrupted: () => {
          setIsBotTalking(false);
          setLiveBotTranscription(' [ INTERRUPTED ] ');
          robotRef.current?.triggerAnimation(RobotAnimation.NO);
        },
        onTranscription: (text, isUser) => {
          if (isUser) {
            if (!activeUserMsgIdRef.current) {
              activeUserMsgIdRef.current = `voice-user-${Date.now()}`;
              setMessages(prev => [...prev, { id: activeUserMsgIdRef.current!, role: MessageRole.USER, text }]);
            } else {
              setMessages(prev => prev.map(m => m.id === activeUserMsgIdRef.current ? { ...m, text } : m));
            }
          } else {
            setLiveBotTranscription(text);
            setIsBotTalking(true);
            if (!activeBotMsgIdRef.current) {
              activeBotMsgIdRef.current = `voice-bot-${Date.now()}`;
              setMessages(prev => [...prev, { id: activeBotMsgIdRef.current!, role: MessageRole.BOT, text }]);
            } else {
              setMessages(prev => prev.map(m => m.id === activeBotMsgIdRef.current ? { ...m, text } : m));
            }
          }
        },
        onToolCall: async (functionCalls) => {
          for (const fc of functionCalls) {
            if (fc.name === 'generate_image') handleGenerateArtFromPrompt(fc.args.prompt);
            if (fc.name === 'toggle_command_window') setIsChatVisible(fc.args.visible);
            if (fc.name === 'set_system_theme') setTheme(fc.args.theme as SystemTheme);
            if (fc.name === 'set_robot_scale') setRobotSize(Math.max(0.5, Math.min(2.0, fc.args.scale)));
            if (fc.name === 'set_robot_color') setRobotColor(fc.args.color);
            if (fc.name === 'set_transcription_size') setTranscriptionFontSize(Math.max(12, Math.min(120, fc.args.size)));
            if (fc.name === 'trigger_emote') robotRef.current?.triggerAnimation(fc.args.emote as RobotAnimation);
          }
        },
        onTurnComplete: () => {
          setIsBotTalking(false);
          setLiveBotTranscription('');
          activeUserMsgIdRef.current = null;
          activeBotMsgIdRef.current = null;
        },
        onError: () => setIsLiveActive(false),
        onClose: () => setIsLiveActive(false)
      };

      liveSessionRef.current = connectLive(theme, callbacks);
      setIsLiveActive(true);
      robotRef.current?.triggerAnimation(RobotAnimation.WAVE);
    } catch (err) {
      alert("Neural voice engine failed.");
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    const botMsg: ChatMessage = { id: botMsgId, role: MessageRole.BOT, text: '', isStreaming: true, sources: [] };
    setMessages(prev => [...prev, botMsg]);

    let accumulatedText = '';
    try {
      await getGeminiResponse(userMsg.text, theme, (chunk, sources) => {
        accumulatedText += chunk;
        setMessages(prev => prev.map(m => m.id === botMsgId ? { 
          ...m, 
          text: accumulatedText, 
          sources: sources ? [...(m.sources || []), ...sources] : m.sources 
        } : m));
      });
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err', role: MessageRole.SYSTEM, text: 'CONNECTION FAILED.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateArtFromPrompt = async (prompt: string) => {
    setIsLoading(true);
    setRobotMood(RobotVisualMood.PAINTING);
    robotRef.current?.triggerAnimation(RobotAnimation.DANCE);
    const imageUrl = await generateImage(prompt, theme, artStyle);
    if (imageUrl) {
      setImagePreviewUrl(imageUrl);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.BOT, text: `Neural mural complete: "${prompt}"`, imageUrl }]);
    }
    setIsLoading(false);
  };

  const handleGenerateArt = () => {
    let prompt = inputText.trim();
    if (!prompt) {
      const lastUserMsg = messages.filter(m => m.role === MessageRole.USER).pop();
      if (lastUserMsg) prompt = lastUserMsg.text;
    }
    if (prompt) handleGenerateArtFromPrompt(prompt);
    setInputText('');
  };

  const getThemeColors = (t: SystemTheme) => {
    switch (t) {
      case SystemTheme.HOOD: return { accent: '#FFD700', secondary: '#00BFFF' };
      case SystemTheme.TOXIC: return { accent: '#CCFF00', secondary: '#FF3300' };
      case SystemTheme.FROST: return { accent: '#00FFFF', secondary: '#E0FFFF' };
      case SystemTheme.BLOOD: return { accent: '#FF0000', secondary: '#660000' };
      case SystemTheme.VOID: return { accent: '#9400D3', secondary: '#2D004B' };
      case SystemTheme.SUNSET: return { accent: '#FF4500', secondary: '#FFD700' };
      case SystemTheme.EMERALD: return { accent: '#50C878', secondary: '#FFD700' };
      case SystemTheme.MIDNIGHT: return { accent: '#191970', secondary: '#C0C0C0' };
      case SystemTheme.CYBERPUNK: return { accent: '#39ff14', secondary: '#bc13fe' };
      default: return { accent: '#39ff14', secondary: '#bc13fe' };
    }
  };

  const { accent: accentColor } = getThemeColors(theme);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white selection:bg-neon-green selection:text-black flex flex-col">
      <div className="absolute inset-0 z-0">
        <RobotCanvas ref={robotRef} style={robotStyle} size={robotSize} mood={robotMood} theme={theme} environment={environment} color={robotColor} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 pointer-events-none h-full overflow-hidden">
        <header className="pointer-events-auto flex justify-between items-start w-full mb-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-marker text-xl md:text-3xl -rotate-1 origin-left neon-text" style={{ color: accentColor }}>G-3 CANVAS</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleEnvironment} className="px-4 py-2 rounded-full border-2 font-bold pointer-events-auto shadow-lg text-[10px] md:text-sm bg-black/60 hover:bg-white hover:text-black transition-all uppercase" style={{ borderColor: accentColor, color: accentColor }}>
              {environment.replace('_', ' ')}
            </button>
            <button onClick={toggleLiveVoice} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold transition-all duration-300 pointer-events-auto shadow-lg text-[10px] md:text-sm ${isLiveActive ? 'bg-red-600 border-red-400 animate-pulse text-white' : 'bg-black/60 hover:bg-white hover:text-black'}`} style={!isLiveActive ? { borderColor: accentColor, color: accentColor } : {}}>
              <span>{isLiveActive ? '⏹' : '🎤'}</span>
              <span>{isLiveActive ? 'STOP' : 'LIVE'}</span>
            </button>
          </div>
        </header>

        {isLiveActive && liveBotTranscription && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6 pb-20">
            <div className="max-w-6xl w-full text-center">
              <p className="cool-spoken-words font-marker leading-tight transition-all duration-300" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #fff, ${accentColor})`, textShadow: `0 0 15px ${accentColor}66`, fontSize: `${transcriptionFontSize}px` }}>
                {liveBotTranscription}
              </p>
            </div>
          </div>
        )}

        <div className="mt-auto w-full flex flex-col items-center justify-end pointer-events-none pb-4">
          <button onClick={() => { setIsChatVisible(true); setActiveTab('CHAT'); }} className="pointer-events-auto group relative mb-4">
              <div className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-100 transition-opacity rounded-full" style={{ backgroundColor: accentColor }}></div>
              <div className="relative bg-black/80 border-2 px-10 py-4 rounded-full font-marker tracking-[0.3em] uppercase transition-all hover:scale-105 active:scale-95 shadow-2xl" style={{ borderColor: accentColor, color: accentColor }}>
                 NEURAL LINK
              </div>
          </button>

          {isChatVisible && (
            <main className="fixed inset-x-0 bottom-0 z-50 w-full max-w-4xl mx-auto flex flex-col pointer-events-auto animate-[floatUp_0.3s_ease-out] overflow-hidden h-[90dvh] bg-black/95 lg:relative lg:h-[70dvh] border-t-2" style={{ borderColor: accentColor }}>
              {/* Tab Navigation */}
              <div className="flex bg-zinc-900/50 border-b border-white/5 shrink-0">
                <button 
                  onClick={() => setActiveTab('CHAT')}
                  className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'CHAT' ? 'bg-white/5' : 'opacity-40 hover:opacity-100'}`}
                  style={activeTab === 'CHAT' ? { color: accentColor } : {}}
                >
                  MESSAGES
                </button>
                <button 
                  onClick={() => setActiveTab('CONFIG')}
                  className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'CONFIG' ? 'bg-white/5' : 'opacity-40 hover:opacity-100'}`}
                  style={activeTab === 'CONFIG' ? { color: accentColor } : {}}
                >
                  CONFIG
                </button>
                <button onClick={() => setIsChatVisible(false)} className="px-6 py-3 text-lg font-bold hover:bg-red-500/20 transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'CHAT' ? (
                  <div className="flex-1 flex flex-col p-4 h-full">
                    <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar mb-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] border-l-2 ${msg.role === MessageRole.USER ? 'bg-white/5 border-white/20' : 'bg-white/10 shadow-lg shadow-black/40'}`} style={msg.role !== MessageRole.USER ? { borderColor: accentColor, color: accentColor } : {}}>
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                            {msg.imageUrl && <img src={msg.imageUrl} className="mt-2 rounded-lg max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity border border-white/10" onClick={() => setImagePreviewUrl(msg.imageUrl || null)}/>}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                                {msg.sources.map((s, idx) => (
                                  <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] uppercase tracking-tighter bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors" style={{ color: accentColor }}>
                                    {s.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="NEURAL COMMAND..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all" />
                      <button onClick={handleSendMessage} disabled={isLoading} className="font-bold px-5 rounded-2xl text-[10px] text-white hover:brightness-110 active:scale-95 transition-all shadow-lg" style={{ backgroundColor: accentColor }}>⚡</button>
                      <button onClick={handleGenerateArt} disabled={isLoading} className="font-bold px-5 rounded-2xl text-[10px] text-white bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all shadow-lg">🎨</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Theme and Styles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 block">System Theme</label>
                        <select value={theme} onChange={(e) => setTheme(e.target.value as SystemTheme)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm uppercase font-bold text-white outline-none focus:border-white/30 transition-all">
                          {Object.values(SystemTheme).map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 block">Art Engine Style</label>
                        <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm uppercase font-bold text-white outline-none focus:border-white/30 transition-all">
                          {Object.values(ArtStyle).map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Robot Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 block">Armor Style</label>
                        <select value={robotStyle} onChange={(e) => setRobotStyle(e.target.value as RobotStyle)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm uppercase font-bold text-white outline-none focus:border-white/30 transition-all">
                          {Object.values(RobotStyle).map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 block">Force Emote</label>
                        <select onChange={(e) => robotRef.current?.triggerAnimation(e.target.value as RobotAnimation)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm uppercase font-bold text-white outline-none focus:border-white/30 transition-all">
                          <option value="" className="bg-zinc-900">TRIGGER EMOTE...</option>
                          {Object.values(RobotAnimation).map(anim => <option key={anim} value={anim} className="bg-zinc-900">{anim.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Sliders and Colors */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase opacity-50">Armor Color</span>
                            <span className="text-xs font-mono">{robotColor}</span>
                         </div>
                         <input type="color" value={robotColor} onChange={(e) => setRobotColor(e.target.value)} className="w-16 h-8 rounded-lg bg-transparent cursor-pointer" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] font-bold uppercase opacity-50">Neural Scale</label>
                           <span className="text-xs font-mono" style={{ color: accentColor }}>{robotSize}x</span>
                        </div>
                        <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] font-bold uppercase opacity-50">Transcription Size</label>
                           <span className="text-xs font-mono" style={{ color: accentColor }}>{transcriptionFontSize}px</span>
                        </div>
                        <input type="range" min="12" max="120" step="1" value={transcriptionFontSize} onChange={(e) => setTranscriptionFontSize(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={saveSettings} 
                        className="w-full py-4 rounded-2xl font-marker tracking-[0.2em] uppercase transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]" 
                        style={{ backgroundColor: accentColor, color: '#000' }}
                      >
                        {saveStatus === 'IDLE' ? 'SAVE NEURAL CORE' : saveStatus}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </main>
          )}
        </div>
      </div>

      {imagePreviewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 md:p-12 animate-in fade-in zoom-in duration-300 backdrop-blur-md" onClick={() => setImagePreviewUrl(null)}>
          <div className="relative max-w-5xl w-full group">
              <img src={imagePreviewUrl} className="w-full h-auto max-h-[85dvh] object-contain rounded-3xl border-2 shadow-[0_0_50px_rgba(0,0,0,0.5)]" style={{ borderColor: accentColor }} />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="bg-black/60 hover:bg-black/90 p-3 rounded-full text-white backdrop-blur-md transition-all">✕</button>
              </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .cool-spoken-words { -webkit-background-clip: text; background-clip: text; color: transparent; pointer-events: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
