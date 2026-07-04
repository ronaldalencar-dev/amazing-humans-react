import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConnection';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import StoryCard from './StoryCard';
import { MdChevronLeft, MdChevronRight, MdAutoAwesome } from 'react-icons/md';

export default function Recommendations({ tags, currentId = null, title = "Recommended for You" }) {
  const [livros, setLivros] = useState([]);
  const scrollRef = useRef(null);

  // Busca livros baseados nas tags
  useEffect(() => {
    async function loadRecs() {
      if (!tags || tags.length === 0) return;

      try {
        // O Firestore limita 'array-contains-any' a 10 itens
        const tagsLimitadas = tags.slice(0, 10);

        const q = query(
          collection(db, "obras"),
          where("status", "==", "public"),
          where("categorias", "array-contains-any", tagsLimitadas),
          limit(10)
        );

        const snapshot = await getDocs(q);
        let lista = [];
        
        snapshot.forEach((doc) => {
          // Não recomenda o próprio livro que a pessoa está vendo
          if (doc.id !== currentId) {
            lista.push({ id: doc.id, ...doc.data() });
          }
        });

        setLivros(lista);
      } catch (error) {
        console.error("Erro recomendação:", error);
      }
    }

    loadRecs();
  }, [tags, currentId]);

  // Funções de Scroll do Carrossel
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = 300; // Pixels para rolar
      if (direction === 'left') {
        current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  if (livros.length === 0) return null;

  return (
    <div className="rr-rec-section" style={{ margin: '40px 0' }}>
      <div className="rr-rec-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15, borderBottom: '1px solid #333', paddingBottom: 10 }}>
        <MdAutoAwesome style={{ color: '#d9a404', fontSize: '1.5rem' }} />
        <h3 style={{ color: '#d9a404', textTransform: 'uppercase', fontSize: '1rem', letterSpacing: '1px', margin: 0 }}>
          {title}
        </h3>
      </div>

      <div className="rr-carousel-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        
        <button 
          onClick={() => scroll('left')}
          className="carousel-btn"
          style={{ position: 'absolute', left: 0, zIndex: 10, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <MdChevronLeft size={30} />
        </button>

        <div 
          ref={scrollRef}
          className="rr-carousel-track" 
          style={{ 
            display: 'flex', 
            gap: 15, 
            overflowX: 'auto', 
            scrollBehavior: 'smooth', 
            paddingBottom: 10, 
            width: '100%', 
            scrollbarWidth: 'none', // Firefox
            paddingLeft: 50, 
            paddingRight: 50 
          }}
        >
          {livros.map(livro => (
             <div key={livro.id} style={{ minWidth: '160px', maxWidth: '160px' }}>
                <StoryCard data={livro} />
             </div>
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="carousel-btn"
          style={{ position: 'absolute', right: 0, zIndex: 10, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <MdChevronRight size={30} />
        </button>

      </div>
    </div>
  );
}