
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
  SystemTheme
} from './types';
import RobotCanvas, { RobotRef } from './components/RobotCanvas';

const App: React.FC = () => {
  const [theme, setTheme] = useState<SystemTheme>(() => {
    const savedTheme = localStorage.getItem('g3_system_theme');
    return (savedTheme as SystemTheme) || SystemTheme.HOOD;
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [robotStyle, setRobotStyle] = useState<RobotStyle>(RobotStyle.STEALTH); 
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.STREET);
  const [robotSize, setRobotSize] = useState(1.0);
  const [robotMood, setRobotMood] = useState<RobotVisualMood>(RobotVisualMood.NONE);
  const [isChatVisible, setIsChatVisible] = useState(false);
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveBotTranscription, isChatVisible]);

  useEffect(() => {
    if (isLoading) {
      setRobotMood(RobotVisualMood.LOADING);
    } else if (isBotTalking) {
      setRobotMood(RobotVisualMood.TALKING);
    } else {
      setRobotMood(RobotVisualMood.NONE);
    }
  }, [isLoading, isBotTalking]);

  const saveToLocalStorage = () => {
    localStorage.setItem('g3_chat_history', JSON.stringify(messages));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const saveThemeToLocalStorage = () => {
    localStorage.setItem('g3_system_theme', theme);
    setThemeSaveStatus('saved');
    setTimeout(() => setThemeSaveStatus('idle'), 2000);
  };

  const clearHistory = () => {
    if (window.confirm("PURGE ALL NEURAL RECORDS?")) {
      const initialMsg = [{ id: '1', role: MessageRole.SYSTEM, text: 'RECORDS PURGED. RE-INITIALIZED.' }];
      setMessages(initialMsg);
      localStorage.removeItem('g3_chat_history');
    }
  };

  const toggleTheme = () => {
    const themes = Object.values(SystemTheme);
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    setTheme(nextTheme);
    setMessages(prev => [...prev, { 
      id: `sys-${Date.now()}`, 
      role: MessageRole.SYSTEM, 
      text: `SYSTEM OVERRIDE: SWITCHING TO ${nextTheme.toUpperCase()} AESTHETIC.` 
    }]);
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
        onAudioChunk: () => {
          // DECISIVE FIX: We only set the talking state. 
          // We do NOT trigger animations here anymore to save main-thread bandwidth for audio.
          if (!isBotTalking) {
            setIsBotTalking(true);
            // Just a single nod at the start of a turn, not every packet.
            robotRef.current?.triggerAnimation(RobotAnimation.YES);
          }
        },
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
          // Throttled emote detection
          if (text.length % 5 === 0) detectKeywordEmotes(text);
        },
        onToolCall: async (functionCalls) => {
          for (const fc of functionCalls) {
            if (fc.name === 'generate_image') handleGenerateArtFromPrompt(fc.args.prompt);
            if (fc.name === 'toggle_command_window') setIsChatVisible(fc.args.visible);
            if (fc.name === 'set_system_theme') setTheme(fc.args.theme as SystemTheme);
            if (fc.name === 'set_robot_scale') setRobotSize(Math.max(0.5, Math.min(2.0, fc.args.scale)));
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

  const detectKeywordEmotes = (text: string) => {
    const low = text.toLowerCase();
    if (low.includes("celebrate") || low.includes("victory")) robotRef.current?.triggerAnimation(RobotAnimation.CELEBRATE);
    else if (low.includes("ponder") || low.includes("think")) robotRef.current?.triggerAnimation(RobotAnimation.PONDER);
    else if (low.includes("alert") || low.includes("danger")) robotRef.current?.triggerAnimation(RobotAnimation.ALERT);
    else if (low.includes("flex") || low.includes("muscle")) robotRef.current?.triggerAnimation(RobotAnimation.FLEX);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, text: inputText };
    setMessages(prev => [...prev, userMsg]);
    detectKeywordEmotes(inputText);
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
          <div key={i} className="my-2 group/code relative rounded-xl overflow-hidden border-2 bg-black/80 font-mono text-[12px] md:text-[13px]" style={{ borderColor: accentColor + '44' }}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{lang} TERMINAL</span>
              <button 
                onClick={() => navigator.clipboard.writeText(code)}
                className="text-[9px] font-bold uppercase opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                style={{ color: accentColor }}
              >
                <span>[</span> COPY <span>]</span>
              </button>
            </div>
            <pre className="p-3 overflow-x-auto whitespace-pre custom-scrollbar scrollbar-horizontal">
              <code className="block" style={{ color: accentColor }}>
                {code.split('\n').map((line, j) => (
                  <div key={j} className="flex gap-3">
                    <span className="opacity-20 select-none text-right w-3">{j + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="select-text whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white selection:bg-neon-green selection:text-black flex flex-col">
      {/* Background Robot Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <RobotCanvas ref={robotRef} style={robotStyle} size={robotSize} mood={robotMood} theme={theme} />
      </div>

      {/* Full-screen UI Overlays */}
      <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 pointer-events-none h-full overflow-hidden">
        
        {/* Header Section */}
        <header className="pointer-events-auto flex justify-between items-start w-full mb-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-marker text-2xl md:text-5xl -rotate-1 origin-left transition-colors duration-500 neon-text" style={{ color: accentColor }}>{theme.toUpperCase()}</h1>
            <p className="text-[9px] md:text-xs font-bold tracking-widest uppercase opacity-80" style={{ color: secondaryColor }}>// COMPANION CORE</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={toggleTheme} className="px-2 py-1 rounded border font-bold text-[8px] tracking-widest uppercase hover:bg-white hover:text-black transition-all" style={{ color: accentColor, borderColor: accentColor }}>🔄 STYLE</button>
              <button onClick={saveThemeToLocalStorage} className={`px-2 py-1 rounded border font-bold text-[8px] tracking-widest uppercase transition-all ${themeSaveStatus === 'saved' ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`} style={{ color: themeSaveStatus === 'saved' ? 'black' : secondaryColor, borderColor: secondaryColor }}>{themeSaveStatus === 'saved' ? '🔒 LOCKED' : '💾 SAVE'}</button>
            </div>
          </div>
          
          <button onClick={toggleLiveVoice} className={`flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 rounded-full border-2 font-bold transition-all duration-300 pointer-events-auto shadow-lg text-xs md:text-base ${isLiveActive ? 'bg-red-600 border-red-400 animate-pulse text-white' : 'bg-black/50 hover:bg-white hover:text-black'}`} style={!isLiveActive ? { borderColor: accentColor, color: accentColor } : {}}>
            <span>{isLiveActive ? '⏹' : '🎤'}</span>
            <span className="hidden sm:inline">{isLiveActive ? 'DISCONNECT' : 'GEMINI LIVE'}</span>
          </button>
        </header>

        {/* Sidebar - Desktop Only */}
        <aside className="absolute right-8 top-32 w-48 pointer-events-auto hidden lg:block space-y-4">
          <div className="bg-black/60 border rounded-2xl p-4 backdrop-blur-md space-y-4" style={{ borderColor: secondaryColor + '44' }}>
            <div>
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Robot Scale</label>
              <input type="range" min="0.5" max="2" step="0.1" value={robotSize} onChange={(e) => setRobotSize(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white" />
            </div>
            
            <div className="relative">
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Art Engine</label>
              <div className="relative">
                <select 
                  value={artStyle} 
                  onChange={(e) => setArtStyle(e.target.value as ArtStyle)} 
                  className="w-full bg-black/80 border rounded-lg px-2 py-2 text-[10px] font-bold uppercase focus:outline-none appearance-none cursor-pointer pr-8 hover:bg-black transition-colors"
                  style={{ color: secondaryColor, borderColor: secondaryColor + '44' }}
                >
                  {Object.values(ArtStyle).map(s => (
                    <option key={s} value={s} className="bg-zinc-900 text-white font-mono">{s.toUpperCase()}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" style={{ color: secondaryColor }}>▼</div>
              </div>
            </div>

            <div className="relative">
              <label className="block font-bold text-[10px] mb-1 uppercase opacity-60" style={{ color: accentColor }}>Neural Emotes</label>
              <div className="relative">
                <select 
                  onChange={(e) => {
                    const val = e.target.value as RobotAnimation;
                    if (val) robotRef.current?.triggerAnimation(val);
                  }} 
                  className="w-full bg-black/80 border rounded-lg px-2 py-2 text-[10px] font-bold uppercase focus:outline-none appearance-none cursor-pointer pr-8 hover:bg-black transition-colors"
                  style={{ color: secondaryColor, borderColor: secondaryColor + '44' }}
                  defaultValue=""
                >
                  <option value="" disabled className="bg-zinc-900 text-white/40">SELECT EMOTE</option>
                  <optgroup label="ACTIONS" className="bg-zinc-900 text-white/60">
                    <option value={RobotAnimation.GREET}>GREETING</option>
                    <option value={RobotAnimation.DANCE}>PARTY MODE</option>
                    <option value={RobotAnimation.FLEX}>FLEX MUSCLE</option>
                    <option value={RobotAnimation.WAVE}>SAY HI</option>
                  </optgroup>
                  <optgroup label="EMOTIONS" className="bg-zinc-900 text-white/60">
                    <option value={RobotAnimation.CELEBRATE}>VICTORY</option>
                    <option value={RobotAnimation.PONDER}>THINKING</option>
                    <option value={RobotAnimation.SHOCK}>SURPRISE</option>
                    <option value={RobotAnimation.SULK}>DISAPPOINTED</option>
                  </optgroup>
                  <optgroup label="SYSTEM" className="bg-zinc-900 text-white/60">
                    <option value={RobotAnimation.ALERT}>SECURITY ALERT</option>
                    <option value={RobotAnimation.SHUTDOWN}>GO OFFLINE</option>
                    <option value={RobotAnimation.YES}>AFFIRMATIVE</option>
                    <option value={RobotAnimation.NO}>NEGATIVE</option>
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" style={{ color: secondaryColor }}>▼</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Live Transcription Overlay */}
        {isLiveActive && liveBotTranscription && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6 pb-20">
            <div className="max-w-4xl w-full text-center">
              <p className="cool-spoken-words font-marker text-2xl md:text-5xl leading-tight" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #fff, ${secondaryColor})`, textShadow: `0 0 15px ${accentColor}66` }}>{liveBotTranscription}</p>
            </div>
          </div>
        )}

        {/* Chat Component */}
        <div className="mt-auto w-full flex flex-col items-center justify-end pointer-events-none">
          {!isChatVisible && (
            <div className="mb-4 pointer-events-auto px-4 lg:hidden w-full max-w-xs flex flex-col gap-2">
               <div className="relative">
                <select 
                  value={artStyle} 
                  onChange={(e) => setArtStyle(e.target.value as ArtStyle)} 
                  className="w-full bg-black/60 backdrop-blur-md border rounded-full px-4 py-2 text-[10px] font-bold uppercase focus:outline-none appearance-none cursor-pointer text-center"
                  style={{ color: accentColor, borderColor: accentColor + '44' }}
                >
                  {Object.values(ArtStyle).map(s => (
                    <option key={s} value={s} className="bg-zinc-900 text-white">{s.toUpperCase()} MODE</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" style={{ color: accentColor }}>▼</div>
              </div>
              
              <div className="relative">
                <select 
                  onChange={(e) => {
                    const val = e.target.value as RobotAnimation;
                    if (val) robotRef.current?.triggerAnimation(val);
                  }} 
                  className="w-full bg-black/60 backdrop-blur-md border rounded-full px-4 py-2 text-[10px] font-bold uppercase focus:outline-none appearance-none cursor-pointer text-center"
                  style={{ color: accentColor, borderColor: accentColor + '44' }}
                  defaultValue=""
                >
                  <option value="" disabled className="bg-zinc-900 text-white/40">EMOTE</option>
                  <option value={RobotAnimation.CELEBRATE}>VICTORY</option>
                  <option value={RobotAnimation.DANCE}>DANCE</option>
                  <option value={RobotAnimation.FLEX}>FLEX</option>
                  <option value={RobotAnimation.SHOCK}>SHOCK</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" style={{ color: accentColor }}>▼</div>
              </div>
            </div>
          )}

          {isChatVisible ? (
            <main className="w-full max-w-4xl flex flex-col pointer-events-auto animate-[floatUp_0.3s_ease-out] overflow-hidden max-h-[80dvh] md:max-h-[85dvh] lg:max-h-[80dvh] mb-4">
              <div className="bg-black/90 border-2 rounded-t-[2rem] p-4 md:p-6 flex flex-col backdrop-blur-3xl shadow-2xl relative border-b-0" style={{ borderColor: accentColor }}>
                
                {/* Chat Header Actions */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 shrink-0">
                  <div className="flex gap-2">
                    <button onClick={saveToLocalStorage} className="px-2 py-0.5 rounded border text-[8px] font-bold uppercase transition-all hover:bg-white hover:text-black" style={{ color: accentColor, borderColor: accentColor }}>{saveStatus === 'saved' ? 'SAVED' : 'SAVE'}</button>
                    <button onClick={clearHistory} className="px-2 py-0.5 rounded border text-[8px] font-bold uppercase hover:bg-red-600 hover:text-white transition-all" style={{ color: '#ff4444', borderColor: '#ff4444' }}>PURGE</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={artStyle} 
                      onChange={(e) => setArtStyle(e.target.value as ArtStyle)}
                      className="bg-transparent border-0 text-[10px] font-bold uppercase focus:outline-none cursor-pointer text-right pr-4"
                      style={{ color: accentColor }}
                    >
                      {Object.values(ArtStyle).map(s => (
                        <option key={s} value={s} className="bg-zinc-900 text-white">{s.toUpperCase()}</option>
                      ))}
                    </select>
                    <button onClick={() => setIsChatVisible(false)} className="rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border hover:bg-white hover:text-black" style={{ color: accentColor, borderColor: accentColor }}>✕</button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar pb-2 min-h-[100px]">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
                      {msg.role === MessageRole.SYSTEM ? (
                        <div className="w-full text-center my-1 opacity-40">
                          <span className="text-[8px] font-bold uppercase tracking-[0.3em]">{msg.text}</span>
                        </div>
                      ) : (
                        <div className={`group relative max-w-[95%] md:max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] font-medium transition-all ${msg.role === MessageRole.USER ? 'bg-white/5 border-r-2 rounded-tr-none' : 'bg-white/10 border-l-2 rounded-tl-none'}`} style={msg.role === MessageRole.USER ? { borderColor: secondaryColor } : { borderColor: accentColor, color: accentColor }}>
                          <div className="flex flex-col gap-1 overflow-hidden">
                            {renderMessageContent(msg.text)}
                            {msg.imageUrl && (
                              <div className="mt-2 overflow-hidden rounded-lg border border-white/10 max-h-[200px]">
                                <img src={msg.imageUrl} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setImagePreviewUrl(msg.imageUrl || null)}/>
                              </div>
                            )}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                                {msg.sources.map((s, idx) => (
                                  <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 hover:bg-white/10" style={{ color: accentColor }}>{s.title}</a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="mt-4 flex gap-2 items-center shrink-0">
                  <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                    placeholder="COMMAND..." 
                    className="flex-1 bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none placeholder:opacity-20 font-mono" 
                    style={{ color: accentColor, borderColor: accentColor + '44' }} 
                  />
                  
                  <button 
                    onClick={handleSendMessage} 
                    disabled={isLoading} 
                    className="font-bold px-4 py-3 rounded-xl text-[10px] md:text-xs active:scale-95 text-black flex items-center gap-1.5 shadow-lg transition-transform" 
                    style={{ backgroundColor: accentColor }}
                  >
                    <span>EXEC</span>
                    <span className="text-sm">⚡</span>
                  </button>
                  
                  <button 
                    onClick={handleGenerateArt} 
                    disabled={isLoading} 
                    title={`Generate ${artStyle} art`} 
                    className="font-bold px-4 py-3 rounded-xl text-[10px] md:text-xs active:scale-95 shadow-lg flex items-center gap-1.5 transition-transform" 
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <span>GEN</span>
                    <span className="text-sm">🎨</span>
                  </button>
                </div>
              </div>
            </main>
          ) : (
            <button onClick={() => setIsChatVisible(true)} className="bg-black/90 pointer-events-auto font-bold px-8 py-3 md:px-12 md:py-4 rounded-full border-2 font-marker text-base md:text-xl tracking-widest uppercase shadow-xl hover:scale-105 active:scale-95 mb-6 md:mb-10" style={{ color: accentColor, borderColor: accentColor }}>NEURAL LINK</button>
          )}
        </div>
      </div>

      {/* Full-screen Image Preview Modal */}
      {imagePreviewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-10 animate-in fade-in zoom-in duration-300">
          
          <button 
            onClick={() => setImagePreviewUrl(null)} 
            className="fixed top-6 right-6 md:top-10 md:right-10 z-[120] flex flex-col items-center gap-1 group pointer-events-auto"
            aria-label="Close Preview"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 border-4 border-white flex items-center justify-center text-3xl md:text-4xl text-white font-bold shadow-[0_0_30px_rgba(220,38,38,0.8)] group-hover:scale-110 group-active:scale-90 transition-all">
              ✕
            </div>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white drop-shadow-md">CLOSE</span>
          </button>

          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4 pointer-events-auto">
            
            <div className="bg-black p-2 border-4 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full relative" style={{ borderColor: accentColor }}>
              
              <img 
                src={imagePreviewUrl} 
                className="w-full h-auto max-h-[70dvh] object-contain rounded-2xl" 
                alt="Preview" 
              />
              
              <div className="flex w-full mt-2 gap-2">
                <div className="flex-1 text-black py-4 px-6 font-marker text-lg uppercase flex items-center justify-center rounded-bl-2xl shadow-inner" style={{ backgroundColor: accentColor }}>
                  {artStyle.toUpperCase()} MURAL
                </div>
                <button 
                  onClick={handleDownloadImage}
                  className="bg-white text-black py-4 px-8 font-bold text-sm uppercase rounded-br-2xl hover:bg-gray-200 active:scale-95 transition-all flex items-center gap-3 shadow-lg"
                >
                  <span className="text-2xl">💾</span> DOWNLOAD
                </button>
              </div>
            </div>

            <button 
              onClick={() => setImagePreviewUrl(null)}
              className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-[0.4em] hover:text-white transition-colors"
            >
              [ CLICK ANYWHERE OUTSIDE OR PRESS ESC TO EXIT ]
            </button>
          </div>
          
          <div 
            className="absolute inset-0 z-[-1]" 
            onClick={() => setImagePreviewUrl(null)} 
          />
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        html, body, #root {
          overflow: hidden;
          overscroll-behavior: none;
        }
      `}</style>
    </div>
  );
};

export default App;
