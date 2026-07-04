import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, orderBy, getDocs, writeBatch, limit, startAfter } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { MdDeleteForever, MdHistory, MdAccessTime, MdMenuBook, MdExpandMore } from 'react-icons/md';
import { Virtuoso } from 'react-virtuoso';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 20;

export default function History() {
    const { user } = useContext(AuthContext);
    const queryClient = useQueryClient();

    // 1. QUERY INFINITA COM CACHE
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError
    } = useInfiniteQuery({
        initialPageParam: null,
        queryKey: ['historico', user?.uid],
        queryFn: async ({ pageParam = null }) => {
            if (!user?.uid) return { items: [], nextCursor: null };

            const historyRef = collection(db, "historico");

            // NOTA: Se der erro de índice no console, clique no link fornecido pelo Firebase.
            // Índice necessário: userId (Asc/Desc) + accessedAt (Desc)
            let q = query(
                historyRef,
                where("userId", "==", user.uid),
                orderBy("accessedAt", "desc"),
                limit(ITEMS_PER_PAGE)
            );

            if (pageParam) {
                q = query(
                    historyRef,
                    where("userId", "==", user.uid),
                    orderBy("accessedAt", "desc"),
                    startAfter(pageParam),
                    limit(ITEMS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];

            return { items, nextCursor: lastVisible };
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.items.length < ITEMS_PER_PAGE) return undefined;
            return lastPage.nextCursor;
        },
        enabled: !!user?.uid,
        staleTime: 1000 * 60 * 10, // 10 minutos de cache
    });

    // 2. MUTAÇÃO PARA LIMPAR HISTÓRICO (Lote de 500 para segurança)
    const clearHistoryMutation = useMutation({
        mutationFn: async () => {
            // Apaga os 500 mais recentes (limite seguro do Firestore para um batch)
            const q = query(collection(db, "historico"), where("userId", "==", user.uid), limit(500));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return 0;

            const batch = writeBatch(db);
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            return snapshot.size;
        },
        onSuccess: (count) => {
            // Atualiza a tela imediatamente
            queryClient.invalidateQueries(['historico', user?.uid]);
            if (count > 0) toast.success(`Cleared ${count} items from history.`);
            else toast("History is already empty.");
        },
        onError: () => toast.error("Error clearing history.")
    });

    const handleClearHistory = () => {
        if (window.confirm("Are you sure you want to clear your reading history?")) {
            clearHistoryMutation.mutate();
        }
    };

    // Achata as páginas em uma única lista para o Virtuoso
    const allItems = data?.pages.flatMap(page => page.items) || [];

    const renderItem = React.useCallback((index, item) => (
        <div className="bg-[#1f1f1f] border border-[#333] p-4 rounded-xl flex items-center justify-between hover:border-zinc-500/30 transition-all mb-3 group">
            <div className="flex flex-col gap-1">
                <h4 className="text-white font-bold text-base flex items-center gap-2">
                    <MdMenuBook className="text-gray-500" /> {item.bookTitle}
                </h4>
                <p className="text-zinc-400 text-sm font-medium flex items-center gap-1">
                    Chapter: <span className="text-gray-300">{item.lastChapterTitle}</span>
                </p>
                <span className="text-xs text-gray-600 flex items-center gap-1">
                    <MdAccessTime /> {item.accessedAt ? new Date(item.accessedAt.seconds * 1000).toLocaleString() : 'Unknown'}
                </span>
            </div>

            <Link
                to={`/read/${item.lastChapterId}`}
                className="bg-[#2a2a2a] hover:bg-zinc-600 text-white p-3 rounded-full transition-all shadow-lg group-hover:scale-110"
                title="Read Again"
            >
                <MdHistory size={20} />
            </Link>
        </div>
    ), []);

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 pb-20">

            <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
                <div className="flex items-center gap-3">
                    <MdHistory size={28} className="text-zinc-500" />
                    <h2 className="text-2xl font-bold text-white">Reading History</h2>
                </div>
                {allItems.length > 0 && (
                    <button
                        onClick={handleClearHistory}
                        disabled={clearHistoryMutation.isPending}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <MdDeleteForever size={16} /> {clearHistoryMutation.isPending ? 'Clearing...' : 'Clear History'}
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="loading-spinner"></div>
            ) : isError ? (
                <div className="text-center py-10 text-red-400">Error loading history. Check console for Index link.</div>
            ) : allItems.length === 0 ? (
                <div className="text-center py-16 bg-[#1f1f1f] rounded-xl border border-dashed border-[#444]">
                    <MdMenuBook size={40} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">You haven't read anything yet.</p>
                    <Link to="/" className="text-zinc-500 text-sm font-bold mt-2 hover:underline">Start Reading</Link>
                </div>
            ) : (
                <Virtuoso
                    useWindowScroll
                    data={allItems}
                    totalCount={allItems.length}
                    overscan={200}
                    itemContent={renderItem}
                    components={{
                        Footer: () => (
                            hasNextPage ? (
                                <div className="py-6 flex justify-center">
                                    <button
                                        onClick={() => fetchNextPage()}
                                        disabled={isFetchingNextPage}
                                        className="px-6 py-2 bg-[#252525] hover:bg-[#333] border border-[#444] rounded-full text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isFetchingNextPage ? 'Loading...' : <>Load More <MdExpandMore size={18} /></>}
                                    </button>
                                </div>
                            ) : <div className="pb-8"></div>
                        )
                    }}
                />
            )}
        </div>
    );
}