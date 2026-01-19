
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
    return savedColor || '#000000';
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
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [themeSaveStatus, setThemeSaveStatus] = useState<'idle' | 'saved'>('idle');
  
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
        setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 HUSTLE CORE ONLINE. RESPECT THE BLOCK.' }]);
      }
    } else {
      setMessages([{ id: '1', role: MessageRole.SYSTEM, text: 'G-3 HUSTLE CORE ONLINE. RESPECT THE BLOCK.' }]);
    }
  }, []);

  useEffect(() => {
    if (isChatVisible) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, liveBotTranscription, isChatVisible]);

  const saveToLocalStorage = () => {
    localStorage.setItem('g3_chat_history', JSON.stringify(messages));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const saveThemeToLocalStorage = () => {
    localStorage.setItem('g3_system_theme', theme);
    localStorage.setItem('g3_environment', environment);
    localStorage.setItem('g3_robot_color', robotColor);
    setThemeSaveStatus('saved');
    setTimeout(() => setThemeSaveStatus('idle'), 2000);
  };

  const toggleTheme = () => {
    const themes = Object.values(SystemTheme);
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const toggleEnvironment = () => {
    const envs = Object.values(EnvironmentType);
    const currentIndex = envs.indexOf(environment);
    const nextEnv = envs[(currentIndex + 1) % envs.length];
    setEnvironment(nextEnv);
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
            if (fc.name === 'set_art_style') setArtStyle(fc.args.style as ArtStyle);
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
      robotRef.current?.triggerAnimation(RobotAnimation.YES);
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
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.BOT, text: `Neural mural complete [${artStyle.toUpperCase()}]: "${prompt}"`, imageUrl }]);
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

  const handleDownloadImage = () => {
    if (!imagePreviewUrl) return;
    const link = document.createElement('a');
    link.href = imagePreviewUrl;
    link.download = `g3-mural-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const { accent: accentColor, secondary: secondaryColor } = getThemeColors(theme);

  const renderMessageContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
        const lang = match?.[1] || 'sh';
        const code = match?.[2] || '';
        return (
          <div key={i} className="my-2 group/code relative rounded-xl overflow-hidden border-2 bg-black/80 font-mono text-[11px] md:text-[13px]" style={{ borderColor: accentColor + '44' }}>
            <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/5">
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">{lang}</span>
              <button onClick={() => navigator.clipboard.writeText(code)} className="text-[8px] font-bold uppercase" style={{ color: accentColor }}>COPY</button>
            </div>
            <pre className="p-2 overflow-x-auto whitespace-pre custom-scrollbar">
              <code className="block" style={{ color: accentColor }}>{code}</code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="select-text whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white selection:bg-neon-green selection:text-black flex flex-col">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <RobotCanvas ref={robotRef} style={robotStyle} size={robotSize} mood={robotMood} theme={theme} environment={environment} color={robotColor} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 pointer-events-none h-full overflow-hidden">
        <header className="pointer-events-auto flex justify-between items-start w-full mb-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-marker text-xl md:text-5xl -rotate-1 origin-left transition-colors duration-500 neon-text" style={{ color: accentColor }}>{theme.toUpperCase()}</h1>
            <p className="text-[7px] md:text-xs font-bold tracking-widest uppercase opacity-80" style={{ color: secondaryColor }}>// G-3 CORE</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleEnvironment} className="flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-3 rounded-full border-2 font-bold transition-all duration-300 pointer-events-auto shadow-lg text-[10px] md:text-base bg-black/50 hover:bg-white hover:text-black" style={{ borderColor: secondaryColor, color: secondaryColor }}>
              <span className="hidden xs:inline">WORLD</span>
            </button>
            <button onClick={toggleLiveVoice} className={`flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-3 rounded-full border-2 font-bold transition-all duration-300 pointer-events-auto shadow-lg text-[10px] md:text-base ${isLiveActive ? 'bg-red-600 border-red-400 animate-pulse text-white' : 'bg-black/50 hover:bg-white hover:text-black'}`} style={!isLiveActive ? { borderColor: accentColor, color: accentColor } : {}}>
              <span>{isLiveActive ? '⏹' : '🎤'}</span>
              <span className="hidden xs:inline">{isLiveActive ? 'STOP' : 'LIVE'}</span>
            </button>
          </div>
        </header>

        {/* Desktop Sidebar */}
        <aside className="absolute right-8 top-32 w-48 pointer-events-auto hidden lg:block space-y-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md space-y-4" style={{ borderColor: secondaryColor + '44' }}>
            <button onClick={toggleEnvironment} className="w-full py-2 rounded-lg border border-white/10 text-[10px] font-bold uppercase hover:bg-white hover:text-black transition-colors" style={{ color: secondaryColor }}>
              Next Background
            </button>
            <div className="flex flex-col gap-1">
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Robot Armor Tint</label>
              <input type="color" value={robotColor} onChange={(e) => setRobotColor(e.target.value)} className="w-full h-8 rounded-lg bg-black/50 border border-white/10 cursor-pointer overflow-hidden" />
            </div>
            <div>
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Robot Style</label>
              <select value={robotStyle} onChange={(e) => setRobotStyle(e.target.value as RobotStyle)} className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-2 text-[10px] font-bold uppercase focus:outline-none text-white" style={{ borderColor: secondaryColor + '44' }}>
                {Object.values(RobotStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Robot Scale</label>
              <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white" />
            </div>
            <div>
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Text Scale</label>
              <input type="range" min="12" max="120" step="1" value={transcriptionFontSize} onChange={(e) => setTranscriptionFontSize(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white" />
            </div>
            <div className="relative">
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Art Engine</label>
              <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-2 text-[10px] font-bold uppercase focus:outline-none text-white" style={{ borderColor: secondaryColor + '44' }}>
                {Object.values(ArtStyle).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Emotes</label>
              <select onChange={(e) => { const val = e.target.value as RobotAnimation; if (val) robotRef.current?.triggerAnimation(val); }} className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-2 text-[10px] font-bold uppercase focus:outline-none text-white" style={{ borderColor: secondaryColor + '44' }} defaultValue="">
                <option value="" disabled>SELECT EMOTE</option>
                <optgroup label="ACTIONS" className="bg-zinc-900">
                  <option value={RobotAnimation.GREET}>HI</option>
                  <option value={RobotAnimation.DANCE}>PARTY</option>
                  <option value={RobotAnimation.FLEX}>FLEX</option>
                  <option value={RobotAnimation.PUNCH}>STRIKE PROTOCOL</option>
                  <option value={RobotAnimation.ALERT}>NEURAL SURGE</option>
                </optgroup>
                <optgroup label="SYSTEM" className="bg-zinc-900">
                  <option value={RobotAnimation.CELEBRATE}>VICTORY</option>
                  <option value={RobotAnimation.YES}>AFFIRM</option>
                  <option value={RobotAnimation.NO}>DENY</option>
                  <option value={RobotAnimation.SHUTDOWN}>CRITICAL ERROR</option>
                </optgroup>
              </select>
            </div>
          </div>
        </aside>

        {/* Live Transcription Overlay */}
        {isLiveActive && liveBotTranscription && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6 pb-20">
            <div className="max-w-6xl w-full text-center">
              <p className="cool-spoken-words font-marker leading-tight transition-all duration-300" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #fff, ${secondaryColor})`, textShadow: `0 0 15px ${accentColor}66`, fontSize: `${transcriptionFontSize}px` }}>
                {liveBotTranscription}
              </p>
            </div>
          </div>
        )}

        {/* Mobile Unified Control Bottom Drawer */}
        <div className="mt-auto w-full flex flex-col items-center justify-end pointer-events-none pb-4">
          <div className="lg:hidden flex flex-col items-center w-full max-w-sm pointer-events-auto">
            {isMobileControlsOpen && (
              <div className="w-full bg-black/80 backdrop-blur-3xl border-2 border-white/10 rounded-3xl p-5 mb-4 shadow-2xl space-y-5 animate-[floatUp_0.2s_ease-out]" style={{ borderColor: accentColor + '66' }}>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: accentColor }}>SYSTEM CONFIG</h3>
                  <div className="flex gap-2">
                    <button onClick={toggleEnvironment} className="text-[8px] border border-white/20 px-2 py-0.5 rounded-full uppercase text-white">BG: {environment}</button>
                    <button onClick={toggleTheme} className="text-[8px] border border-white/20 px-2 py-0.5 rounded-full uppercase text-white">{theme}</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[8px] font-bold uppercase opacity-60" style={{ color: accentColor }}>Armor Color</span>
                    <input type="color" value={robotColor} onChange={(e) => setRobotColor(e.target.value)} className="w-12 h-6 rounded border border-white/10 bg-black/50" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-60" style={{ color: accentColor }}>
                      <span>Robot Scale</span>
                      <span>{robotSize.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-60" style={{ color: secondaryColor }}>
                      <span>Text Scale</span>
                      <span>{transcriptionFontSize}px</span>
                    </div>
                    <input type="range" min="12" max="120" step="1" value={transcriptionFontSize} onChange={(e) => setTranscriptionFontSize(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold uppercase opacity-40">Art Engine</span>
                      <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-[9px] font-bold uppercase focus:outline-none text-white">
                        {Object.values(ArtStyle).map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold uppercase opacity-40">Emote</span>
                      <select onChange={(e) => { const val = e.target.value as RobotAnimation; if (val) robotRef.current?.triggerAnimation(val); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-[9px] font-bold uppercase focus:outline-none text-white" defaultValue="">
                        <option value="" disabled className="bg-zinc-900">SELECT</option>
                        <option value={RobotAnimation.GREET} className="bg-zinc-900">HI</option>
                        <option value={RobotAnimation.DANCE} className="bg-zinc-900">DANCE</option>
                        <option value={RobotAnimation.FLEX} className="bg-zinc-900">FLEX</option>
                        <option value={RobotAnimation.PUNCH} className="bg-zinc-900">STRIKE</option>
                        <option value={RobotAnimation.ALERT} className="bg-zinc-900">SURGE</option>
                        <option value={RobotAnimation.YES} className="bg-zinc-900">AFFIRM</option>
                        <option value={RobotAnimation.NO} className="bg-zinc-900">DENY</option>
                        <option value={RobotAnimation.SHUTDOWN} className="bg-zinc-900">CRITICAL</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center pt-2 gap-3">
                  <button onClick={saveThemeToLocalStorage} className="text-[8px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all">SAVE CONFIG</button>
                  <button onClick={() => setIsMobileControlsOpen(false)} className="text-[8px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-white text-black">CLOSE</button>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 w-full px-4 mb-2">
              <button onClick={() => setIsMobileControlsOpen(!isMobileControlsOpen)} className={`flex-1 bg-black/80 backdrop-blur-xl border-2 border-white/10 font-bold py-3 rounded-2xl text-[10px] tracking-widest uppercase transition-all shadow-xl ${isMobileControlsOpen ? 'border-white text-white' : ''}`} style={!isMobileControlsOpen ? { color: accentColor, borderColor: accentColor + '44' } : {}}>
                {isMobileControlsOpen ? '⚙ CONFIG ACTIVE' : '⚙ SYSTEM CONFIG'}
              </button>
              <button onClick={() => setIsChatVisible(true)} className="flex-1 bg-black/90 border-2 font-marker text-sm py-3 rounded-2xl tracking-[0.2em] uppercase shadow-xl" style={{ color: accentColor, borderColor: accentColor }}>
                NEURAL LINK
              </button>
            </div>
          </div>

          {isChatVisible && (
            <main className="fixed inset-x-0 bottom-0 z-50 w-full max-w-4xl mx-auto flex flex-col pointer-events-auto animate-[floatUp_0.3s_ease-out] overflow-hidden h-[95dvh] lg:h-[80dvh] bg-black/95 lg:bg-transparent lg:relative lg:mb-4">
              <div className="flex-1 flex flex-col h-full bg-black/90 lg:border-2 lg:rounded-[2rem] p-4 backdrop-blur-3xl shadow-2xl relative border-t-2 border-white/10 lg:border-accent" style={{ borderColor: accentColor }}>
                
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 shrink-0">
                  <div className="flex gap-2 items-center">
                    <h2 className="text-[10px] font-bold tracking-widest uppercase" style={{ color: accentColor }}>NEURAL COMMAND</h2>
                    <button onClick={saveToLocalStorage} className="text-[8px] border px-2 py-0.5 rounded uppercase" style={{ color: accentColor, borderColor: accentColor }}>{saveStatus === 'saved' ? 'LOCKED' : 'SAVE'}</button>
                  </div>
                  <button onClick={() => setIsChatVisible(false)} className="rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border hover:bg-white hover:text-black transition-colors" style={{ color: accentColor, borderColor: accentColor }}>✕</button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4 custom-scrollbar pb-4 overscroll-y-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
                      {msg.role === MessageRole.SYSTEM ? (
                        <div className="w-full text-center my-1 opacity-40"><span className="text-[7px] font-bold uppercase tracking-[0.3em]">{msg.text}</span></div>
                      ) : (
                        <div className={`group relative max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 text-[13px] md:text-[14px] font-medium transition-all ${msg.role === MessageRole.USER ? 'bg-white/5 border-r-2 rounded-tr-none' : 'bg-white/10 border-l-2 rounded-tl-none'}`} style={msg.role === MessageRole.USER ? { borderColor: secondaryColor } : { borderColor: accentColor, color: accentColor }}>
                          <div className="flex flex-col gap-1 overflow-hidden">
                            {renderMessageContent(msg.text)}
                            {msg.imageUrl && (
                              <div className="mt-2 overflow-hidden rounded-lg border border-white/10 max-h-[220px]">
                                <img src={msg.imageUrl} className="w-full h-full object-cover" onClick={() => setImagePreviewUrl(msg.imageUrl || null)}/>
                              </div>
                            )}
                            {msg.sources && (
                              <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                                {msg.sources.map((s, idx) => <a key={idx} href={s.uri} target="_blank" className="text-[8px] px-1.5 py-0.5 rounded border border-white/10" style={{ color: accentColor }}>{s.title}</a>)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="mt-4 flex gap-2 items-center pb-2 shrink-0">
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="SYSTEM COMMAND..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none font-mono text-white" style={{ borderColor: accentColor + '44' }} />
                  <button onClick={handleSendMessage} disabled={isLoading} className="font-bold p-3 rounded-2xl text-[9px] text-white shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: accentColor }}>⚡ EXEC</button>
                  <button onClick={handleGenerateArt} disabled={isLoading} className="font-bold p-3 rounded-2xl text-[9px] text-white shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: secondaryColor }}>🎨 GEN</button>
                </div>
              </div>
            </main>
          )}
        </div>
      </div>

      {imagePreviewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-10 animate-in fade-in zoom-in duration-300">
          <button onClick={() => setImagePreviewUrl(null)} className="fixed top-6 right-6 z-[120] flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-xl text-white font-bold shadow-lg">✕</div>
          </button>
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4">
            <div className="bg-black p-1 border-2 rounded-3xl overflow-hidden shadow-2xl w-full" style={{ borderColor: accentColor }}>
              <img src={imagePreviewUrl} className="w-full h-auto max-h-[75dvh] object-contain rounded-2xl" />
              <div className="flex w-full mt-1 gap-1">
                <div className="flex-1 text-white py-3 px-4 font-marker text-sm uppercase flex items-center justify-center rounded-bl-2xl" style={{ backgroundColor: accentColor }}>MURAL // {artStyle}</div>
                <button onClick={handleDownloadImage} className="bg-white text-black py-3 px-6 font-bold text-[10px] uppercase rounded-br-2xl">DOWNLOAD</button>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 z-[-1]" onClick={() => setImagePreviewUrl(null)} />
        </div>
      )}

      <style>{`
        @keyframes floatUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .cool-spoken-words { -webkit-background-clip: text; background-clip: text; color: transparent; animation: glitch-text 2s infinite linear alternate-reverse; }
        @keyframes glitch-text {
          0% { transform: translate(0); text-shadow: 1px 1px ${secondaryColor}, -1px -1px ${accentColor}; }
          40% { transform: translate(-0.5px, -0.5px); text-shadow: -1px 1px ${secondaryColor}, 1px -1px ${accentColor}; }
          100% { transform: translate(0); }
        }
        
        @media (max-width: 480px) {
          .xs\\:inline { display: inline !important; }
        }

        /* Prevent zooming on iOS input focus */
        input[type="text"], select {
          font-size: 16px !important;
        }
      `}</style>
    </div>
  );
};

export default App;
