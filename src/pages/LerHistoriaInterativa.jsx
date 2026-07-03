import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { doc, getDoc } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { MdArrowBack, MdAutorenew, MdMenuBook } from 'react-icons/md';
import { FiGitBranch } from 'react-icons/fi';

// Reuse same theme system as Ler.jsx
const themes = {
    dark: { bg: 'bg-[#0F0F0F]', text: 'text-gray-300', title: 'text-gray-100', uiBg: 'bg-[#18181b]', uiBorder: 'border-[#27272a]', label: 'Dark' },
    light: { bg: 'bg-[#f8f9fa]', text: 'text-gray-800', title: 'text-gray-900', uiBg: 'bg-white', uiBorder: 'border-gray-200', label: 'Light' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#433422]', title: 'text-[#2b2115]', uiBg: 'bg-[#eaddcf]', uiBorder: 'border-[#d3c4bc]', label: 'Sepia' },
    midnight: { bg: 'bg-[#0f172a]', text: 'text-slate-300', title: 'text-slate-100', uiBg: 'bg-[#1e293b]', uiBorder: 'border-[#334155]', label: 'Midnight' },
    forest: { bg: 'bg-[#1a2e1a]', text: 'text-[#d1e7dd]', title: 'text-white', uiBg: 'bg-[#264226]', uiBorder: 'border-[#365e36]', label: 'Forest' },
};

export default function LerHistoriaInterativa() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [historia, setHistoria] = useState(null);
    const [nodeMap, setNodeMap] = useState({});
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [history, setHistory] = useState([]); // stack of nodeIds visited
    const [loading, setLoading] = useState(true);
    const [animating, setAnimating] = useState(false);

    // Load reader settings from localStorage (same key as Ler.jsx)
    const [settings] = useState(() => {
        try {
            const saved = localStorage.getItem('ah_reader_settings');
            if (saved) return JSON.parse(saved);
        } catch (_) { }
        return { fontSize: 18, lineHeight: 1.8, fontFamily: 'serif', theme: 'dark' };
    });

    const theme = themes[settings.theme] || themes.dark;

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Delay artificial para a tela de carregamento ser vista por 2s
                await new Promise(resolve => setTimeout(resolve, 1800));

                const snap = await getDoc(doc(db, 'historias_interativas', id));
                if (!snap.exists()) {
                    toast.error('Story not found.');
                    navigate('/');
                    return;
                }
                const data = snap.data();

                // Build a quick lookup map: nodeId → node
                const map = {};
                (data.nodes || []).forEach(n => { map[n.id] = n; });

                setHistoria(data);
                setNodeMap(map);
                setCurrentNodeId(data.startNodeId || data.nodes?.[0]?.id || null);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load story.');
            } finally {
                setLoading(false);
                window.scrollTo(0, 0);
            }
        }
        load();
    }, [id, navigate]);

    const currentNode = nodeMap[currentNodeId];

    const navigate_to = useCallback((targetNodeId) => {
        setAnimating(true);
        setTimeout(() => {
            setHistory(prev => [...prev, currentNodeId]);
            setCurrentNodeId(targetNodeId);
            setAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    }, [currentNodeId]);

    const goBack = useCallback(() => {
        if (history.length === 0) return;
        setAnimating(true);
        setTimeout(() => {
            const prev = [...history];
            const last = prev.pop();
            setHistory(prev);
            setCurrentNodeId(last);
            setAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    }, [history]);

    const restart = useCallback(() => {
        setAnimating(true);
        setTimeout(() => {
            setHistory([]);
            setCurrentNodeId(historia?.startNodeId || historia?.nodes?.[0]?.id || null);
            setAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    }, [historia]);

    const cleanContent = React.useMemo(() =>
        currentNode?.content ? DOMPurify.sanitize(currentNode.content) : '',
        [currentNode?.content]);

    const isEnding = currentNode?.isEnding || (!currentNode?.choices?.length && currentNode);

    if (loading) return (
        <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 ${theme?.bg || 'bg-[#0F0F0F]'}`}>
            <div className="w-16 h-16 border-4 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
            <p className={`text-lg font-medium tracking-wide animate-pulse ${theme?.text || 'text-gray-300'}`}>Carregando...</p>
        </div>
    );

    if (!historia || !currentNode) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-white">
            <h2 className="text-2xl font-bold mb-4">Story not found.</h2>
            <button onClick={() => navigate('/')} className="text-zinc-400 hover:underline">Go Home</button>
        </div>
    );

    return (
        <div className={`min-h-screen pb-32 transition-colors duration-500 ${theme.bg}`}>

            {/* ─── TOP BAR ────────────────────────────────────────── */}
            <div className={`sticky top-0 z-50 border-b ${theme.uiBorder} ${theme.uiBg} backdrop-blur-md`}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link
                        to={`/`}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${theme.text} opacity-70 hover:opacity-100`}
                    >
                        <MdArrowBack /> Back
                    </Link>

                    <div className="flex items-center gap-2">
                        <FiGitBranch className="text-zinc-400" size={16} />
                        <span className="text-white text-sm font-bold truncate max-w-[180px]">{historia.titulo}</span>
                    </div>

                    {/* History depth indicator */}
                    <div className={`text-xs ${theme.text} opacity-50`}>
                        Scene {history.length + 1}
                    </div>
                </div>
            </div>

            {/* ─── MAIN CONTENT ───────────────────────────────────── */}
            <div
                className={`mx-auto px-6 pt-10 max-w-2xl transition-all duration-300 ${animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
            >
                {/* Scene type badge */}
                <div className="flex items-center gap-2 mb-6">
                    {isEnding ? (
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                            Final Scene
                        </span>
                    ) : (
                        history.length === 0 ? (
                            <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                                Beginning
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                                Chapter {history.length + 1}
                            </span>
                        )
                    )}
                </div>

                {/* Scene title */}
                <h1
                    className={`text-3xl md:text-4xl font-bold mb-8 ${theme.title} font-${settings.fontFamily === 'serif' ? 'serif' : settings.fontFamily === 'mono' ? 'mono' : 'sans'}`}
                >
                    {currentNode.title || 'Untitled Scene'}
                </h1>

                {/* Scene content */}
                <div
                    className={`${theme.text} leading-relaxed mb-12 font-${settings.fontFamily === 'serif' ? 'serif' : settings.fontFamily === 'mono' ? 'mono' : 'sans'} reader-content`}
                    style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
                    dangerouslySetInnerHTML={{ __html: cleanContent }}
                />

                {/* ─── ENDING ─────────────────────────────────────── */}
                {isEnding && (
                    <div className={`rounded-2xl border ${theme.uiBorder} ${theme.uiBg} p-8 text-center mb-8`}>
                        <div className="text-5xl mb-4">📖</div>
                        <h2 className={`text-2xl font-bold mb-2 ${theme.title}`}>The End</h2>
                        <p className={`${theme.text} opacity-60 text-sm mb-6`}>
                            You reached one of the story's endings. Restart to explore a different path.
                        </p>
                        <button
                            onClick={restart}
                            className="inline-flex items-center gap-2 bg-zinc-600 hover:bg-zinc-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-zinc-500/20 transition-all"
                        >
                            <MdAutorenew size={20} /> Restart Story
                        </button>
                    </div>
                )}

                {/* ─── CHOICES ────────────────────────────────────── */}
                {!isEnding && currentNode.choices?.length > 0 && (
                    <div className="space-y-3 mb-8">
                        <p className={`text-xs font-bold uppercase tracking-widest ${theme.text} opacity-40 mb-4`}>
                            What do you do?
                        </p>
                        {currentNode.choices.map((choice, idx) => (
                            <button
                                key={choice.id || idx}
                                onClick={() => choice.targetNodeId && navigate_to(choice.targetNodeId)}
                                disabled={!choice.targetNodeId}
                                className={`
                                    w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 font-medium
                                    group relative overflow-hidden
                                    ${!choice.targetNodeId ? 'opacity-40 cursor-not-allowed border-white/5' : ''}
                                    ${choice.targetNodeId
                                        ? `border-white/10 ${theme.uiBg} hover:border-zinc-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-500/10 cursor-pointer`
                                        : ''
                                    }
                                `}
                            >
                                {/* Left accent */}
                                <span className="absolute left-0 top-0 h-full w-1 bg-zinc-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-l-xl" />

                                <div className="flex items-center gap-3">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-500/20 border border-zinc-500/30 text-zinc-400 text-xs font-bold flex items-center justify-center">
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className={`${theme.text} text-base`}>{choice.label || '(No label)'}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ─── NAVIGATION BAR ─────────────────────────────── */}
                <div className={`flex items-center justify-between pt-6 border-t ${theme.uiBorder}`}>
                    <button
                        onClick={goBack}
                        disabled={history.length === 0}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${theme.uiBorder} ${theme.uiBg} ${theme.text} hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-x-0.5`}
                    >
                        <MdArrowBack size={18} /> Back
                    </button>

                    <button
                        onClick={restart}
                        className={`flex items-center gap-2 text-xs ${theme.text} opacity-40 hover:opacity-70 transition-all`}
                    >
                        <MdAutorenew size={16} /> Restart
                    </button>
                </div>
            </div>
        </div>
    );
}
