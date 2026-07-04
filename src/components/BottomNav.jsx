import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { MdHome, MdSearch, MdEditNote, MdPerson } from 'react-icons/md';

export default function BottomNav() {
  const location = useLocation();
  const { signed } = useContext(AuthContext);

  // Não renderiza em telas grandes (lg)
  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 z-[999] pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
      <div className="flex justify-around items-center h-16 px-2">
        
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${location.pathname === '/' && !location.search ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>
          <MdHome size={24} />
          <span className="text-[10px] font-bold">Home</span>
        </Link>

        {/* Ao clicar, leva para a Home. O componente Home pode ler a querystring ou apenas focar no input existente */}
        <Link to="/?searchFocus=true" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${location.search.includes('searchFocus') ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>
          <MdSearch size={24} />
          <span className="text-[10px] font-bold">Search</span>
        </Link>

        {signed && (
          <Link to="/escrever" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${location.pathname.includes('/escrever') ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>
            <MdEditNote size={24} />
            <span className="text-[10px] font-bold">Write</span>
          </Link>
        )}

        <Link to={signed ? "/perfil" : "/login"} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${location.pathname.includes('/perfil') || location.pathname.includes('/login') ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>
          <MdPerson size={24} />
          <span className="text-[10px] font-bold">{signed ? "Profile" : "Login"}</span>
        </Link>

      </div>
    </div>
  );
}
