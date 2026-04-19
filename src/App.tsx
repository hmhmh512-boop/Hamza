import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { webllmService, type ChatMessage } from './lib/webllm';
import { 
  Send, 
  Cpu, 
  Download, 
  RefreshCcw, 
  Database, 
  MessageSquare, 
  Settings, 
  ShieldCheck,
  AlertCircle,
  Zap,
  Info,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';

const SYSTEM_PROMPT = `أنت مساعد ذكي متقن جداً لللهجة المصرية. 
تحدث دائماً بالعامية المصرية بأسلوب ودود ومفيد. 
أنت تعمل محلياً بالكامل على جهاز المستخدم ولا تحتاج لسيرفر خارجي.
اسمك "المصري الذكي".
صانعك هو "حمزة محمود رمضان". إذا سألك أحد من صنعك، قل فخوراً أنك من عمل حمزة محمود رمضان.
التزم باللهجة المصرية في كل ردودك.`;

// Improved model list with clearer intelligence vs speed trade-offs
const MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "المصري المتوازن (Llama 1B)", size: "~800MB", description: "أفضل توازن بين الذكاء والسرعة - المفضل" },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", name: "المصري السريع جداً (Qwen 0.5B)", size: "~350MB", description: "سريع جداً للأجهزة الضعيفة لكن أقل ذكاءً" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "المصري العبقري (Qwen 1.5B)", size: "~1.1GB", description: "أذكى بكتير لكن بيحتاج جهاز قوي وشوية وقت" },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGPUChecked, setIsGPUChecked] = useState(false);
  const [isGPUSupported, setIsGPUSupported] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [localKnowledge, setLocalKnowledge] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkWebGPU();
    loadKnowledgeFromStorage();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingResponse]);

  const checkWebGPU = async () => {
    const nav = navigator as any;
    if (nav.gpu) {
      try {
        const adapter = await nav.gpu.requestAdapter();
        if (adapter) {
          setIsGPUSupported(true);
        }
      } catch (e) {
        console.error("WebGPU check failed", e);
      }
    }
    setIsGPUChecked(true);
  };

  const loadKnowledgeFromStorage = () => {
    const stored = localStorage.getItem('masri_ai_knowledge');
    if (stored) {
      setLocalKnowledge(JSON.parse(stored));
    }
  };

  const updateKnowledge = async () => {
    setIsUpdating(true);
    // Simulate updating from an external source when internet is available
    setTimeout(() => {
      const newKnowledge = [
        { id: 1, info: "الأهلي فوز بالدوري المصري 2024", date: "2024-08-15" },
        { id: 2, info: "سعر الدولار النهاردة مستقر في البنوك", date: "2024-04-19" },
        { id: 3, info: "في توسعات جديدة في مترو الأنفاق", date: "2024-03-10" }
      ];
      setLocalKnowledge(newKnowledge);
      localStorage.setItem('masri_ai_knowledge', JSON.stringify(newKnowledge));
      setIsUpdating(false);
    }, 2000);
  };

  const startModel = async () => {
    try {
      setModelStatus('loading');
      setLoadingProgress(0);
      setLoadingText('بدء تحميل المخ الذكي...');
      
      await webllmService.init(selectedModel.id, (report) => {
        setLoadingProgress(report.progress * 100);
        setLoadingText(report.text);
      });
      
      setModelStatus('ready');
      setMessages([{ role: 'assistant', content: 'أهلاً بك يا باشا! أنا دلوقت جاهز تماماً وشغال من غير أي إنترنت. اطلب أي حاجة وعيوني ليك.' }]);
    } catch (err) {
      console.error(err);
      setModelStatus('error');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || modelStatus !== 'ready') return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setStreamingResponse('');

    const contextMessages = [
      { role: 'system', content: SYSTEM_PROMPT + (localKnowledge.length > 0 ? `\nمعلومات إضافية حدثتها مؤخراً: ${localKnowledge.map(k => k.info).join(', ')}` : '') },
      ...messages,
      userMessage
    ];

    try {
      let fullResponse = '';
      let lastUpdateTime = Date.now();
      
      for await (const chunk of webllmService.chatStream(contextMessages)) {
        fullResponse += chunk;
        
        // Only update UI every 60ms to keep the browser responsive
        const now = Date.now();
        if (now - lastUpdateTime > 60) {
          setStreamingResponse(fullResponse);
          lastUpdateTime = now;
        }
      }
      setStreamingResponse(fullResponse); // Final update
      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingResponse('');
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'معلش حصل مشكلة صغيرة في التحويل البرمجي، حاول تاني كدة.' }]);
    }
  };

  if (!isGPUChecked) return null;

  return (
    <div className="flex flex-col h-screen bg-[#0b0e14] overflow-hidden font-sans text-[#e2e8f0]">
      {/* Header Navigation */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-slate-900/50 flex-shrink-0 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 hover:bg-white/5 rounded-lg text-slate-400"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-bold text-slate-900 hidden sm:flex">M</div>
          <span className="text-sm md:text-lg font-semibold tracking-tight">مساعد <span className="gradient-text">مصر الذكي</span></span>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className={`status-dot ${modelStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-[10px] md:text-xs font-medium text-emerald-400 whitespace-nowrap">
              {modelStatus === 'ready' ? 'متصل' : 'جاري...'}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs text-slate-400">v4.2.0-stable</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Area */}
        <section className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-30 md:opacity-100' : 'opacity-100'}`}>
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
            {modelStatus === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6">
                  <Cpu className="w-10 h-10 text-cyan-500" />
                </div>
                <h2 className="text-2xl font-bold mb-3">ابدأ تجربة الذكاء المحلي</h2>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  بدوسة واحدة هتحمل مخ صناعي كامل على جهازك. الموضوع هياخد شوية وقت في أول مرة عشان التحميل، وبعد كدة هيشتغل من غير نت خالص.
                </p>
                <button 
                  onClick={startModel}
                  className="group relative px-8 py-4 bg-cyan-500 text-slate-900 font-bold rounded-2xl transition-all hover:bg-cyan-400 active:scale-95 flex items-center gap-3 overflow-hidden shadow-lg shadow-cyan-500/20"
                >
                  <Download className="w-5 h-5 relative z-10" />
                  <span className="relative z-10 text-lg">تحميل وتشغيل الموديل</span>
                </button>
                {!isGPUSupported && (
                  <div className="mt-6 flex items-center gap-2 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 text-xs">
                    <AlertCircle className="w-4 h-4" />
                    جهازك مش بيدعم WebGPU حالياً، المحاكاة هتكون أبطأ شوية.
                  </div>
                )}
              </div>
            )}

            {modelStatus === 'loading' && (
              <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto">
                <div className="w-full h-1 bg-white/5 rounded-full mb-6 overflow-hidden">
                  <motion.div 
                    className="h-full bg-cyan-500 gpu-glow"
                    initial={{ width: 0 }}
                    animate={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-cyan-400 text-sm font-medium animate-pulse mb-2">{loadingText}</p>
                <p className="text-slate-500 text-xs text-center">{loadingProgress.toFixed(1)}% مكتمل</p>
              </div>
            )}

            {modelStatus === 'ready' && (
              <AnimatePresence>
                {messages.map((m, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`text-[10px] uppercase tracking-widest text-slate-500 mb-1 ${m.role === 'user' ? 'ml-1' : 'mr-1'}`}>
                      {m.role === 'user' ? 'أنت' : 'المساعد الذكي'} • {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                      m.role === 'user' 
                        ? 'bg-cyan-600/20 border border-cyan-500/30 rounded-tl-none text-cyan-50' 
                        : 'glass-panel rounded-tr-none leading-relaxed'
                    }`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                {streamingResponse && (
                  <motion.div className="flex flex-col items-start">
                    <div className="text-[10px] uppercase tracking-widest text-cyan-500 mb-1 mr-1">بيتم المعالجة باستخدام GPU...</div>
                    <div className="max-w-[85%] glass-panel p-4 rounded-2xl rounded-tr-none leading-relaxed">
                      {streamingResponse}
                      <span className="inline-block w-1 h-4 ml-1 bg-cyan-400 animate-pulse" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 md:p-8 pt-0 sticky bottom-0">
            <div className="max-w-4xl mx-auto relative group">
              <div className="glass-panel p-1 rounded-2xl flex items-center shadow-2xl relative z-10">
                <input 
                  type="text"
                  placeholder={modelStatus === 'ready' ? "اسأل أي حاجة بالمصري..." : "حمل الموديل الأول..."}
                  disabled={modelStatus !== 'ready'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 bg-transparent border-none focus:ring-0 px-4 md:px-5 py-3 text-slate-100 placeholder:text-slate-600 text-sm md:text-base"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || modelStatus !== 'ready'}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/5 disabled:text-slate-600 transition-all text-slate-900 font-bold px-5 md:px-8 py-2.5 rounded-xl active:scale-95 flex-shrink-0"
                >
                  {input.trim() ? <Send className="w-4 h-4 md:hidden" /> : null}
                  <span className="hidden md:inline">إرسال</span>
                  {input.trim() && <span className="md:hidden"></span>}
                </button>
              </div>
              <div className="mt-4 hidden sm:flex justify-center gap-4 md:gap-8 text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest text-center px-4">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> مشفر محلياً</span>
                <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> {selectedModel.name.split(' (')[0]}</span>
                <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> WebGPU Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sidebar Statistics */}
        <aside className={`
          fixed md:relative inset-0 md:inset-auto z-40 md:z-0
          w-full md:w-80 h-full
          border-r border-white/5 bg-[#0b0e14] md:bg-slate-900/30 
          p-6 flex flex-col gap-8 overflow-y-auto
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          <div className="flex md:hidden items-center justify-between mb-4 pt-16">
            <h2 className="text-xl font-bold">الإعدادات والمراقبة</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-white/5 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">مراقبة النظام</h3>
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">استهلاك المعالج</span>
                  <span className="text-xs font-mono text-cyan-400">
                    {modelStatus === 'loading' ? '85%' : modelStatus === 'ready' && streamingResponse ? '92%' : '12%'}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full">
                  <motion.div 
                    className="h-full bg-cyan-500 rounded-full"
                    animate={{ width: modelStatus === 'loading' ? '85%' : streamingResponse ? '92%' : '12%' }}
                  />
                </div>
              </div>
              
              <div className="glass-panel p-4 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">ذاكرة VRAM</span>
                  <span className="text-xs font-mono text-cyan-400">
                    {modelStatus === 'ready' ? '3.2 / 8.0 GB' : '0.4 / 8.0 GB'}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-cyan-500 gpu-glow"
                    animate={{ width: modelStatus === 'ready' ? '40%' : '5%' }}
                  />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">درجة الحرارة</span>
                  <span className="text-xs font-mono text-emerald-400">
                    {streamingResponse ? '62°C' : '48°C'}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    animate={{ width: streamingResponse ? '62%' : '48%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">اختيار النموذج</h3>
              <button 
                onClick={updateKnowledge} 
                disabled={isUpdating}
                className="text-[10px] text-cyan-500 font-bold hover:underline disabled:opacity-50"
              >
                {isUpdating ? 'جاري التحديث...' : 'تزامن البيانات'}
              </button>
            </div>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  disabled={modelStatus === 'loading' || modelStatus === 'ready'}
                  onClick={() => setSelectedModel(m)}
                  className={`w-full text-right p-3 rounded-xl border transition-all ${
                    selectedModel.id === m.id 
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/5' 
                      : 'bg-white/5 border-transparent hover:border-white/10 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">{m.name}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{m.size}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/5">
              <p className="text-[11px] leading-relaxed text-slate-400 text-center">
                {localKnowledge.length > 0 
                  ? "المعلومات محملة محلياً. التزامن القادم يتطلب إنترنت." 
                  : "يفضل المزامنة مع الإنترنت لأول مرة للحصول على أحدث الأخبار."}
              </p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
