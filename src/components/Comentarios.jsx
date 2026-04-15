import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { Link } from 'react-router-dom';
import {
    collection, query, where, onSnapshot,
    addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
    arrayUnion, arrayRemove, orderBy
} from 'firebase/firestore';
import {
    MdThumbUp, MdThumbUpOffAlt, MdDelete, MdSort, MdKeyboardArrowDown, MdKeyboardArrowUp,
    MdChevronLeft, MdChevronRight, MdErrorOutline, MdReply
} from 'react-icons/md';
import toast from 'react-hot-toast';

// Helper para avatar
const getFallbackAvatar = (name) => `https://ui-avatars.com/api/?name=${name || 'User'}&background=random`;

const ReplyItem = ({ dados, user, handleLike, handleDelete, handleResponderClick, styles }) => {

    const isOwner = user?.uid === dados.autorId;
    const timeString = dados.data ? new Date(dados.data.seconds * 1000).toLocaleDateString() : 'just now';

    return (
        <div className={`flex gap-3 mb-3 pl-4 border-l-2 ${styles.border} group`}>
            <Link to={`/usuario/${dados.autorId}`} className="shrink-0">
                <img
                    src={dados.autorFoto || getFallbackAvatar(dados.autorNome)}
                    alt="user" className="w-6 h-6 rounded-full object-cover"
                    onError={(e) => { e.target.src = getFallbackAvatar(dados.autorNome); }}
                />
            </Link>
            <div className="flex-1">
                <div className="flex items-center gap-2 text-[11px] mb-1">
                    <span className={`font-bold cursor-pointer ${styles.text}`}>
                        @{dados.autorNome?.replace(/\s+/g, '').toLowerCase()}
                    </span>
                    <span className={styles.subText}>{timeString}</span>
                </div>
                <div className={`text-sm leading-snug mb-2 ${styles.text}`}>
                    {dados.texto}
                </div>

                {/* BOTÕES DA RESPOSTA (Compactos) */}
                <div className="flex items-center gap-2">
                    <button onClick={() => handleResponderClick(dados.autorNome)} className={styles.actionBtnSmall}>
                        <MdReply size={12} /> Reply
                    </button>
                    {isOwner && (
                        <button onClick={() => handleDelete(dados.id)} className={`${styles.actionBtnSmall} text-red-400 border-red-400/20 hover:bg-red-500/10`}>
                            <MdDelete size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const CommentThread = ({
    dados, todasRespostas, user,
    respondendoA, setRespondendoA, textoResposta, setTextoResposta,
    handleLike, handleDelete, handleEnviar, styles
}) => {
    const [mostrarRespostas, setMostrarRespostas] = useState(false);

    const minhasRespostas = todasRespostas.filter(r => r.parentId === dados.id);

    const isOwner = user?.uid === dados.autorId;
    const timeString = dados.data ? new Date(dados.data.seconds * 1000).toLocaleDateString() : 'just now';

    const prepararResposta = (nomeUsuario) => {
        setRespondendoA(dados.id);
        setTextoResposta(`@${nomeUsuario?.replace(/\s+/g, '').toLowerCase()} `);
    };

    return (
        <div className={`flex gap-4 mb-6 p-4 rounded-xl border ${styles.cardBg} ${styles.border}`}>
            <Link to={`/usuario/${dados.autorId}`} className="shrink-0">
                <img
                    src={dados.autorFoto || getFallbackAvatar(dados.autorNome)}
                    alt="user" className={`w-10 h-10 rounded-full object-cover border ${styles.border}`}
                    onError={(e) => { e.target.src = getFallbackAvatar(dados.autorNome); }}
                />
            </Link>

            <div className="flex-1">
                <div className="flex items-center gap-2 text-xs mb-1">
                    <span className={`font-bold cursor-pointer ${styles.text}`}>
                        @{dados.autorNome?.replace(/\s+/g, '').toLowerCase()}
                    </span>
                    <span className={`text-[11px] ${styles.subText}`}>{timeString}</span>
                </div>

                <div className={`text-sm leading-relaxed whitespace-pre-wrap mb-3 ${styles.text}`}>
                    {dados.texto}
                </div>

                {/* BOTÕES PRINCIPAIS (Com Contorno) */}
                <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${styles.border}`}>


                    <button onClick={() => prepararResposta(dados.autorNome)} className={styles.actionBtn}>
                        <MdReply size={16} /> Reply
                    </button>

                    {isOwner && (
                        <button onClick={() => handleDelete(dados.id)} className={`${styles.actionBtn} ml-auto text-red-400 border-red-400/20 hover:bg-red-500/10`}>
                            <MdDelete size={16} />
                        </button>
                    )}
                </div>

                {respondendoA === dados.id && (
                    <div className="mt-3 mb-4 animate-fade-in">
                        <div className="flex-1">
                            <input
                                autoFocus
                                value={textoResposta}
                                onChange={(e) => setTextoResposta(e.target.value)}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors ${styles.inputBg} ${styles.inputText} ${styles.border}`}
                                placeholder="Write a reply..."
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => { setRespondendoA(null); setTextoResposta(''); }} className={`px-3 py-1 rounded text-xs font-bold ${styles.subText} hover:${styles.text}`}>Cancel</button>
                                <button onClick={() => handleEnviar(dados.id)} disabled={!textoResposta.trim()} className="px-4 py-1 rounded bg-zinc-600 text-white font-bold text-xs hover:bg-zinc-500 disabled:opacity-50">Reply</button>
                            </div>
                        </div>
                    </div>
                )}

                {minhasRespostas.length > 0 && (
                    <div className="mt-2">
                        {mostrarRespostas ? (
                            <div className="animate-fade-in">
                                {minhasRespostas.map(resp => (
                                    <ReplyItem
                                        key={resp.id}
                                        dados={resp}
                                        user={user}
                                        handleLike={handleLike}
                                        handleDelete={handleDelete}
                                        handleResponderClick={prepararResposta}
                                        styles={styles}
                                    />
                                ))}
                                <button
                                    onClick={() => setMostrarRespostas(false)}
                                    className={`flex items-center gap-1 text-xs font-bold ${styles.subText} hover:${styles.text} mt-2 ml-4`}
                                >
                                    <MdKeyboardArrowUp /> Hide replies
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setMostrarRespostas(true)}
                                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 text-xs font-bold transition-colors mt-1"
                            >
                                <MdKeyboardArrowDown /> View {minhasRespostas.length} replies
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Comentarios({ targetId, targetType = 'capitulo', targetAuthorId, targetTitle, theme = null }) {
    const { user } = useContext(AuthContext);
    const [comentarios, setComentarios] = useState([]);
    const [novoTexto, setNovoTexto] = useState('');
    const [respondendoA, setRespondendoA] = useState(null);
    const [textoResposta, setTextoResposta] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [errorIndex, setErrorIndex] = useState(null);

    const [pagina, setPagina] = useState(1);
    const ITENS_POR_PAGINA = 10;

    // --- TEMAS: Estilo "Outline" nos botões para garantir contraste ---
    // A classe `actionBtn` agora tem borda e fundo transparente que escurece ao passar o mouse
    // --- TEMAS: Estilo "Outline" nos botões para garantir contraste ---
    // A classe `actionBtn` agora tem borda e fundo transparente que escurece ao passar o mouse
    const styles = React.useMemo(() => (theme ? {
        containerBg: 'bg-transparent',
        cardBg: theme.uiBg,
        border: theme.uiBorder,
        text: theme.text,
        subText: 'opacity-70',
        inputBg: theme.uiBg,
        inputText: theme.text,
        placeholder: 'placeholder-gray-500',
        // Botão Grande (Comentário)
        actionBtn: `border ${theme.uiBorder} text-xs font-bold px-3 py-1.5 rounded-lg hover:brightness-95 hover:bg-black/5 transition-all flex items-center gap-1.5 ${theme.text}`,
        // Botão Pequeno (Resposta)
        actionBtnSmall: `border ${theme.uiBorder} text-[10px] font-bold px-2 py-1 rounded-md hover:brightness-95 hover:bg-black/5 transition-all flex items-center gap-1 ${theme.text} opacity-80 hover:opacity-100`
    } : {
        // Padrão Dark (Sem tema de leitura)
        containerBg: 'bg-[#1a1a1a]',
        cardBg: 'bg-[#1f1f1f]',
        border: 'border-[#333]',
        text: 'text-gray-200',
        subText: 'text-gray-500',
        inputBg: 'bg-[#121212]',
        inputText: 'text-white',
        placeholder: 'placeholder-gray-600',
        actionBtn: `border border-[#333] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5 text-gray-300 hover:text-white`,
        actionBtnSmall: `border border-[#333] text-[10px] font-bold px-2 py-1 rounded-md hover:bg-white/5 transition-all flex items-center gap-1 text-gray-400 hover:text-white`
    }), [theme]);

    useEffect(() => {
        if (!targetId) return;
        setErrorIndex(null);

        const q = query(
            collection(db, "comentarios"),
            where("targetId", "==", targetId),
            orderBy("data", "desc")
        );

        const unsub = onSnapshot(q,
            (snap) => {
                let lista = [];
                snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
                setComentarios(lista);
            },
            (error) => {
                console.error("Comments Error:", error);
                if (error.code === 'failed-precondition' || error.message.includes('index')) {
                    setErrorIndex(error);
                }
            }
        );
        return () => unsub();
    }, [targetId]);

    async function handleEnviar(parentId = null) {
        if (!user) return toast.error("Login to comment.");
        const textoFinal = parentId ? textoResposta : novoTexto;
        if (!textoFinal.trim()) return;

        try {
            await addDoc(collection(db, "comentarios"), {
                texto: textoFinal,
                autorId: user.uid,
                autorNome: user.name,
                autorFoto: user.avatar,
                targetId: targetId,
                targetType: targetType,
                parentId: parentId,
                likes: [],
                data: serverTimestamp()
            });

            let paraId = null;
            let mensagem = "";
            if (parentId) {
                const comentarioPai = comentarios.find(c => c.id === parentId);
                if (comentarioPai) { paraId = comentarioPai.autorId; mensagem = `<strong>${user.name}</strong> replied to your comment.`; }
            } else {
                if (targetAuthorId) { paraId = targetAuthorId; mensagem = `<strong>${user.name}</strong> commented on "<strong>${targetTitle || 'your story'}</strong>".`; }
            }
            if (paraId && paraId !== user.uid) {
                try {
                    await addDoc(collection(db, "notificacoes"), { paraId: paraId, mensagem: mensagem, tipo: 'comment', linkDestino: `/ler/${targetId}`, lida: false, data: serverTimestamp() });
                } catch (e) { }
            }

            if (parentId) { setRespondendoA(null); setTextoResposta(''); }
            else { setNovoTexto(''); setIsFocused(false); setPagina(1); }

            toast.success("Comment posted!");
        } catch (error) {
            toast.error("Error sending comment.");
        }
    }

    async function handleLike(id, likesAtuais) {
        if (!user) return toast.error("Login to like.");
        const docRef = doc(db, "comentarios", id);
        if (likesAtuais?.includes(user.uid)) { await updateDoc(docRef, { likes: arrayRemove(user.uid) }); }
        else { await updateDoc(docRef, { likes: arrayUnion(user.uid) }); }
    }

    async function handleDelete(id) {
        if (window.confirm("Delete comment?")) { await deleteDoc(doc(db, "comentarios", id)); }
    }

    const raiz = comentarios.filter(c => !c.parentId);
    const respostas = comentarios.filter(c => c.parentId);

    const totalPaginas = Math.ceil(raiz.length / ITENS_POR_PAGINA);
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    const comentariosVisiveis = raiz.slice(inicio, inicio + ITENS_POR_PAGINA);

    const irParaAnterior = () => setPagina(p => Math.max(p - 1, 1));
    const irParaProxima = () => setPagina(p => Math.min(p + 1, totalPaginas));

    return (
        <div className={`max-w-3xl mx-auto mt-12 px-4 rounded-xl ${!theme && 'py-6'} ${styles.containerBg}`}>

            {errorIndex && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                    <MdErrorOutline className="text-red-400 mt-1 shrink-0" size={20} />
                    <div>
                        <h4 className="text-red-400 font-bold text-sm">Comments System Error</h4>
                        <p className="text-gray-400 text-xs mt-1">Open browser console (F12) & click the Firebase Index link.</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold flex items-center gap-2 ${styles.text}`}>
                    {raiz.length} Comments
                </h3>
                <div className={`flex items-center gap-2 text-sm ${styles.subText}`}>
                    <MdSort /> <span>Newest First</span>
                </div>
            </div>

            <div className="flex gap-4 mb-10">
                <img src={user?.avatar || getFallbackAvatar(user?.name)} className={`w-10 h-10 rounded-full object-cover border ${styles.border}`} />
                <div className="flex-1">
                    <div className={`border ${isFocused ? 'border-zinc-500' : styles.border} rounded-xl p-2 transition-colors ${styles.inputBg}`}>
                        <textarea
                            placeholder="Add a comment..."
                            value={novoTexto}
                            onChange={(e) => setNovoTexto(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            disabled={!user}
                            rows={isFocused ? 3 : 1}
                            className={`w-full bg-transparent text-sm focus:outline-none resize-none ${styles.inputText} ${styles.placeholder}`}
                        />
                        {(isFocused || novoTexto) && (
                            <div className={`flex justify-end gap-2 mt-2 pt-2 border-t ${styles.border}`}>
                                <button onClick={() => { setIsFocused(false); setNovoTexto(''); }} className={`px-4 py-1.5 rounded-full text-xs font-bold ${styles.subText} hover:${styles.text}`}>Cancel</button>
                                <button onClick={() => handleEnviar(null)} disabled={!user || !novoTexto.trim()} className={`px-5 py-1.5 rounded-full font-bold text-xs transition-all ${!novoTexto.trim() ? 'opacity-50 cursor-not-allowed' : 'bg-zinc-600 text-white hover:bg-zinc-500 shadow-lg'}`}>Comment</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {comentariosVisiveis.map(c => (
                    <CommentThread
                        key={c.id}
                        dados={c}
                        todasRespostas={respostas}
                        user={user}
                        respondendoA={respondendoA}
                        setRespondendoA={setRespondendoA}
                        textoResposta={textoResposta}
                        setTextoResposta={setTextoResposta}
                        handleLike={handleLike}
                        handleDelete={handleDelete}
                        handleEnviar={handleEnviar}
                        styles={styles}
                    />
                ))}
            </div>

            {totalPaginas > 1 && (
                <div className={`flex justify-center items-center gap-4 mt-8 pt-6 border-t ${styles.border}`}>
                    <button onClick={irParaAnterior} disabled={pagina === 1} className={`p-2 rounded-full ${styles.inputBg} hover:opacity-80 disabled:opacity-30 ${styles.text}`}>
                        <MdChevronLeft size={24} />
                    </button>
                    <span className={`text-sm font-bold ${styles.subText}`}>Page {pagina} of {totalPaginas}</span>
                    <button onClick={irParaProxima} disabled={pagina === totalPaginas} className={`p-2 rounded-full ${styles.inputBg} hover:opacity-80 disabled:opacity-30 ${styles.text}`}>
                        <MdChevronRight size={24} />
                    </button>
                </div>
            )}
        </div>
    );
}