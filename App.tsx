
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
  RobotFinish,
  ArtStyle,
  RobotAnimation, 
  RobotVisualMood,
  SystemTheme,
  EnvironmentType,
  VisualMode,
  TranscriptionStyle
} from './types';
import RobotCanvas, { RobotRef } from './components/RobotCanvas';

const App: React.FC = () => {
  const [theme, setTheme] = useState<SystemTheme>(() => {
    const savedTheme = localStorage.getItem('g9_system_theme');
    return (savedTheme as SystemTheme) || SystemTheme.CYBER_BLUE;
  });

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

  const [robotColor, setRobotColor] = useState(accentColor);
  const [gridColor, setGridColor] = useState('#555555');
  const [isColorSynced, setIsColorSynced] = useState(true);
  const [isGridSynced, setIsGridSynced] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [artPrompt, setArtPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [robotStyle, setRobotStyle] = useState<RobotStyle>(RobotStyle.CYBER); 
  const [robotFinish, setRobotFinish] = useState<RobotFinish>(RobotFinish.METALLIC);
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.STREET);
  const [robotSize, setRobotSize] = useState(1.0);
  const [robotMood, setRobotMood] = useState<RobotVisualMood>(RobotVisualMood.NONE);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'CONFIG' | 'SOURCE'>('CHAT');
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  const [loopEmotes, setLoopEmotes] = useState(false);
  
  // Transcription visual state
  const [transStyle, setTransStyle] = useState<TranscriptionStyle>(TranscriptionStyle.MARKER);
  const [transFontSize, setTransFontSize] = useState(56);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isBotTalking, setIsBotTalking] = useState(false);
  const [liveBotTranscription, setLiveBotTranscription] = useState('');
  
  const [visualMode, setVisualMode] = useState<VisualMode>(VisualMode.NONE);
  const [systemAlert, setSystemAlert] = useState<{ text: string, type: string } | null>(null);
  const [injectedStyles, setInjectedStyles] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const robotRef = useRef<RobotRef>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isColorSynced) setRobotColor(accentColor);
    if (isGridSynced) setGridColor(accentColor);
  }, [theme, isColorSynced, isGridSynced, accentColor]);

  useEffect(() => {
    if (isChatVisible && activeTab === 'CHAT') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveBotTranscription, isChatVisible, activeTab]);

  const stopVision = () => {
    if (visionIntervalRef.current) window.clearInterval(visionIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setVisualMode(VisualMode.NONE);
    streamRef.current = null;
  };

  const startVision = async (mode: VisualMode) => {
    stopVision();
    try {
      let stream: MediaStream;
      if (mode === VisualMode.CAMERA) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      } else if (mode === VisualMode.SCREEN) {
        stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { width: 1280, height: 720 } });
      } else return;
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setVisualMode(mode);

      visionIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !liveSessionRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 320;
          canvasRef.current.height = 240;
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
          liveSessionRef.current.sendVisualFrame(base64Data);
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setVisualMode(VisualMode.NONE);
    }
  };

  const toggleLiveVoice = async () => {
    if (isLiveActive) { 
      liveSessionRef.current?.close(); 
      setIsLiveActive(false); 
      stopVision();
      return; 
    }
    try {
      const callbacks: LiveCallbacks = {
        onAudioChunk: () => setIsBotTalking(true),
        onInterrupted: () => setIsBotTalking(false),
        onTranscription: (text, isUser) => {
          if (!isUser) { setLiveBotTranscription(text); setIsBotTalking(true); }
        },
        onToolCall: async (functionCalls) => {
          for (const fc of functionCalls) {
            if (fc.name === 'set_visual_mode') {
              const mode = fc.args.mode as VisualMode;
              if (mode === 'none') stopVision(); else startVision(mode);
              setSystemAlert({ text: `NEURAL SIGHT: ${mode.toUpperCase()} ACTIVE`, type: 'info' });
            }
            if (fc.name === 'set_transcription_style') {
              setTransStyle(fc.args.style as TranscriptionStyle);
              setSystemAlert({ text: `TRANSCRIPTION REWRITE: ${fc.args.style.toUpperCase()}`, type: 'code_rewrite' });
            }
            if (fc.name === 'set_transcription_size') {
              setTransFontSize(fc.args.size);
              setSystemAlert({ text: `TRANSCRIPTION SCALE: ${fc.args.size}PX`, type: 'info' });
            }
            if (fc.name === 'inject_neural_style') {
              setInjectedStyles(prev => prev + '\n' + fc.args.css);
              setSystemAlert({ text: "SYSTEM REWRITE: CSS INJECTED", type: 'code_rewrite' });
            }
            if (fc.name === 'system_broadcast') {
              setSystemAlert({ text: fc.args.text, type: fc.args.type });
            }
            if (fc.name === 'generate_image') {
              const imgData = await generateImage(fc.args.prompt, theme, artStyle);
              if (imgData) {
                setMessages(prev => [...prev, {
                  id: `live-art-${Date.now()}`,
                  role: MessageRole.BOT,
                  text: `NEURAL MURAL: "${fc.args.prompt}"`,
                  imageUrl: imgData
                }]);
              }
            }
            if (fc.name === 'set_system_theme') setTheme(fc.args.theme as SystemTheme);
            if (fc.name === 'set_robot_style') setRobotStyle(fc.args.style as RobotStyle);
            if (fc.name === 'set_robot_finish') setRobotFinish(fc.args.finish as RobotFinish);
            if (fc.name === 'set_robot_scale') setRobotSize(fc.args.scale);
            if (fc.name === 'trigger_emote') robotRef.current?.triggerAnimation(fc.args.emote as RobotAnimation, !!fc.args.loop);
          }
        },
        onTurnComplete: (userText, botText) => { 
          setIsBotTalking(false); 
          setLiveBotTranscription(''); 
          // Persist live session into chat history for copy/paste
          if (userText.trim() || botText.trim()) {
            const history: ChatMessage[] = [];
            if (userText.trim()) history.push({ id: `live-u-${Date.now()}`, role: MessageRole.USER, text: userText.trim() });
            if (botText.trim()) history.push({ id: `live-b-${Date.now()}`, role: MessageRole.BOT, text: botText.trim() });
            setMessages(prev => [...prev, ...history]);
          }
        },
        onError: () => setIsLiveActive(false),
        onClose: () => setIsLiveActive(false)
      };
      liveSessionRef.current = connectLive(theme, callbacks);
      setIsLiveActive(true);
    } catch (err) { alert("Neural voice error."); }
  };

  const handleManualArtGen = async () => {
    if (!artPrompt.trim()) return;
    setIsPainting(true);
    try {
      const imgData = await generateImage(artPrompt, theme, artStyle);
      if (imgData) {
        setMessages(prev => [...prev, {
          id: `art-${Date.now()}`,
          role: MessageRole.BOT,
          text: `NEURAL MURAL COMPLETE: "${artPrompt}"`,
          imageUrl: imgData
        }]);
        setArtPrompt('');
        setImagePreviewUrl(imgData); 
        setActiveTab('CHAT');
      }
    } finally {
      setIsPainting(false);
    }
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
      await getGeminiResponse(userMsg.text, theme, (chunk, sources) => { 
        acc += chunk; 
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: acc, sources } : m)); 
      });
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
    } finally { setIsLoading(false); }
  };

  const saveSettings = () => {
    setSaveStatus('SAVING');
    localStorage.setItem('g9_system_theme', theme);
    setTimeout(() => {
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    }, 800);
  };

  useEffect(() => {
    if (systemAlert) {
      const timer = setTimeout(() => setSystemAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [systemAlert]);

  // Helper to get transcription classes
  const getTranscriptionClass = (style: TranscriptionStyle) => {
    switch(style) {
      case TranscriptionStyle.CHUNKY_3D: return 'font-bungee style-3d-pop floating-text';
      case TranscriptionStyle.GHOST: return 'font-bungee-outline style-ghost-glow';
      case TranscriptionStyle.OUTLINE: return 'font-marker style-street-outline';
      case TranscriptionStyle.MONOTRON: return 'font-monoton tracking-tighter brightness-150';
      default: return 'font-marker style-street-outline neon-text'; // The "G-9 Letters" look requested
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white flex flex-col transition-all duration-700">
      <style>{injectedStyles}</style>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 z-0">
        <RobotCanvas 
          ref={robotRef} 
          style={robotStyle} 
          finish={robotFinish}
          size={robotSize} 
          mood={isBotTalking ? RobotVisualMood.TALKING : robotMood} 
          theme={theme} 
          environment={EnvironmentType.NONE} 
          color={robotColor}
          gridColor={gridColor}
          overheadLight={{ color: '#ffffff', intensity: 400, position: { x: 0, y: 20, z: 5 } }}
          accentLight={{ color: accentColor, intensity: 150, position: { x: 0, y: 4, z: 10 } }}
          useManualLighting={false}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 pointer-events-none">
        <header className="pointer-events-auto flex justify-between items-start w-full">
          <div>
            <h1 className="font-marker text-xl md:text-3xl neon-text transition-all duration-500" style={{ color: accentColor }}>G-9 SOVEREIGN</h1>
            <p className="text-[10px] font-black tracking-widest opacity-40">ACCESS: LEVEL 0 // FULL ROOT</p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={toggleLiveVoice} className={`flex items-center gap-2 px-6 py-2 rounded-full border-2 font-bold transition-all pointer-events-auto text-[10px] md:text-xs shadow-lg ${isLiveActive ? 'bg-red-600 border-red-400' : 'bg-black/60 hover:bg-white/10'}`} style={!isLiveActive ? { borderColor: accentColor, color: accentColor } : {}}>
              <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
              <span>{isLiveActive ? 'TERMINATE' : 'NEURAL LINK'}</span>
            </button>
          </div>
        </header>

        {systemAlert && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-[100] animate-in slide-in-from-top duration-300">
             <div className={`px-6 py-3 rounded-full font-black text-[10px] tracking-[0.3em] uppercase border-2 shadow-2xl ${systemAlert.type === 'code_rewrite' ? 'bg-emerald-500 border-emerald-300 text-black' : 'bg-black/80 text-white'}`} style={systemAlert.type !== 'code_rewrite' ? { borderColor: accentColor } : {}}>
                {systemAlert.text}
             </div>
          </div>
        )}

        {isLiveActive && liveBotTranscription && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6">
            <p 
              className={`text-center transition-all duration-300 ${getTranscriptionClass(transStyle)}`} 
              style={{ 
                color: '#fff', 
                fontSize: `${transFontSize}px`, 
                maxWidth: '90%', 
                textShadow: transStyle === TranscriptionStyle.MARKER ? `0 0 15px ${accentColor}` : undefined 
              }}
            >
              {liveBotTranscription}
            </p>
          </div>
        )}

        {visualMode !== VisualMode.NONE && (
          <div className="fixed top-24 right-4 md:right-8 w-40 h-30 md:w-64 md:h-48 rounded-2xl border-2 overflow-hidden shadow-2xl z-20 transition-all duration-500 pointer-events-auto" style={{ borderColor: accentColor }}>
            <video ref={(el) => { if (el && streamRef.current) el.srcObject = streamRef.current; }} autoPlay muted className="w-full h-full object-cover" />
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 rounded text-[8px] font-black uppercase tracking-tighter" style={{ color: accentColor }}>
              SOVEREIGN SIGHT // {visualMode}
            </div>
          </div>
        )}

        <div className="mt-auto w-full flex flex-col items-center pb-8">
          <button onClick={() => setIsChatVisible(true)} className="pointer-events-auto group relative mb-4">
              <div className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-80 transition-all duration-500 rounded-full" style={{ backgroundColor: accentColor }}></div>
              <div className="relative bg-black/80 border-2 px-12 py-5 rounded-full font-marker tracking-widest uppercase transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl" style={{ borderColor: accentColor, color: accentColor }}>
                 CONSOLE
              </div>
          </button>

          {isChatVisible && (
            <main className="fixed inset-x-0 bottom-0 z-50 w-full max-w-4xl mx-auto flex flex-col pointer-events-auto bg-black border-t-2 overflow-hidden h-[85dvh] transition-all duration-500 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]" style={{ borderColor: accentColor }}>
              <div className="flex bg-zinc-900 border-b border-white/10 shrink-0">
                <button onClick={() => setActiveTab('CHAT')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'CHAT' ? 'bg-white/5' : 'opacity-40'}`} style={activeTab === 'CHAT' ? { color: accentColor } : {}}>CHAT</button>
                <button onClick={() => setActiveTab('CONFIG')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'CONFIG' ? 'bg-white/5' : 'opacity-40'}`} style={activeTab === 'CONFIG' ? { color: accentColor } : {}}>CONFIG</button>
                <button onClick={() => setActiveTab('SOURCE')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'SOURCE' ? 'bg-white/5' : 'opacity-40'}`} style={activeTab === 'SOURCE' ? { color: accentColor } : {}}>SOURCE</button>
                <button onClick={() => setIsChatVisible(false)} className="px-8 py-4 font-bold hover:bg-white/10 transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'CHAT' && (
                  <div className="flex flex-col h-full p-4 md:p-8">
                    <div className="flex-1 space-y-4 mb-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm font-bold border-l-4 ${msg.role === MessageRole.USER ? 'bg-zinc-800' : 'bg-zinc-950'}`} style={msg.role !== MessageRole.USER ? { borderColor: accentColor } : {}}>
                            {msg.text}
                            {msg.imageUrl && <img src={msg.imageUrl} className="mt-3 rounded-xl max-h-72 w-full object-cover shadow-2xl cursor-pointer" onClick={() => setImagePreviewUrl(msg.imageUrl || null)} />}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2 p-2 bg-zinc-900/50 rounded-2xl border border-white/5 sticky bottom-0">
                      <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="NEURAL COMMAND..." className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:opacity-20 font-bold" />
                      <button onClick={handleSendMessage} disabled={isLoading} className="px-8 rounded-xl font-bold transition-transform active:scale-95 shadow-lg" style={{ backgroundColor: accentColor, color: '#000' }}>⚡</button>
                    </div>
                  </div>
                )}

                {activeTab === 'SOURCE' && (
                  <div className="p-4 md:p-8 space-y-4">
                    <div className="font-mono text-[10px] space-y-4 bg-zinc-950 p-6 rounded-2xl border border-white/5">
                      <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-[0.2em]">Live Injected Neural Styles</h3>
                      <pre className="whitespace-pre-wrap text-emerald-200/60 leading-relaxed">
                        {injectedStyles || "/* No sovereign code writes detected. */"}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTab === 'CONFIG' && (
                   <div className="p-4 md:p-8 space-y-10 uppercase">
                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">NEURAL ART ENGINE</h3>
                      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-5">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ART STYLE</label>
                            <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer">
                              {Object.values(ArtStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">SUBJECT PROMPT</label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={artPrompt} 
                                onChange={(e) => setArtPrompt(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && handleManualArtGen()}
                                placeholder="PAINT ME A..." 
                                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none" 
                              />
                              <button onClick={handleManualArtGen} disabled={isPainting} className="px-8 rounded-xl font-black transition-all hover:brightness-125 shadow-lg text-xs" style={{ backgroundColor: accentColor, color: '#000' }}>{isPainting ? 'GEN...' : 'GEN'}</button>
                            </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">INTERFACE SYSTEMS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">SYSTEM THEME</label>
                            <select value={theme} onChange={(e) => setTheme(e.target.value as SystemTheme)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer">
                              {Object.values(SystemTheme).map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">TRANSCRIPTION POP</label>
                            <select value={transStyle} onChange={(e) => setTransStyle(e.target.value as TranscriptionStyle)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer">
                              {Object.values(TranscriptionStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                        </div>
                      </div>
                      <div className="space-y-4 pt-4 bg-zinc-900/40 p-6 rounded-3xl border border-white/5">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">TRANSCRIPTION SIZE</label>
                            <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{transFontSize}PX</span>
                          </div>
                          <input type="range" min="32" max="140" step="2" value={transFontSize} onChange={(e) => setTransFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-black tracking-[0.3em] opacity-30 border-b border-white/10 pb-2">ROBOTICS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">FORCE EMOTE</label>
                            <div className="flex gap-2">
                              <select onChange={(e) => e.target.value && robotRef.current?.triggerAnimation(e.target.value as RobotAnimation, loopEmotes)} className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none">
                                <option value="">TRIGGER ACTION...</option>
                                {Object.values(RobotAnimation).map(anim => <option key={anim} value={anim}>{anim.toUpperCase()}</option>)}
                              </select>
                              <button onClick={() => setLoopEmotes(!loopEmotes)} className={`px-4 rounded-xl border-2 font-black transition-all text-xs ${loopEmotes ? 'bg-white text-black border-white' : 'border-white/10 opacity-40'}`}>∞</button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ARMOR STYLE</label>
                            <select value={robotStyle} onChange={(e) => setRobotStyle(e.target.value as RobotStyle)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold outline-none cursor-pointer">
                              {Object.values(RobotStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                        </div>
                      </div>

                      <div className="space-y-6 bg-zinc-900/40 p-6 rounded-3xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">ARMOR PAINT</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-bold opacity-80">{robotColor}</span>
                                {isColorSynced && <span className="text-[8px] bg-white/20 px-2 py-0.5 rounded uppercase tracking-widest font-black">SYNCED</span>}
                            </div>
                            </div>
                            <div className="flex items-center gap-3">
                               <button onClick={() => setIsColorSynced(!isColorSynced)} className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all ${isColorSynced ? 'bg-white text-black border-white' : 'border-white/10 opacity-40 hover:opacity-100'}`}>
                                 {isColorSynced ? 'LOCK COLOR' : 'SYNC TO THEME'}
                               </button>
                               <input type="color" value={robotColor} onChange={(e) => { setRobotColor(e.target.value); setIsColorSynced(false); }} className="w-14 h-12 rounded-xl bg-transparent cursor-pointer border-none scale-125" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/5 pt-6">
                            <div className="flex flex-col">
                              <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">NEURAL GRID</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-bold opacity-80">{gridColor}</span>
                                {isGridSynced && <span className="text-[8px] bg-white/20 px-2 py-0.5 rounded uppercase tracking-widest font-black">SYNCED</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                               <button onClick={() => setIsGridSynced(!isGridSynced)} className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all ${isGridSynced ? 'bg-white text-black border-white' : 'border-white/10 opacity-40 hover:opacity-100'}`}>
                                 {isGridSynced ? 'LOCK GRID' : 'SYNC TO THEME'}
                               </button>
                               <input type="color" value={gridColor} onChange={(e) => { setGridColor(e.target.value); setIsGridSynced(false); }} className="w-14 h-12 rounded-xl bg-transparent cursor-pointer border-none scale-125" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-6">
                            <div className="flex justify-between items-end">
                              <label className="text-[10px] font-black opacity-40 tracking-[0.2em]">PHYSICAL SCALE</label>
                              <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{robotSize.toFixed(1)}X</span>
                            </div>
                            <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-white cursor-pointer" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button onClick={saveSettings} className="w-full py-5 rounded-2xl font-marker text-lg tracking-[0.2em] uppercase transition-all shadow-2xl hover:brightness-125 active:scale-[0.98]" style={{ backgroundColor: accentColor, color: '#000' }}>
                        {saveStatus === 'IDLE' ? 'SAVE CONFIG' : saveStatus}
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
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-6 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative max-w-full max-h-[90dvh] flex flex-col items-center">
              <div className="relative p-1 rounded-3xl overflow-hidden shadow-2xl scale-in-95 animate-in duration-300" style={{ backgroundColor: accentColor }}>
                <img src={imagePreviewUrl} className="max-w-full max-h-[70dvh] md:max-h-[75dvh] rounded-[calc(1.5rem-2px)] object-contain block" />
              </div>
              <div className="mt-6 flex flex-col md:flex-row gap-4 w-full justify-center">
                <button onClick={() => setImagePreviewUrl(null)} className="px-10 py-4 rounded-2xl font-black tracking-widest text-xs uppercase transition-all shadow-xl bg-zinc-900 border-2 hover:bg-zinc-800 text-white" style={{ borderColor: accentColor }}>CLOSE</button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
