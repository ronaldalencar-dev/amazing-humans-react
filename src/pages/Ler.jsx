import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import {
    doc, getDoc, collection, query, where, orderBy, limit, getDocs,
    setDoc, serverTimestamp, updateDoc, increment
} from 'firebase/firestore';
import DOMPurify from 'dompurify';
import {
    MdArrowBack, MdNavigateBefore, MdNavigateNext, MdSettings,
    MdClose, MdFormatSize, MdTextFields, MdPhotoSizeSelectSmall, MdMenuBook,
    MdColorLens, MdAutorenew, MdVolumeUp, MdPause, MdStop, MdFlag, MdCheck
} from 'react-icons/md';
import Comentarios from '../components/Comentarios';
import AdBanner from '../components/AdBanner';
import toast from 'react-hot-toast';
import ReportModal from '../components/ReportModal';

// --- 1. IMPORTAÇÃO DO COMPONENTE DE IMAGEM ---
import CloudinaryImage from '../components/CloudinaryImage';

// Configurações Padrão
const defaultSettings = {
    fontSize: 18,
    lineHeight: 1.8,
    fontFamily: 'serif',
    widthClass: 'max-w-2xl',
    theme: 'dark' // dark, light, sepia, midnight, forest
};

// SISTEMA DE TEMAS DE LEITURA
const themes = {
    dark: { bg: 'bg-[#0F0F0F]', text: 'text-gray-300', title: 'text-gray-100', uiBg: 'bg-[#18181b]', uiBorder: 'border-[#27272a]', label: 'Dark' },
    light: { bg: 'bg-[#f8f9fa]', text: 'text-gray-800', title: 'text-gray-900', uiBg: 'bg-white', uiBorder: 'border-gray-200', label: 'Light' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#433422]', title: 'text-[#2b2115]', uiBg: 'bg-[#eaddcf]', uiBorder: 'border-[#d3c4bc]', label: 'Sepia' },
    midnight: { bg: 'bg-[#0f172a]', text: 'text-slate-300', title: 'text-slate-100', uiBg: 'bg-[#1e293b]', uiBorder: 'border-[#334155]', label: 'Midnight' },
    forest: { bg: 'bg-[#1a2e1a]', text: 'text-[#d1e7dd]', title: 'text-white', uiBg: 'bg-[#264226]', uiBorder: 'border-[#365e36]', label: 'Forest' }
};

export default function Ler() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [capitulo, setCapitulo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [prevId, setPrevId] = useState(null);
    const [nextId, setNextId] = useState(null);
    const [showReport, setShowReport] = useState(false);

    const [showSettings, setShowSettings] = useState(false);

    const [settings, setSettings] = useState(defaultSettings);

    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(1);
    const scrollInterval = useRef(null);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const synthesisRef = useRef(window.speechSynthesis);
    const utteranceRef = useRef(null);

    // Carregar Configurações do LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('ah_reader_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validação simples para evitar bugs com configs antigas
                if (typeof parsed.widthClass !== 'string') parsed.widthClass = 'max-w-2xl';
                setSettings({ ...defaultSettings, ...parsed });
            } catch (e) {
                localStorage.removeItem('ah_reader_settings');
            }
        }
    }, []);

    // Salvar Configurações Automaticamente
    useEffect(() => {
        localStorage.setItem('ah_reader_settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        async function loadCapitulo() {
            setLoading(true);
            stopAutoScroll();
            stopSpeaking();

            try {
                // Delay artificial para a tela de carregamento ser vista por 2s
                await new Promise(resolve => setTimeout(resolve, 1800));

                const docRef = doc(db, "capitulos", id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    toast.error("Chapter not found.");
                    navigate("/");
                    return;
                }

                const data = docSnap.data();
                setCapitulo({ id: docSnap.id, ...data });

                // LOGICA DE CONTAGEM E HISTÓRICO
                if (user?.uid) {
                    const historyRef = doc(db, "historico", `${user.uid}_${data.obraId}`);
                    setDoc(historyRef, {
                        userId: user.uid,
                        obraId: data.obraId,
                        bookTitle: data.nomeObra || "Unknown Book",
                        lastChapterId: docSnap.id,
                        lastChapterTitle: data.titulo,
                        accessedAt: serverTimestamp()
                    }, { merge: true });

                    try {
                        const obraRef = doc(db, "obras", data.obraId);
                        updateDoc(obraRef, { views: increment(1) }).catch(err => {
                            console.warn("Analytics update failed (non-fatal)", err);
                        });
                    } catch (e) { console.log("Analytics error", e); }
                }

                // Busca próximo e anterior (FILTRO DE DATA ADICIONADO AQUI)
                const qAnt = query(
                    collection(db, "capitulos"),
                    where("obraId", "==", data.obraId),
                    where("data", "<", data.data),
                    where("data", "<=", new Date()), // NOVO
                    orderBy("data", "desc"),
                    limit(1)
                );
                const qProx = query(
                    collection(db, "capitulos"),
                    where("obraId", "==", data.obraId),
                    where("data", ">", data.data),
                    where("data", "<=", new Date()), // NOVO
                    orderBy("data", "asc"),
                    limit(1)
                );

                const [snapAnt, snapProx] = await Promise.all([getDocs(qAnt), getDocs(qProx)]);

                setPrevId(!snapAnt.empty ? snapAnt.docs[0].id : null);
                setNextId(!snapProx.empty ? snapProx.docs[0].id : null);

            } catch (error) { console.error("Erro ao carregar:", error); } finally { setLoading(false); window.scrollTo(0, 0); }
        }
        loadCapitulo();

        return () => {
            stopAutoScroll();
            stopSpeaking();
        };
    }, [id, navigate, user]);

    const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    const currentTheme = themes[settings.theme] || themes.dark;

    const toggleAutoScroll = () => {
        if (isAutoScrolling) stopAutoScroll();
        else startAutoScroll();
    };

    const startAutoScroll = () => {
        setIsAutoScrolling(true);
        scrollInterval.current = setInterval(() => {
            window.scrollBy(0, 1);
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
                stopAutoScroll();
            }
        }, 50 / scrollSpeed);
    };

    const stopAutoScroll = () => {
        setIsAutoScrolling(false);
        if (scrollInterval.current) clearInterval(scrollInterval.current);
    };

    const toggleSpeaking = () => {
        if (isSpeaking) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        } else {
            const text = document.getElementById('chapter-content')?.innerText;
            if (!text) return;

            utteranceRef.current = new SpeechSynthesisUtterance(text);
            utteranceRef.current.onend = () => setIsSpeaking(false);
            synthesisRef.current.speak(utteranceRef.current);
            setIsSpeaking(true);
        }
    };

    const stopSpeaking = () => {
        if (synthesisRef.current) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        }
    };



    const cleanContent = React.useMemo(() => capitulo?.conteudo ? DOMPurify.sanitize(capitulo.conteudo) : '', [capitulo?.conteudo]);
    const cleanNote = React.useMemo(() => capitulo?.authorNote ? DOMPurify.sanitize(capitulo.authorNote) : null, [capitulo?.authorNote]);

    if (loading) return (
        <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 ${currentTheme?.bg || 'bg-[#0F0F0F]'}`}>
            <div className="w-16 h-16 border-4 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
            <p className={`text-lg font-medium tracking-wide animate-pulse ${currentTheme?.text || 'text-gray-300'}`}>Carregando...</p>
        </div>
    );

    if (!capitulo) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-white">
            <h2 className="text-2xl font-bold mb-4">Chapter not found.</h2>
            <button onClick={() => navigate('/')} className="text-primary hover:underline">Go Home</button>
        </div>
    );

    return (
        <div className={`min-h-screen pb-24 md:pb-20 relative transition-colors duration-500 ${currentTheme.bg}`}>

            {/* --- CONTROLES DE LEITURA (RESPONSIVO) --- */}

            {/* DESKTOP */}
            <div className="hidden md:flex fixed top-24 right-4 z-50 flex-col items-end gap-2">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={toggleSpeaking}
                        className={`p-3 rounded-full shadow-lg border transition-all ${isSpeaking ? 'bg-green-600 text-white border-green-500 animate-pulse' : `${currentTheme.uiBg} ${currentTheme.text} ${currentTheme.uiBorder} hover:border-primary`}`}
                        title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                    >
                        {isSpeaking ? <MdStop size={24} /> : <MdVolumeUp size={24} />}
                    </button>

                    <button
                        onClick={toggleAutoScroll}
                        className={`p-3 rounded-full shadow-lg border transition-all ${isAutoScrolling ? 'bg-zinc-600 text-white border-zinc-500' : `${currentTheme.uiBg} ${currentTheme.text} ${currentTheme.uiBorder} hover:border-primary`}`}
                        title="Auto Scroll"
                    >
                        {isAutoScrolling ? <MdPause size={24} /> : <MdAutorenew size={24} />}
                    </button>
                </div>

                <button onClick={() => setShowSettings(!showSettings)} className={`${currentTheme.uiBg} ${currentTheme.uiBorder} ${currentTheme.text} p-3 rounded-full shadow-lg border hover:border-primary transition-all mt-2`}>
                    {showSettings ? <MdClose size={24} /> : <MdSettings size={24} />}
                </button>
            </div>

            {/* MOBILE FOOTER */}
            <div className={`md:hidden fixed bottom-0 left-0 w-full z-[100] border-t px-6 py-3 flex justify-between items-center safe-area-pb ${currentTheme.uiBg} ${currentTheme.uiBorder} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]`}>
                <button onClick={toggleSpeaking} className={`p-2 rounded-full transition-colors ${isSpeaking ? 'text-green-500 bg-green-500/10' : `${currentTheme.text}`}`}>
                    {isSpeaking ? <MdStop size={28} /> : <MdVolumeUp size={28} />}
                </button>
                <button onClick={toggleAutoScroll} className={`p-2 rounded-full transition-colors ${isAutoScrolling ? 'text-zinc-500 bg-zinc-500/10' : `${currentTheme.text}`}`}>
                    {isAutoScrolling ? <MdPause size={28} /> : <MdAutorenew size={28} />}
                </button>
                <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'text-primary' : `${currentTheme.text}`}`}>
                    {showSettings ? <MdClose size={28} /> : <MdSettings size={28} />}
                </button>
            </div>

            {/* --- MENU DE CONFIGURAÇÕES (Refinado) --- */}
            {showSettings && (
                <>
                    <div className="fixed inset-0 z-[101] bg-black/50 md:hidden" onClick={() => setShowSettings(false)}></div>
                    <div className={`
                    fixed z-[102] 
                    bottom-20 left-4 right-4 
                    md:bottom-auto md:left-auto md:top-24 md:right-20 md:w-80
                    ${currentTheme.uiBg} ${currentTheme.uiBorder} p-5 rounded-xl shadow-2xl animate-fade-in space-y-6 border
                `}>

                        {/* 1. Cores e Temas */}
                        <div>
                            <div className={`text-xs uppercase font-bold mb-3 flex items-center gap-2 ${currentTheme.text} opacity-70`}><MdColorLens /> Reading Mode</div>
                            <div className="grid grid-cols-5 gap-2">
                                {Object.entries(themes).map(([key, theme]) => (
                                    <button
                                        key={key}
                                        onClick={() => updateSetting('theme', key)}
                                        className={`aspect-square rounded-full border-2 flex items-center justify-center transition-all ${settings.theme === key ? 'border-zinc-500 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: key === 'light' ? '#f5f5f5' : key === 'sepia' ? '#f4ecd8' : key === 'midnight' ? '#0f172a' : key === 'forest' ? '#1a2e1a' : '#121212' }}
                                        title={theme.label}
                                    >
                                        {settings.theme === key && <MdCheck className={key === 'light' || key === 'sepia' ? 'text-black' : 'text-white'} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Tamanho da Fonte */}
                        <div>
                            <div className={`flex justify-between text-xs uppercase font-bold mb-2 ${currentTheme.text} opacity-70`}><span>Font Size</span><span>{settings.fontSize}px</span></div>
                            <div className={`flex items-center gap-3 p-3 rounded-lg border ${currentTheme.bg} ${currentTheme.uiBorder}`}>
                                <MdFormatSize size={16} className={currentTheme.text} />
                                <input type="range" min="14" max="32" step="1" value={settings.fontSize} onChange={(e) => updateSetting('fontSize', Number(e.target.value))} className="w-full accent-zinc-500 h-1.5 rounded-lg appearance-none cursor-pointer" />
                                <MdFormatSize size={24} className={currentTheme.text} />
                            </div>
                        </div>

                        {/* 3. Tipo de Fonte */}
                        <div>
                            <div className={`text-xs uppercase font-bold mb-2 flex items-center gap-2 ${currentTheme.text} opacity-70`}><MdTextFields /> Font Family</div>
                            <div className={`flex gap-1 p-1 rounded-lg border ${currentTheme.bg} ${currentTheme.uiBorder}`}>
                                {['serif', 'sans', 'mono'].map(font => (
                                    <button key={font} onClick={() => updateSetting('fontFamily', font)} className={`flex-1 py-2 rounded text-xs font-bold transition-all ${settings.fontFamily === font ? 'bg-zinc-600 text-white shadow' : `${currentTheme.text} hover:opacity-80 hover:bg-black/5`}`}>
                                        {font === 'serif' ? 'Serif' : font === 'sans' ? 'Sans' : 'Mono'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Largura (Desktop Only) */}
                        <div className="hidden md:block">
                            <div className={`text-xs uppercase font-bold mb-2 flex items-center gap-2 ${currentTheme.text} opacity-70`}><MdPhotoSizeSelectSmall /> Page Width</div>
                            <div className={`flex gap-1 p-1 rounded-lg border ${currentTheme.bg} ${currentTheme.uiBorder}`}>
                                {[
                                    { label: 'Narrow', cls: 'max-w-lg' },
                                    { label: 'Normal', cls: 'max-w-2xl' },
                                    { label: 'Wide', cls: 'max-w-4xl' }
                                ].map(w => (
                                    <button key={w.label} onClick={() => updateSetting('widthClass', w.cls)} className={`flex-1 py-2 rounded text-xs font-bold transition-all ${settings.widthClass === w.cls ? 'bg-zinc-600 text-white shadow' : `${currentTheme.text} hover:opacity-80 hover:bg-black/5`}`}>
                                        {w.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* CONTAINER DO TEXTO */}
            <div className={`mx-auto px-6 pt-12 transition-all duration-300 ease-in-out ${settings.widthClass}`}>

                <Link to={`/obra/${capitulo.obraId}`} className={`inline-flex items-center gap-2 mb-8 font-medium transition-colors ${currentTheme.text} hover:text-zinc-500 opacity-70 hover:opacity-100`}>
                    <MdArrowBack /> Back to Book
                </Link>

                <h1 className={`text-3xl md:text-5xl font-bold text-center border-b ${currentTheme.uiBorder} pb-8 mb-10 ${currentTheme.title} font-${settings.fontFamily === 'serif' ? 'serif' : settings.fontFamily === 'mono' ? 'mono' : 'sans'}`}>
                    {capitulo.titulo}
                </h1>

                {/* --- 2. INTEGRAÇÃO DA IMAGEM DO CLOUDINARY --- */}
                {/* Verifica se existe um ID de imagem e exibe centralizado */}
                <div className="flex justify-center mb-8 w-full">
                    <CloudinaryImage publicId={capitulo.imagem_public_id} />
                </div>

                {/* CONTEÚDO */}
                <div
                    id="chapter-content"
                    className={`
                    ${currentTheme.text} 
                    font-${settings.fontFamily === 'serif' ? 'serif' : settings.fontFamily === 'mono' ? 'mono' : 'sans'}
                    selection:bg-zinc-500/30 leading-relaxed reader-content
                `}
                    style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
                    dangerouslySetInnerHTML={{ __html: cleanContent }}
                />

                {cleanNote && (
                    <div className={`mt-16 border-l-4 border-zinc-500 p-6 rounded-r-lg ${currentTheme.uiBg}`}>
                        <h4 className="text-zinc-500 font-bold mb-2 text-sm uppercase tracking-wide">Author Note</h4>
                        <div className={`${currentTheme.text} italic text-sm`} dangerouslySetInnerHTML={{ __html: cleanNote }} />
                    </div>
                )}

                <AdBanner className={`mt-16 mb-8 border-none bg-transparent`} />

                <div className="flex justify-end mt-4 mb-2">
                    <button
                        onClick={() => setShowReport(true)}
                        className={`text-xs flex items-center gap-1 ${currentTheme.text} opacity-40 hover:opacity-100 hover:text-red-500 transition-all`}
                    >
                        <MdFlag /> Report Chapter
                    </button>
                </div>

                {/* NAVEGAÇÃO */}
                <div className={`flex justify-between items-center mt-8 pt-8 border-t ${currentTheme.uiBorder}`}>
                    {prevId ? (
                        <Link to={`/ler/${prevId}`} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all border ${currentTheme.uiBg} ${currentTheme.text} ${currentTheme.uiBorder} hover:border-zinc-500 hover:-translate-x-1`}>
                            <MdNavigateBefore size={24} /> <span className="hidden sm:inline">Prev</span>
                        </Link>
                    ) : (<div className="w-24 opacity-0"></div>)}

                    <Link
                        to={`/obra/${capitulo.obraId}`}
                        className={`flex flex-col items-center justify-center transition-colors group ${currentTheme.text} opacity-60 hover:opacity-100`}
                    >
                        <MdMenuBook size={28} className="group-hover:text-zinc-500 transition-colors mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:block">Chapters</span>
                    </Link>

                    {nextId ? (
                        <Link to={`/ler/${nextId}`} className="flex items-center gap-2 bg-gradient-to-r from-zinc-600 to-zinc-500 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-zinc-500/20 hover:shadow-zinc-500/40 hover:-translate-y-1">
                            <span className="hidden sm:inline">Next</span> <MdNavigateNext size={24} />
                        </Link>
                    ) : (<div className={`${currentTheme.text} font-medium w-24 text-right opacity-50`}>End</div>)}
                </div>

                <div className="mt-20">
                    <Comentarios
                        targetId={id}
                        targetType="capitulo"
                        targetAuthorId={capitulo.autorId}
                        targetTitle={capitulo.titulo}
                        theme={currentTheme}
                    />
                </div>

            </div>
        </div>
    );
}