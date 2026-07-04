import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../services/firebaseConnection';
import {
    doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, deleteDoc, serverTimestamp,
    limit, onSnapshot
} from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import {
    MdEdit, MdMenuBook, MdPerson, MdStar, MdBookmarkAdded, MdBookmarkBorder,
    MdInfoOutline, MdVisibility, MdList, MdFlag, MdVerified, MdNavigateNext, MdNavigateBefore
} from 'react-icons/md';
import { FaPatreon } from 'react-icons/fa';
import Recommendations from '../components/Recommendations';
import SkeletonStory from '../components/SkeletonStory';
import Reviews from '../components/Reviews';
import RatingWidget from '../components/RatingWidget';
import SmartImage from '../components/SmartImage';
import AdBanner from '../components/AdBanner';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import ReportModal from '../components/ReportModal';

// Constantes
const CHAPTERS_PER_PAGE = 10;

export default function Story() {
    const { id } = useParams();
    const { user } = useContext(AuthContext);

    // States
    const [obra, setObra] = useState(null);
    const [authorData, setAuthorData] = useState(null);
    const [capitulos, setCapitulos] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMoreDocs, setHasMoreDocs] = useState(true);
    const [chaptersCache, setChaptersCache] = useState({});
    const [loadingCaps, setLoadingCaps] = useState(false);
    const [loading, setLoading] = useState(true);
    const [estaNaBiblioteca, setEstaNaBiblioteca] = useState(false);
    const [idBiblioteca, setIdBiblioteca] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [lastReadId, setLastReadId] = useState(null);
    const [showFullSynopsis, setShowFullSynopsis] = useState(false);
    const [obraCollections, setObraCollections] = useState([]);

    // --- CARREGAMENTO PRINCIPAL ---
    // --- REAL-TIME: Story Listener ---
    useEffect(() => {
        let unsubscribe;

        async function setupListener() {
            const docRef = doc(db, "obras", id);

            unsubscribe = onSnapshot(docRef, (snapshot) => {
                if (!snapshot.exists()) {
                    toast.error("Book not found!");
                    setLoading(false);
                    return;
                }

                const dadosObra = { id: snapshot.id, ...snapshot.data() };

                // Atualiza o estado da obra em tempo real
                setObra(prev => {
                    // Se o documento vier com autor atualizado (via Cloud Function), usa ele.
                    // Preserva badges se já existirem no estado anterior e não vierem no novo (embora setupListener não traga badges do user)

                    const novoEstado = { ...dadosObra };

                    // Se já tínhamos badges carregadas e o ID do autor não mudou, preserva.
                    if (prev?.autorId === dadosObra.autorId && prev?.autorBadges) {
                        novoEstado.autorBadges = prev.autorBadges;
                    }

                    // O nome 'autor' agora vem do documento da obra (atualizado pela CF), 
                    // então confiamos em 'posteriores' atualizações do snapshot.

                    return novoEstado;
                });

                // Calcula total de páginas sempre que totalChapters mudar
                const totalCaps = dadosObra.totalChapters || 0;
                setTotalPages(totalCaps > 0 ? Math.ceil(totalCaps / CHAPTERS_PER_PAGE) : 1);

                setLoading(false);
            }, (error) => {
                console.error("Erro no listener da obra:", error);
                setLoading(false);
            });
        }

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [id]);

    // --- EFFECT: Carregar Autor (Qdo obra for setada/atualizada e tiver autorId) ---
    // --- EFFECT: Monitorar Autor em Tempo Real (Substitui busca única) ---
    useEffect(() => {
        // Limpa dados do autor anterior ao mudar de obra/autor
        if (!obra?.autorId) {
            setAuthorData(null);
            return;
        }

        const userRef = doc(db, "usuarios", obra.autorId);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const uData = docSnap.data();
                setAuthorData({ 
                    nome: uData.nome, 
                    badges: uData.badges || [],
                    patreon: uData.patreon || null
                });
            }
        }, (error) => {
            console.error("Erro ao monitorar autor:", error);
        });

        return () => unsubscribe();
    }, [obra?.autorId]);

    // --- EFFECT: Recarregar capítulos se o total mudar (ex: novo cap publicado) ---
    useEffect(() => {
        if (obra?.totalChapters) {
            // Limpa o cache para garantir que a lista atualize, ou invalida a página atual
            setChaptersCache({});
            fetchChapters(page); // Recarrega a página atual
        }
    }, [obra?.totalChapters, page]); // Se mudar page ou totalChapters, busca.

    // --- EFFECT: Carregar Histórico Inicialmente ---
    useEffect(() => {
        if (user?.uid && id) {
            async function loadHistory() {
                try {
                    const histRef = doc(db, "historico", `${user.uid}_${id}`);
                    const histSnap = await getDoc(histRef);
                    if (histSnap.exists()) {
                        setLastReadId(histSnap.data().lastChapterId);
                    }
                } catch (histErr) { console.warn("History error", histErr); }
            }
            loadHistory();
        }
    }, [user?.uid, id]);

    // --- BUSCA DE CAPÍTULOS ---
    async function fetchChapters(pageNumber) {
        setLoadingCaps(true);
        // Delay artificial de quase 2 segundos para apreciar o loader
        await new Promise(resolve => setTimeout(resolve, 1800));

        if (chaptersCache[pageNumber]) {
            setCapitulos(chaptersCache[pageNumber]);
            setPage(pageNumber);
            setHasMoreDocs(chaptersCache[pageNumber].length === CHAPTERS_PER_PAGE);
            setLoadingCaps(false);
            return;
        }

        try {
            const capsRef = collection(db, "capitulos");
            const limitDocs = pageNumber * CHAPTERS_PER_PAGE;

            const q = query(
                capsRef,
                where("obraId", "==", id),
                where("data", "<=", new Date()), // <--- NOVO: Filtra capítulos agendados
                orderBy("data", "asc"),
                limit(limitDocs)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                let listaCaps = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

                setHasMoreDocs(listaCaps.length === limitDocs);

                const startIndex = (pageNumber - 1) * CHAPTERS_PER_PAGE;
                const pageCaps = listaCaps.slice(startIndex, startIndex + CHAPTERS_PER_PAGE);

                setChaptersCache(prev => ({ ...prev, [pageNumber]: pageCaps }));
                setCapitulos(pageCaps);
                setPage(pageNumber);
            } else {
                setCapitulos([]);
                setHasMoreDocs(false);
            }

        } catch (err) {
            console.error("Error fetching chapters:", err);
        } finally {
            setLoadingCaps(false);
        }
    }

    const handleNextPage = () => fetchChapters(page + 1);
    const handlePrevPage = () => { if (page > 1) fetchChapters(page - 1); };

    // --- EFEITO: Library ---
    useEffect(() => {
        async function checkLibrary() {
            if (!user?.uid || !id) return;
            try {
                const qLib = query(collection(db, "biblioteca"), where("userId", "==", user.uid), where("obraId", "==", id));
                const snapLib = await getDocs(qLib);
                if (!snapLib.empty) { setEstaNaBiblioteca(true); setIdBiblioteca(snapLib.docs[0].id); }
                else { setEstaNaBiblioteca(false); setIdBiblioteca(null); }
            } catch (e) { console.log("Erro library", e); }
        }
        checkLibrary();
    }, [id, user]);

    // --- EFFECT: Buscar Coleções ---
    useEffect(() => {
        if (!id) return;
        async function fetchCollections() {
            try {
                const q = query(collection(db, "colecoes"), where("obrasIds", "array-contains", id));
                const snap = await getDocs(q);
                let colList = [];
                snap.forEach(doc => colList.push({ id: doc.id, ...doc.data() }));
                setObraCollections(colList);
            } catch (err) {
                console.error("Erro ao buscar coleções:", err);
            }
        }
        fetchCollections();
    }, [id]);

    // --- TOGGLE LIBRARY ---
    async function toggleBiblioteca() {
        if (!user) return toast.error("Login required.");
        try {
            if (estaNaBiblioteca) {
                await deleteDoc(doc(db, "biblioteca", idBiblioteca));
                setEstaNaBiblioteca(false);
                toast.success("Removed from library");
            } else {
                const docRef = await addDoc(collection(db, "biblioteca"), {
                    userId: user.uid, obraId: id, tituloObra: obra.titulo, status: 'reading', dataAdicao: serverTimestamp()
                });
                setEstaNaBiblioteca(true);
                setIdBiblioteca(docRef.id);
                toast.success("Added to library!");
            }
        } catch (error) { toast.error("Error updating library"); }
    }

    // --- RENDERIZAÇÃO SEGURA ---


    const isAuthor = user?.uid === obra?.autorId;
    const cleanSinopse = React.useMemo(() => obra?.sinopse ? obra.sinopse.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : 'Read on Amazing Humans.', [obra?.sinopse]);

    if (loading) return <SkeletonStory />;

    if (!obra) return (
        <div className="min-h-screen flex items-center justify-center text-white">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Book not found</h2>
                <Link to="/" className="text-primary hover:underline">Voltar para Home</Link>
            </div>
        </div>
    );

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "Book",
        "name": obra.titulo,
        "description": cleanSinopse
    };

    return (
        <div className="min-h-screen pb-20 relative">
            <Helmet>
                <title>{obra.titulo} | Amazing Humans</title>
                <meta name="description" content={cleanSinopse} />
                <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
            </Helmet>

            <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} targetId={id} targetType="book" targetName={obra.titulo} />

            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-[#121212] blur-[100px] pointer-events-none z-0"></div>

            <div className="max-w-6xl mx-auto px-4 relative z-10 pt-10">
                <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-12">

                    {/* CAPA */}
                    <div className="w-full md:w-64 lg:w-72 shrink-0 mx-auto md:mx-0">
                        <div className="relative aspect-[2/3] rounded-lg shadow-2xl overflow-hidden border border-white/10 bg-[#222]">
                            <SmartImage src={obra.capa} alt={obra.titulo} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    {/* INFO */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start">
                            <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-3 leading-tight">{obra.titulo}</h1>
                            <button onClick={() => setShowReport(true)} className="text-gray-500 hover:text-red-500 p-2 rounded-full hover:bg-white/5 transition-colors"><MdFlag size={20} /></button>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
                            <Link to={`/user/${obra.autorId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                                <MdPerson /> {authorData?.nome || obra.autor || "Unknown"}
                                {(authorData?.badges || obra.autorBadges)?.includes('pioneer') && <MdVerified className="text-yellow-400" />}
                            </Link>
                            <div className="flex items-center gap-1 text-yellow-500"><MdStar /> {(obra.rating || 0).toFixed(1)}</div>
                            <div className="flex items-center gap-1"><MdVisibility /> {obra.views || 0} Views</div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {obra.categorias?.map((cat, i) => (<span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-gray-300 font-bold uppercase">{cat}</span>))}
                        </div>
                        
                        {obraCollections.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {obraCollections.map(col => (
                                    <div key={col.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary font-bold shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]">
                                        <MdLibraryBooks size={14} />
                                        Collection: {col.nome}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-[#1f1f1f]/80 backdrop-blur-sm border border-white/5 rounded-xl mb-6 relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary z-10"></div>
                            
                            <div className={`p-6 pb-2 transition-all duration-300 relative ${!showFullSynopsis ? 'max-h-[160px] overflow-hidden' : ''}`}>
                                <h3 className="text-white font-bold mb-2 flex items-center gap-2"><MdInfoOutline /> Synopsis</h3>
                                <div className="text-gray-300 leading-relaxed font-serif text-sm md:text-base reader-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(obra.sinopse) }} />
                                
                                {!showFullSynopsis && (
                                    <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-[#1f1f1f] to-transparent pointer-events-none"></div>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                                className="w-full py-3 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-primary/80 hover:text-primary font-bold text-xs uppercase tracking-wider transition-colors border-t border-white/5 flex items-center justify-center gap-1 z-10"
                            >
                                {showFullSynopsis ? 'Show Less' : 'Read More'}
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-4 items-center">
                            <Link
                                to={`/read/${lastReadId || (capitulos.length > 0 ? capitulos[0].id : '')}`}
                                className={`btn-primary px-8 py-3 rounded-full text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-2 ${(!capitulos.length && !lastReadId) ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <MdMenuBook /> {lastReadId ? "Continue Reading" : "Read Now"}
                            </Link>

                            <button onClick={toggleBiblioteca} className={`px-6 py-2.5 rounded-full font-bold flex items-center gap-2 border-2 transition ${estaNaBiblioteca ? 'border-red-500 text-red-500' : 'border-gray-600 text-gray-300'}`}>
                                {estaNaBiblioteca ? <><MdBookmarkAdded /> Library</> : <><MdBookmarkBorder /> Add</>}
                            </button>

                            {authorData?.patreon && authorData.patreon.includes('patreon.com') && (
                                <a 
                                    href={authorData.patreon.startsWith('http') ? authorData.patreon : `https://${authorData.patreon}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="px-6 py-2.5 rounded-full font-bold flex items-center gap-2 border border-[#FF424D] text-[#FF424D] hover:bg-[#FF424D] hover:text-white transition shadow-[0_0_10px_-2px_rgba(255,66,77,0.3)]"
                                >
                                    <FaPatreon /> Support
                                </a>
                            )}

                            {isAuthor && <Link to={`/edit-story/${obra.id}`} className="ml-auto hidden md:flex items-center gap-2 text-gray-400 hover:text-white px-4 py-2 hover:bg-white/5 rounded-lg transition"><MdEdit /> Edit</Link>}
                        </div>
                    </div>
                </div>

                {/* ADS */}
                <div className="md:hidden my-6">
                    <AdBanner tags={obra.categorias} />
                </div>
                <div className="hidden md:block my-8">
                    <AdBanner tags={obra.categorias} />
                </div>

                {/* CAPÍTULOS */}
                <div className="mt-16 md:mt-8">
                    <div className="flex justify-between items-end mb-6">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2"><MdList className="text-primary" /> Chapters</h3>
                        <span className="text-sm text-gray-500">Page {page} {totalPages > 1 && `of ${totalPages}`}</span>
                    </div>

                    {loadingCaps ? (
                        <div className="p-16 flex flex-col items-center justify-center text-gray-500 bg-[#1a1a1a] border border-white/5 rounded-xl">
                            <div className="w-10 h-10 border-4 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
                            <span className="animate-pulse font-medium tracking-wide">Loading chapters...</span>
                        </div>
                    ) : (
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
                            {capitulos.length > 0 ? capitulos.map((cap, i) => {
                                const absoluteIndex = ((page - 1) * CHAPTERS_PER_PAGE) + (i + 1);
                                return (
                                    <Link to={`/read/${cap.id}`} key={cap.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition group">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs w-8 text-center text-gray-600">#{absoluteIndex}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-200 group-hover:text-primary">{cap.titulo}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500 hidden sm:block">{cap.data ? new Date(cap.data.seconds * 1000).toLocaleDateString() : '-'}</span>
                                        </div>
                                    </Link>
                                );
                            }) : (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    {page > 1 ? "No more chapters here." : "No chapters released yet."}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PAGINAÇÃO */}
                    {(capitulos.length > 0 || page > 1) && (
                        <div className="flex justify-center items-center gap-4 mt-8">
                            <button
                                onClick={handlePrevPage}
                                disabled={page === 1 || loadingCaps}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#222] hover:bg-[#333] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <MdNavigateBefore size={20} /> Prev
                            </button>

                            <div className="flex gap-2">
                                <span className="text-gray-400 font-bold bg-[#111] px-4 py-2 rounded-lg border border-white/5">
                                    Page {page}
                                </span>
                            </div>

                            <button
                                onClick={handleNextPage}
                                disabled={loadingCaps || !hasMoreDocs}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                            >
                                Next <MdNavigateNext size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* AVALIAÇÃO */}
                {user && lastReadId && (
                    <div className="max-w-2xl mx-auto mt-16 mb-8">
                        <RatingWidget obraId={id} />
                    </div>
                )}

                <Reviews obraId={id} obraTitulo={obra.titulo} autorId={obra.autorId} />
                {obra.categorias && <div className="mt-20"><Recommendations tags={obra.categorias} currentId={id} title="Similar Stories" /></div>}
            </div>
        </div>
    );
}