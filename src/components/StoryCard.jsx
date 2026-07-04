import React from 'react';
import { Link } from 'react-router-dom';
import { MdStar } from 'react-icons/md';
import { FiGitBranch } from 'react-icons/fi';
import SmartImage from './SmartImage';

export default function StoryCard({ data }) {
  // O SmartImage já lida com o fallback da imagem, não precisamos da lógica manual aqui

  return (
    <Link to={`/story/${data.id}`} className="group flex flex-col w-full text-decoration-none relative" title={data.titulo}>

      {/* CAPA - Efeitos de hover melhorados */}
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-lg bg-[#222] shadow-lg group-hover:shadow-glow transition-all duration-500 border border-white/5">

        {/* Overlay Gradiente no Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>

        {/* AQUI ESTÁ A MUDANÇA: Usamos SmartImage em vez de img */}
        <SmartImage
          src={data.capa}
          alt={data.titulo}
          className="w-full h-full group-hover:scale-110 transition-transform duration-500"
        />

        {/* Rating Badge Flutuante */}
        {data.rating > 0 && (
          <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm border border-white/10 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <MdStar size={10} /> {data.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3">
        <h4 className="text-gray-100 font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors h-[2.5em]">
          {data.titulo}
        </h4>

        <div className="flex flex-wrap gap-1 mt-2">
          {data.categorias?.includes('Interactive') && (
            <span className="text-[9px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <FiGitBranch size={8} /> Interactive
            </span>
          )}
          {data.categorias && data.categorias.filter(c => c !== 'Interactive').slice(0, 1).map((cat, i) => (
            <span key={i} className="text-[9px] uppercase font-bold text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-1.5 py-0.5 rounded">
              {cat}
            </span>
          ))}
        </div>
      </div>

    </Link>
  );
}