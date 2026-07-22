import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConnection';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { MdPlayArrow, MdStar, MdInfoOutline } from 'react-icons/md';
import SmartImage from './SmartImage'; // Importar SmartImage
import SkeletonHero from './SkeletonHero'; // Importar o novo Skeleton

export default function HeroCarousel() {
  const [featured, setFeatured] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const q = query(
          collection(db, "obras"),
          where("status", "==", "public"),
          orderBy("views", "desc"),
          limit(5)
        );
        const snap = await getDocs(q);
        let lista = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
        
        lista.unshift({
          id: 'amazing-humans-invite',
          isStatic: true,
          capa: '/amazing_humans_invite.png',
          titulo: 'Join Our Unique Community!',
          sinopse: 'Publish your stories and ideas on AmazingHumans. Let\'s build a world of incredible stories and an unforgettable community together.',
          rating: 5.0
        });
        
        setFeatured(lista);
      } catch (e) {
        console.error("Hero Error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  useEffect(() => {
    if (featured.length === 0) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev === featured.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [featured]);

  // Se estiver carregando, mostra o esqueleto ao invés de null (evita pulo na tela)
  if (loading) return <SkeletonHero />;

  // Se carregou e não tem nada, retorna null
  if (featured.length === 0) return null;

  const item = featured[current];
  const hasCover = item.capa && (item.capa.startsWith('http') || item.capa.startsWith('/'));
  const bgImage = hasCover ? `url("${item.capa}")` : 'none';

  return (
    <div className="relative w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl mb-12 group bg-[#111] border border-white/5 animate-fade-in">

      {/* Background Image (Blurred) */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105 opacity-40"
        style={{ backgroundImage: bgImage }}
      >
        {!hasCover && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900/20 to-purple-900/20">
            <img src="/logo-ah.png" alt="Logo" className="w-32 opacity-10 grayscale" />
          </div>
        )}

        {/* Gradientes de sobreposição */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
      </div>

      {/* Conteúdo */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 flex flex-col md:flex-row items-end md:items-center gap-8">

        {/* Capa Menor (Poster) com SmartImage */}
        <div className="hidden md:block w-48 aspect-[2/3] rounded-lg shadow-2xl overflow-hidden border border-white/10 relative z-10 shrink-0 transform group-hover:-translate-y-2 transition-transform duration-500 bg-[#222]">
          <SmartImage
            src={item.capa}
            alt={item.titulo}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Textos */}
        <div className="flex-1 max-w-2xl relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-secondary text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">Top Rated</span>
            <span className="flex items-center gap-1 text-secondary text-xs font-bold"><MdStar /> {item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight drop-shadow-lg line-clamp-2">
            {item.titulo}
          </h2>

          <p className="text-gray-300 text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-6 max-w-lg drop-shadow-md">
            {item.sinopse?.replace(/<[^>]*>?/gm, '') || "No description available."}
          </p>

          <div className="flex gap-4">
            {item.isStatic ? (
              <Link to="/write" className="btn-primary px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all transform hover:scale-105">
                <MdPlayArrow size={24} /> <span>Start Writing</span>
              </Link>
            ) : (
              <>
                <Link to={`/story/${item.id}`} className="btn-primary px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all transform hover:scale-105">
                  <MdPlayArrow size={24} /> <span>Read Now</span>
                </Link>
                <Link to={`/story/${item.id}`} className="bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
                  <MdInfoOutline size={20} /> <span>Details</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Indicadores (Dots) */}
      <div className="absolute bottom-6 right-6 md:right-12 flex gap-2 z-20">
        {featured.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${current === idx ? 'w-8 bg-primary' : 'w-2 bg-gray-600 hover:bg-gray-400'}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}