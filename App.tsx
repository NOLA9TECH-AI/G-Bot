
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
  SystemTheme,
  EnvironmentType
} from './types';
import RobotCanvas, { RobotRef } from './components/RobotCanvas';

const App: React.FC = () => {
  const [theme, setTheme] = useState<SystemTheme>(() => {
    const savedTheme = localStorage.getItem('g3_system_theme');
    return (savedTheme as SystemTheme) || SystemTheme.CYBER_BLUE;
  });

  const [environment, setEnvironment] = useState<EnvironmentType>(() => {
    const savedEnv = localStorage.getItem('g3_environment');
    return (savedEnv as EnvironmentType) || EnvironmentType.NONE;
  });

  const [robotColor, setRobotColor] = useState<string>(() => {
    const savedColor = localStorage.getItem('g3_robot_color');
    // Default to a visible grey instead of pure black
    return savedColor || '#888888';
  });
  
  // New Lighting States
  const [useManualLighting, setUseManualLighting] = useState(false);
  const [overheadLight, setOverheadLight] = useState({
    color: '#ffffff',
    intensity: 400,
    position: { x: 0, y: 20, z: 5 }
  });
  const [accentLight, setAccentLight] = useState({
    color: '#7096ff',
    intensity: 150,
    position: { x: 0, y: 4, z: 10 }
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [robotStyle, setRobotStyle] = useState<RobotStyle>(RobotStyle.CYBER); 
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.STREET);
  const [robotSize, setRobotSize] = useState(1.0);
  const [transcriptionFontSize, setTranscriptionFontSize] = useState(24);
  const [robotMood, setRobotMood] = useState<RobotVisualMood>(RobotVisualMood.NONE);
  const [sentimentMood, setSentimentMood] = useState<RobotVisualMood>(RobotVisualMood.NONE);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'CONFIG'>('CHAT');
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  const [loopEmotes, setLoopEmotes] = useState(false);
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isBotTalking, setIsBotTalking] = useState(false);
  const [liveBotTranscription, setLiveBotTranscription] = useState('');
  
  const activeUserMsgIdRef = useRef<string | null>(null);
  const activeBotMsgIdRef = useRef<string | null>(null);
  
  const liveSessionRef = useRef<any>(null);
  const robotRef = useRef<RobotRef>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('g3_system_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('g3_robot_color', robotColor); }, [robotColor]);

  const analyzeSentiment = (text: string) => {
    const lowerText = text.toLowerCase();
    const patterns = {
      [RobotVisualMood.EXCITED]: /awesome|great|incredible|amazing|wow|party|dance|excited|love it/i,
      [RobotVisualMood.HAPPY]: /yes|happy|good|cool|nice|thanks|thank you|lol|haha|hehe/i,
      [RobotVisualMood.ANGRY]: /no|hate|bad|angry|stupid|stop|kill|annoying|shut up|wrong/i,
      [RobotVisualMood.SAD]: /sad|sorry|cry|lonely|pain|hurts|unhappy|depressed|dark/i,
      [RobotVisualMood.CURIOUS]: /\?|how|why|what|who|where|ponder|think|maybe|search/i
    };
    for (const [mood, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) return mood as RobotVisualMood;
    }
    return null;
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const detectedMood = analyzeSentiment(lastMsg.text);
      if (detectedMood) {
        setSentimentMood(detectedMood);
        switch (detectedMood) {
          case RobotVisualMood.HAPPY: robotRef.current?.triggerAnimation(RobotAnimation.THUMBSUP); break;
          case RobotVisualMood.EXCITED: robotRef.current?.triggerAnimation(RobotAnimation.CELEBRATE); break;
          case RobotVisualMood.ANGRY: robotRef.current?.triggerAnimation(RobotAnimation.ALERT); break;
          case RobotVisualMood.SAD: robotRef.current?.triggerAnimation(RobotAnimation.SULK); break;
          case RobotVisualMood.CURIOUS: robotRef.current?.triggerAnimation(RobotAnimation.PONDER); break;
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading) setRobotMood(RobotVisualMood.LOADING);
    else if (isBotTalking) setRobotMood(RobotVisualMood.TALKING);
    else if (sentimentMood !== RobotVisualMood.NONE) setRobotMood(sentimentMood);
    else setRobotMood(RobotVisualMood.NONE);
  }, [isLoading, isBotTalking, sentimentMood]);

  useEffect(() => {
    const saved = localStorage.getItem('g3_chat_history');
    if (saved) { try { setMessages(JSON.parse(saved)); } catch (e) { setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 NEURAL ONLINE.' }]); } }
    else { setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 NEURAL ONLINE.' }]); }
  }, []);

  useEffect(() => { if (isChatVisible && activeTab === 'CHAT') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveBotTranscription, isChatVisible, activeTab]);

  const cycleTheme = () => {
    const all = Object.values(SystemTheme);
    const idx = all.indexOf(theme);
    setTheme(all[(idx + 1) % all.length]);
  };

  const getThemeColors = (t: SystemTheme) => {
    switch (t) {
      case SystemTheme.CYBER_BLUE: return { accent: '#7096ff' };
      case SystemTheme.SANGUINE: return { accent: '#990000' };
      case SystemTheme.PHOSPHOR: return { accent: '#00ff99' };
      case SystemTheme.DEEP_SEA: return { accent: '#00e5ff' };
      case SystemTheme.CRIMSON: return { accent: '#ff1e1e' };
      case SystemTheme.VERIDIAN: return { accent: '#00ffaa' };
      case SystemTheme.GOLD_LEAF: return { accent: '#FFD700' };
      case SystemTheme.TOXIC_LIME: return { accent: '#CCFF00' };
      case SystemTheme.ELECTRIC_VIOLET: return { accent: '#8a2be2' };
      case SystemTheme.SOLAR_ORANGE: return { accent: '#ff4500' };
      case SystemTheme.NEON_PINK: return { accent: '#ff007f' };
      case SystemTheme.NEURAL_WHITE: return { accent: '#ffffff' };
      default: return { accent: '#39ff14' };
    }
  };

  const { accent: accentColor } = getThemeColors(theme);

  const saveSettings = () => {
    setSaveStatus('SAVING');
    localStorage.setItem('g3_system_theme', theme);
    localStorage.setItem('g3_robot_color', robotColor);
    localStorage.setItem('g3_chat_history', JSON.stringify(messages.slice(-50)));
    setTimeout(() => {
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    }, 800);
  };

  const toggleLiveVoice = async () => {
    if (isLiveActive) { liveSessionRef.current?.close(); setIsLiveActive(false); setIsBotTalking(false); return; }
    try {
      const callbacks: LiveCallbacks = {
        onAudioChunk: () => setIsBotTalking(true),
        onInterrupted: () => { setIsBotTalking(false); setLiveBotTranscription(' [ INTERRUPTED ] '); },
        onTranscription: (text, isUser) => {
          if (isUser) {
            if (!activeUserMsgIdRef.current) { activeUserMsgIdRef.current = `v-u-${Date.now()}`; setMessages(prev => [...prev, { id: activeUserMsgIdRef.current!, role: MessageRole.USER, text }]); }
            else { setMessages(prev => prev.map(m => m.id === activeUserMsgIdRef.current ? { ...m, text } : m)); }
          } else {
            setLiveBotTranscription(text); setIsBotTalking(true);
            if (!activeBotMsgIdRef.current) { activeBotMsgIdRef.current = `v-b-${Date.now()}`; setMessages(prev => [...prev, { id: activeBotMsgIdRef.current!, role: MessageRole.BOT, text }]); }
            else { setMessages(prev => prev.map(m => m.id === activeBotMsgIdRef.current ? { ...m, text } : m)); }
          }
        },
        onToolCall: async (functionCalls) => {
          for (const fc of functionCalls) {
            if (fc.name === 'set_system_theme') setTheme(fc.args.theme as SystemTheme);
            if (fc.name === 'set_robot_style') setRobotStyle(fc.args.style as RobotStyle);
            if (fc.name === 'set_robot_scale') setRobotSize(Math.max(0.5, Math.min(2.0, fc.args.scale)));
            if (fc.name === 'trigger_emote') robotRef.current?.triggerAnimation(fc.args.emote as RobotAnimation, !!fc.args.loop);
          }
        },
        onTurnComplete: () => { setIsBotTalking(false); setLiveBotTranscription(''); activeUserMsgIdRef.current = null; activeBotMsgIdRef.current = null; },
        onError: () => setIsLiveActive(false),
        onClose: () => setIsLiveActive(false)
      };
      liveSessionRef.current = connectLive(theme, callbacks);
      setIsLiveActive(true);
      robotRef.current?.triggerAnimation(RobotAnimation.WAVE);
    } catch (err) { alert("Neural voice engine error."); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: MessageRole.BOT, text: '', isStreaming: true }]);
    let acc = '';
    try {
      await getGeminiResponse(userMsg.text, theme, (chunk, sources) => { acc += chunk; setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: acc, sources } : m)); });
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white flex flex-col transition-colors duration-700">
      <div className="absolute inset-0 z-0">
        <RobotCanvas 
          ref={robotRef} 
          style={robotStyle} 
          size={robotSize} 
          mood={robotMood} 
          theme={theme} 
          environment={environment} 
          color={robotColor}
          overheadLight={overheadLight}
          accentLight={accentLight}
          useManualLighting={useManualLighting}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 pointer-events-none">
        <header className="pointer-events-auto flex justify-between items-start w-full">
          <h1 className="font-marker text-xl md:text-3xl neon-text transition-all duration-500" style={{ color: accentColor }}>G-3 COMPANION</h1>
          <div className="flex gap-3">
            <button onClick={cycleTheme} className="px-6 py-2 rounded-full border-2 font-bold pointer-events-auto bg-black/60 hover:bg-white/10 transition-all uppercase text-[10px] md:text-xs tracking-widest shadow-lg" style={{ borderColor: accentColor, color: accentColor }}>
              {theme.replace('_', ' ')}
            </button>
            <button onClick={toggleLiveVoice} className={`flex items-center gap-2 px-6 py-2 rounded-full border-2 font-bold transition-all pointer-events-auto text-[10px] md:text-xs shadow-lg ${isLiveActive ? 'bg-red-600 border-red-400' : 'bg-black/60 hover:bg-white/10'}`} style={!isLiveActive ? { borderColor: accentColor, color: accentColor } : {}}>
              <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
              <span>{isLiveActive ? 'STOP' : 'LIVE'}</span>
            </button>
          </div>
        </header>

        {isLiveActive && liveBotTranscription && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6">
            <p className="font-marker text-center cool-spoken-words drop-shadow-2xl transition-all duration-500" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #fff)`, fontSize: `${transcriptionFontSize}px` }}>
              {liveBotTranscription}
            </p>
          </div>
        )}

        <div className="mt-auto w-full flex flex-col items-center pb-8">
          <button onClick={() => { setIsChatVisible(true); setActiveTab('CHAT'); }} className="pointer-events-auto group relative mb-4">
              <div className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-80 transition-all duration-500 rounded-full" style={{ backgroundColor: accentColor }}></div>
              <div className="relative bg-black/80 border-2 px-12 py-5 rounded-full font-marker tracking-widest uppercase transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl" style={{ borderColor: accentColor, color: accentColor }}>
                 NEURAL LINK
              </div>
          </button>

          {isChatVisible && (
            <main className="fixed inset-x-0 bottom-0 z-50 w-full max-w-4xl mx-auto flex flex-col pointer-events-auto bg-black border-t-2 overflow-hidden h-[85dvh] transition-all duration-500 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]" style={{ borderColor: accentColor }}>
              <div className="flex bg-zinc-900 border-b border-white/10 shrink-0">
                <button onClick={() => setActiveTab('CHAT')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'CHAT' ? 'bg-white/5' : 'opacity-40 hover:opacity-100'}`} style={activeTab === 'CHAT' ? { color: accentColor } : {}}>MESSAGES</button>
                <button onClick={() => setActiveTab('CONFIG')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'CONFIG' ? 'bg-white/5' : 'opacity-40 hover:opacity-100'}`} style={activeTab === 'CONFIG' ? { color: accentColor } : {}}>NEURAL CONFIG</button>
                <button onClick={() => setIsChatVisible(false)} className="px-8 py-4 font-bold hover:bg-white/10 transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'CHAT' ? (
                  <div className="flex-1 flex flex-col p-4 h-full">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm font-bold border-l-4 transition-all shadow-xl ${msg.role === MessageRole.USER ? 'bg-zinc-800' : 'bg-zinc-950'}`} style={msg.role !== MessageRole.USER ? { borderColor: accentColor } : {}}>
                            <span>{msg.text}</span>
                            {msg.imageUrl && <img src={msg.imageUrl} className="mt-3 rounded-xl border border-white/10 max-h-72 w-full object-cover shadow-2xl cursor-pointer" onClick={() => setImagePreviewUrl(msg.imageUrl || null)}/>}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2 p-2 bg-zinc-900/50 rounded-2xl border border-white/5">
                      <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="NEURAL COMMAND..." className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:opacity-20 font-bold" />
                      <button onClick={handleSendMessage} disabled={isLoading} className="px-8 rounded-xl font-bold transition-transform active:scale-95 shadow-lg" style={{ backgroundColor: accentColor, color: '#000' }}>⚡</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar uppercase">
                    {/* General Section */}
                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">CORE SYSTEMS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">SYSTEM THEME</label>
                            <select value={theme} onChange={(e) => setTheme(e.target.value as SystemTheme)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer hover:border-white/30 transition-all appearance-none">
                              {Object.values(SystemTheme).map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ART STYLE</label>
                            <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer hover:border-white/30 transition-all appearance-none">
                              {Object.values(ArtStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                        </div>
                      </div>
                    </div>

                    {/* Robot Armor Section */}
                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">ROBOTICS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ROBOT ARMOR</label>
                            <select value={robotStyle} onChange={(e) => setRobotStyle(e.target.value as RobotStyle)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer hover:border-white/30 transition-all appearance-none">
                              {Object.values(RobotStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">FORCE EMOTE</label>
                            <div className="flex gap-2">
                              <select onChange={(e) => e.target.value && robotRef.current?.triggerAnimation(e.target.value as RobotAnimation, loopEmotes)} className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer hover:border-white/30 transition-all appearance-none">
                                <option value="">TRIGGER ACTION...</option>
                                {Object.values(RobotAnimation).map(anim => <option key={anim} value={anim}>{anim.toUpperCase()}</option>)}
                              </select>
                              <button 
                                onClick={() => setLoopEmotes(!loopEmotes)} 
                                className={`px-4 rounded-xl border-2 font-black transition-all text-xs ${loopEmotes ? 'bg-white text-black border-white' : 'border-white/10 opacity-40'}`}
                              >
                                ∞
                              </button>
                            </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-6 bg-zinc-900/50 border border-white/5 rounded-2xl">
                          <div className="flex flex-col">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ARMOR TINT</label>
                            <span className="text-xs font-mono font-bold tracking-widest mt-1 opacity-80">{robotColor}</span>
                          </div>
                          <input type="color" value={robotColor} onChange={(e) => setRobotColor(e.target.value)} className="w-16 h-12 rounded-lg bg-transparent cursor-pointer border-none" />
                      </div>
                      <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">NEURAL SCALE</label>
                            <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{robotSize.toFixed(1)}X</span>
                          </div>
                          <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                      </div>
                    </div>

                    {/* Lighting Control Section */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <h3 className="text-xs font-black tracking-[0.3em] opacity-30">SCENE ILLUMINATION</h3>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-black opacity-40">MANUAL MODE</span>
                           <button 
                            onClick={() => setUseManualLighting(!useManualLighting)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${useManualLighting ? 'bg-green-500' : 'bg-zinc-700'}`}
                           >
                             <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${useManualLighting ? 'left-6' : 'left-1'}`} />
                           </button>
                        </div>
                      </div>

                      {useManualLighting ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                          {/* Overhead Controls */}
                          <div className="space-y-4 bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                            <h4 className="text-[10px] font-black tracking-widest opacity-60">OVERHEAD SPOTLIGHT</h4>
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black opacity-40">INTENSITY</label>
                              <span className="text-xs font-mono font-bold">{overheadLight.intensity}</span>
                            </div>
                            <input type="range" min="0" max="1000" step="10" value={overheadLight.intensity} onChange={(e) => setOverheadLight({...overheadLight, intensity: parseInt(e.target.value)})} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                            
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black opacity-40">HEIGHT</label>
                              <span className="text-xs font-mono font-bold">{overheadLight.position.y}M</span>
                            </div>
                            <input type="range" min="5" max="50" step="1" value={overheadLight.position.y} onChange={(e) => setOverheadLight({...overheadLight, position: {...overheadLight.position, y: parseInt(e.target.value)}})} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                            
                            <div className="flex items-center justify-between mt-4">
                              <label className="text-[9px] font-black opacity-40">COLOR</label>
                              <input type="color" value={overheadLight.color} onChange={(e) => setOverheadLight({...overheadLight, color: e.target.value})} className="w-12 h-8 rounded bg-transparent cursor-pointer border-none" />
                            </div>
                          </div>

                          {/* Accent Controls */}
                          <div className="space-y-4 bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                            <h4 className="text-[10px] font-black tracking-widest opacity-60">ACCENT POINTLIGHT</h4>
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black opacity-40">INTENSITY</label>
                              <span className="text-xs font-mono font-bold">{accentLight.intensity}</span>
                            </div>
                            <input type="range" min="0" max="500" step="5" value={accentLight.intensity} onChange={(e) => setAccentLight({...accentLight, intensity: parseInt(e.target.value)})} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                            
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black opacity-40">DISTANCE (Z)</label>
                              <span className="text-xs font-mono font-bold">{accentLight.position.z}M</span>
                            </div>
                            <input type="range" min="0" max="30" step="1" value={accentLight.position.z} onChange={(e) => setAccentLight({...accentLight, position: {...accentLight.position, z: parseInt(e.target.value)}})} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                            
                            <div className="flex items-center justify-between mt-4">
                              <label className="text-[9px] font-black opacity-40">COLOR</label>
                              <input type="color" value={accentLight.color} onChange={(e) => setAccentLight({...accentLight, color: e.target.value})} className="w-12 h-8 rounded bg-transparent cursor-pointer border-none" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center opacity-20 gap-4 border border-dashed border-white/10 rounded-2xl">
                           <span className="text-[10px] font-black tracking-[0.2em]">DYNAMIC NEURAL LIGHTING ACTIVE</span>
                           <span className="text-[8px] font-bold">LIGHTS ARE REACTING TO SYSTEM THEME & MOOD</span>
                        </div>
                      )}
                    </div>

                    {/* UI/UX Section */}
                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">INTERFACE</h3>
                      <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">TRANSCRIPTION SIZE</label>
                            <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{transcriptionFontSize}PX</span>
                          </div>
                          <input type="range" min="12" max="120" step="1" value={transcriptionFontSize} onChange={(e) => setTranscriptionFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                      </div>
                    </div>

                    <div className="pt-6">
                      <button 
                        onClick={saveSettings} 
                        className="w-full py-5 rounded-2xl font-marker text-lg tracking-[0.2em] uppercase transition-all shadow-2xl hover:brightness-125 active:scale-[0.98]" 
                        style={{ backgroundColor: accentColor, color: '#000' }}
                      >
                        {saveStatus === 'IDLE' ? 'SAVE NEURAL STATE' : saveStatus}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setImagePreviewUrl(null)}>
            <img src={imagePreviewUrl} className="max-w-full max-h-[90dvh] rounded-3xl border-2 shadow-2xl scale-in-95 animate-in duration-300 transition-all duration-500" style={{ borderColor: accentColor }} />
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .cool-spoken-words { -webkit-background-clip: text; background-clip: text; color: transparent; pointer-events: none; }
      `}</style>
    </div>
  );
};

export default App;
