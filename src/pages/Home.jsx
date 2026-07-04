import React, { useState, useContext, forwardRef, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { MdSearch, MdList, MdAutoAwesome, MdCheck, MdExpandMore, MdErrorOutline } from 'react-icons/md';
import { FiGitBranch } from 'react-icons/fi';
import { VirtuosoGrid } from 'react-virtuoso';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'; // <--- OTIMIZAÇÃO
import StoryCard from '../components/StoryCard';
import SkeletonCard from '../components/SkeletonCard';
import Recomendacoes from '../components/Recomendacoes';
import AdBanner from '../components/AdBanner';
import HeroCarousel from '../components/HeroCarousel';
import { Helmet } from 'react-helmet-async';

// --- COMPONENTES GRID (Mantidos) ---
const GridList = forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 place-items-start pb-4">
    {children}
  </div>
));
const GridItem = forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props} className="w-full max-w-[170px] mx-auto">{children}</div>
));

const ITEMS_PER_PAGE = 24;

const categoriesList = ["All", "Fantasy", "Sci-Fi", "Romance", "Horror", "Adventure", "RPG", "Mystery", "Action", "Isekai", "FanFic", "HFY", "Interactive"];

export default function Home() {
  const { user } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [showFilter, setShowFilter] = useState(false);
  const location = useLocation();
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (location.search.includes('searchFocus') && searchInputRef.current) {
      searchInputRef.current.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.search]);

  // 1. CARREGAR HISTÓRICO (Cache simples com useQuery)
  const { data: lastTags } = useQuery({
    queryKey: ['userHistory', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const q = query(collection(db, "historico"), where("userId", "==", user.uid), orderBy("accessedAt", "desc"), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return [];
      const obraId = snap.docs[0].data().obraId;
      const qObra = query(collection(db, "obras"), where("__name__", "==", obraId));
      const snapObra = await getDocs(qObra);
      return !snapObra.empty ? (snapObra.docs[0].data().categorias || []) : [];
    },
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 30 // 30 min de cache para essa recomendação
  });

  // 2. BUSCA PRINCIPAL (Infinite Query)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    initialPageParam: null,
    queryKey: ['stories', category, searchTerm], // A chave muda, o React Query cacheia separadamente!
    queryFn: async ({ pageParam = null }) => {
      const storiesRef = collection(db, "obras");
      let q;
      let constraints = [where("status", "==", "public"), limit(ITEMS_PER_PAGE)];

      // LÓGICA DE BUSCA
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();

        let qSearch = query(
          storiesRef,
          where("status", "==", "public"),
          where("searchKeywords", "array-contains", term),
          limit(50)
        );

        // Se tiver categoria selecionada, podemos tentar filtrar (exige índice composto no Firebase)
        // Se der erro de índice no console, o Firebase vai gerar um link para você clicar e criar.
        if (category !== 'All') {
          qSearch = query(
            storiesRef,
            where("status", "==", "public"),
            where("searchKeywords", "array-contains", term),
            where("categorias", "array-contains", category),
            limit(50)
          );
        }

        const snap = await getDocs(qSearch);
        let items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

        // Se usar o filtro duplo acima (searchKeywords + categorias),
        // o filtro manual abaixo não é mais necessário, mas serve de fallback.
        if (category !== 'All' && items.length > 0) {
          items = items.filter(i => i.categorias?.includes(category));
        }

        return { items, nextCursor: null };
      }
      // LÓGICA DE FEED (PAGINADO)
      constraints.push(orderBy("dataCriacao", "desc"));

      if (category !== "All") {
        constraints.unshift(where("categorias", "array-contains", category));
      }

      if (pageParam) {
        constraints.push(startAfter(pageParam));
      }

      q = query(storiesRef, ...constraints);
      const snapshot = await getDocs(q);

      const items = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];

      return { items, nextCursor: lastVisible };
    },
    getNextPageParam: (lastPage) => {
      // Se veio menos itens que o limite, acabou. Senão, retorna o cursor.
      if (lastPage.items.length < ITEMS_PER_PAGE) return undefined;
      return lastPage.nextCursor;
    },
    staleTime: 1000 * 60 * 10 // 10 minutos sem refetch
  });

  // Achatar as páginas em uma lista única para o Virtuoso
  const allStories = data?.pages.flatMap(page => page.items) || [];

  return (
    <div className="pb-20 max-w-[1200px] mx-auto px-4" onClick={() => setShowFilter(false)}>

      <Helmet>
        <title>Amazing Humans | Read & Write Stories</title>
        <meta name="description" content="A sanctuary for imagination. Read thousands of stories for free." />
      </Helmet>

      <div className="mt-6">
        <HeroCarousel />
      </div>

      <div className="text-center mt-6 mb-2 px-4 animate-fade-in">
        <p className="text-gray-400 text-sm md:text-base font-light tracking-widest uppercase opacity-70 border-b border-white/5 pb-4 inline-block">
          Science fiction focused on humanity’s resilience, ingenuity, and brutality in the face of the unknown.
        </p>
      </div>

      <div className="flex flex-col-reverse md:flex-row justify-between items-end md:items-center mt-8 mb-4 gap-4 min-h-[40px]">
        <div className="flex-1">
          {lastTags && lastTags.length > 0 && (
            <div className="flex items-center gap-2 text-yellow-500 animate-pulse">
              <MdAutoAwesome />
              <h3 className="font-bold text-sm tracking-wider uppercase">BASED ON WHAT YOU READ</h3>
            </div>
          )}
        </div>

        <div className="flex w-full md:w-auto h-10 shadow-lg relative" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex-1 md:w-72 group">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full bg-[#1a1a1a] border border-[#333] border-r-0 rounded-l-md text-gray-200 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors"
            />
            <MdSearch className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-primary" size={20} />
          </div>

          <div className="relative">
            <button onClick={() => setShowFilter(!showFilter)} className={`h-full w-12 flex items-center justify-center border border-l-0 rounded-r-md transition-colors ${showFilter ? 'bg-zinc-600 border-zinc-600 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white hover:bg-[#252525]'}`}>
              <MdList size={22} />
            </button>
            {showFilter && (
              <div className="absolute right-0 top-12 w-52 bg-[#1f1f1f] border border-[#333] rounded-lg shadow-2xl py-2 z-50 animate-fade-in max-h-60 overflow-y-auto">
                {categoriesList.map((cat) => (
                  cat === 'Interactive' ? (
                    <button key={cat} onClick={() => { setCategory(cat); setShowFilter(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-zinc-900/20 border-t border-[#333] mt-1 pt-2 ${category === cat ? 'text-zinc-400 font-bold bg-zinc-500/10' : 'text-zinc-400/70 hover:text-zinc-300'}`}>
                      <span className="flex items-center gap-2"><FiGitBranch size={13} /> {cat}</span>
                      {category === cat && <MdCheck size={16} />}
                    </button>
                  ) : (
                    <button key={cat} onClick={() => { setCategory(cat); setShowFilter(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[#2a2a2a] ${category === cat ? 'text-primary font-bold bg-primary/10' : 'text-gray-300'}`}>
                      {cat} {category === cat && <MdCheck size={16} />}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lastTags && lastTags.length > 0 && <div className="-mt-6 mb-12"><Recomendacoes tags={lastTags} title="" /></div>}
      <AdBanner className="mb-10" />

      <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-6 mt-2">
        <div className="h-6 w-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(74,144,226,0.5)]"></div>
        <h2 className="text-xl font-bold text-white m-0 tracking-wide">New Releases</h2>
        {category !== "All" && (
          <span className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${category === 'Interactive'
              ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
              : 'bg-primary/20 text-primary border-primary/30'
            }`}>
            {category === 'Interactive' && <FiGitBranch size={11} />}{category}
          </span>
        )}
      </div>

      {/* --- ESTADOS DE CARREGAMENTO E ERRO --- */}
      {status === 'loading' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : status === 'error' ? (
        <div className="text-center py-20 text-red-400"><MdErrorOutline size={40} className="mx-auto mb-2" />Error loading stories.</div>
      ) : allStories.length === 0 ? (
        <div className="col-span-full w-full py-16 bg-[#1f1f1f] border border-[#333] rounded-lg text-center flex flex-col items-center justify-center gap-3">
          <MdSearch size={40} className="text-gray-600" />
          <p className="text-gray-400 font-medium">No stories found.</p>
        </div>
      ) : (
        /* --- GRID VIRTUAL COM REACT QUERY --- */
        <VirtuosoGrid
          useWindowScroll
          data={allStories}
          totalCount={allStories.length}
          overscan={200}
          components={{
            List: GridList,
            Item: GridItem,
            Footer: () => (
              isFetchingNextPage ? (
                <div className="py-8 flex justify-center w-full col-span-full">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : hasNextPage && !searchTerm ? (
                <div className="py-8 flex justify-center w-full col-span-full">
                  <button onClick={() => fetchNextPage()} className="px-8 py-3 bg-[#1f1f1f] hover:bg-[#252525] border border-[#333] rounded-full text-white font-bold transition-all flex items-center gap-2">
                    Load More <MdExpandMore size={20} />
                  </button>
                </div>
              ) : <div className="pb-8"></div>
            )
          }}
          itemContent={(index, story) => <StoryCard data={story} />}
        />
      )}
    </div>
  );
}