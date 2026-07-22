import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { MdPlayArrow, MdLibraryBooks, MdCheckCircle, MdSchedule, MdFavorite, MdFavoriteBorder, MdErrorOutline } from 'react-icons/md';
import { Virtuoso } from 'react-virtuoso';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function Library() {
    const { user, loadingAuth } = useContext(AuthContext); // Importamos loadingAuth
    const [abaAtual, setAbaAtual] = useState('reading');
    const queryClient = useQueryClient();

    // 1. CARREGAMENTO COM CACHE (UseQuery)
    const { data: livros = [], isLoading, isError, error } = useQuery({
        queryKey: ['biblioteca', user?.uid, abaAtual],
        queryFn: async () => {
            if (!user?.uid) return [];
            const libRef = collection(db, "biblioteca");

            // ATENÇÃO: Essa combinação de WHERE + ORDERBY exige um índice no Firestore
            // Verifique o console do navegador (F12) se não carregar nada.
            let constraints = [
                where("userId", "==", user.uid),
                orderBy("dataAdicao", "desc"),
                limit(50)
            ];

            if (abaAtual === 'favorites') {
                constraints.push(where("isFavorite", "==", true));
            } else {
                constraints.push(where("status", "==", abaAtual));
            }

            const q = query(libRef, ...constraints);
            const snapshot = await getDocs(q);

            const listaPromessas = snapshot.docs.map(async (docSnapshot) => {
                const dadosLib = docSnapshot.data();
                let detalhes = {
                    id: docSnapshot.id,
                    ...dadosLib,
                    tituloObra: dadosLib.tituloObra || "Unknown",
                    capa: "",
                    progresso: 0,
                    ultimoCapituloLido: "Not started",
                    ultimoCapituloId: null,
                    isFavorite: dadosLib.isFavorite || false
                };

                try {
                    const obraRef = doc(db, "obras", dadosLib.obraId);
                    const obraSnap = await getDoc(obraRef);
                    if (obraSnap.exists()) {
                        detalhes.capa = obraSnap.data().capa || "";
                        detalhes.tituloObra = obraSnap.data().titulo;
                    }

                    const histRef = doc(db, "historico", `${user.uid}_${dadosLib.obraId}`);
                    const histSnap = await getDoc(histRef);

                    if (histSnap.exists()) {
                        const dataHist = histSnap.data();
                        detalhes.ultimoCapituloId = dataHist.lastChapterId;
                        detalhes.ultimoCapituloLido = dataHist.lastChapterTitle;
                        
                        // Otimização: Não buscamos mais TODOS os capítulos apenas para calcular a porcentagem.
                        // A porcentagem ficará oculta e mostraremos apenas o último capítulo lido, salvando 1000+ reads.
                        detalhes.progresso = null;
                    }
                } catch (err) { console.error(err); }
                return detalhes;
            });

            return Promise.all(listaPromessas);
        },
        // Só tenta buscar se o usuário estiver logado e o Auth já tiver terminado de carregar
        enabled: !!user?.uid && !loadingAuth,
        staleTime: 1000 * 60 * 10,
    });

    // Log de erro específico para Indices do Firestore
    if (isError) {
        console.error("Erro biblioteca:", error);
    }

    const mutationStatus = useMutation({
        mutationFn: async ({ id, novoStatus }) => {
            if (novoStatus === 'remove') {
                await deleteDoc(doc(db, "biblioteca", id));
                return { id, action: 'remove' };
            } else {
                await updateDoc(doc(db, "biblioteca", id), { status: novoStatus });
                return { id, action: 'update', novoStatus };
            }
        },
        onSuccess: (result) => {
            queryClient.setQueryData(['biblioteca', user?.uid, abaAtual], (oldData) => {
                if (!oldData) return [];
                if (result.action === 'remove' || (abaAtual !== 'favorites' && abaAtual !== result.novoStatus)) {
                    return oldData.filter(book => book.id !== result.id);
                }
                return oldData;
            });
            toast.success(result.action === 'remove' ? "Book removed" : "Status updated");
        },
        onError: () => toast.error("Error updating library")
    });

    const mutationFavorite = useMutation({
        mutationFn: async (item) => {
            const novoEstado = !item.isFavorite;
            await updateDoc(doc(db, "biblioteca", item.id), { isFavorite: novoEstado });
            return { id: item.id, isFavorite: novoEstado };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries(['biblioteca', user?.uid, 'favorites']);
            queryClient.setQueryData(['biblioteca', user?.uid, abaAtual], (oldData) => {
                return oldData.map(book => book.id === result.id ? { ...book, isFavorite: result.isFavorite } : book);
            });
            toast.success(result.isFavorite ? "Added to Favorites" : "Removed from Favorites");
        }
    });

    const renderItem = React.useCallback((index, item) => (
        <div className="bg-[#1f1f1f] rounded-xl overflow-hidden border border-[#333] flex flex-col sm:flex-row transition-all hover:border-zinc-500/30 group relative mb-4">
            <button onClick={() => mutationFavorite.mutate(item)} className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100">
                {item.isFavorite ? <MdFavorite className="text-red-500" /> : <MdFavoriteBorder />}
            </button>
            <Link to={`/story/${item.obraId}`} className="sm:w-32 h-48 sm:h-auto shrink-0 relative bg-[#111]">
                <img src={item.capa || '/logo-ah.png'} loading="lazy" alt={item.tituloObra} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" onError={(e) => { e.target.onerror = null; e.target.src = '/logo-ah.png'; }} />
                {item.isFavorite && <div className="absolute top-0 left-2 w-4 h-6 bg-red-600 shadow-lg clip-path-ribbon"></div>}
            </Link>
            <div className="flex-1 p-5 flex flex-col justify-between">
                <div>
                    <Link to={`/story/${item.obraId}`}><h3 className="text-white font-bold text-lg leading-tight mb-1 group-hover:text-zinc-400 transition-colors">{item.tituloObra}</h3></Link>
                    <div className="mt-3">
                        {item.progresso !== null && (
                            <>
                                <div className="flex justify-between items-center text-xs text-gray-400 mb-1 font-bold uppercase tracking-wide"><span>Progress</span><span className={item.progresso === 100 ? "text-green-500" : "text-zinc-400"}>{item.progresso}%</span></div>
                                <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2"><div className={`h-full transition-all duration-1000 ${item.progresso === 100 ? 'bg-green-600' : 'bg-zinc-600'}`} style={{ width: `${item.progresso}%` }}></div></div>
                            </>
                        )}
                        <p className="text-xs text-gray-500 mt-2">Last read: <span className="text-gray-300 italic">{item.ultimoCapituloLido}</span></p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#2a2a2a]">
                    <select value={item.status || 'reading'} onChange={(e) => mutationStatus.mutate({ id: item.id, novoStatus: e.target.value })} className="bg-[#252525] text-gray-400 text-xs py-1.5 px-3 rounded-lg border border-[#444] outline-none cursor-pointer focus:border-zinc-500">
                        <option value="reading">Reading</option><option value="completed">Completed</option><option value="plan">Plan to Read</option><option value="remove">Remove</option>
                    </select>
                    <Link to={item.ultimoCapituloId ? `/read/${item.ultimoCapituloId}` : `/story/${item.obraId}`} className={`px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${item.progresso === 100 ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]' : 'bg-zinc-600 hover:bg-zinc-500 text-white shadow-lg'}`}>
                        <MdPlayArrow size={16} /> {item.ultimoCapituloId ? "Continue" : "Start"}
                    </Link>
                </div>
            </div>
        </div>
    ), [mutationFavorite, mutationStatus]);

    return (
        <div className="max-w-[900px] mx-auto px-5 py-5 pb-20">
            <div className="flex items-center gap-2.5 mb-7 border-b border-[#333] pb-4">
                <MdLibraryBooks size={28} className="text-[#4a90e2]" />
                <h2 className="text-white m-0 text-2xl font-bold">My Library</h2>
            </div>
            <div className="flex flex-wrap gap-3 mb-8">
                {['reading', 'plan', 'completed', 'favorites'].map(aba => (
                    <button key={aba} onClick={() => setAbaAtual(aba)} className={`capitalize px-4 py-2 rounded-full font-bold text-sm transition-all ${abaAtual === aba ? 'bg-zinc-600 text-white' : 'bg-[#252525] text-gray-400'}`}>{aba}</button>
                ))}
            </div>

            {/* VERIFICAÇÃO DE ESTADO DO AUTH */}
            {loadingAuth || isLoading ? (
                <div className="loading-spinner"></div>
            ) : isError ? (
                <div className="text-red-400 flex flex-col items-center gap-2 text-center py-10">
                    <MdErrorOutline size={30} />
                    <span>Error loading library.</span>
                    <span className="text-xs text-gray-500">If you are the admin, check the console (F12) for Firestore Index links.</span>
                </div>
            ) : livros.length === 0 ? (
                <div className="text-center py-16 bg-[#1f1f1f] rounded-xl">
                    <p className="text-gray-500">No books found in {abaAtual}.</p>
                </div>
            ) : (
                <Virtuoso useWindowScroll data={livros} totalCount={livros.length} overscan={200} itemContent={renderItem} />
            )}
            <style>{`.clip-path-ribbon { clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }`}</style>
        </div>
    );
}