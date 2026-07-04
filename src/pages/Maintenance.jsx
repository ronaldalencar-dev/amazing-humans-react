import React from 'react';
import { FaTools, FaCoffee, FaDiscord, FaTwitter } from 'react-icons/fa';
import { MdRocketLaunch, MdAutoAwesome } from 'react-icons/md';

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        
        {/* --- FUNDO ANIMADO (GLOW) --- */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-zinc-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>

        {/* --- CONTEÚDO CENTRAL --- */}
        <div className="relative z-10 max-w-2xl w-full text-center">
            
            {/* Ícone Animado */}
            <div className="mb-8 relative inline-flex justify-center items-center">
                <div className="absolute inset-0 bg-zinc-500 blur-2xl opacity-20 rounded-full animate-ping duration-[3s]"></div>
                <div className="relative bg-[#1a1a1a] border border-white/10 p-6 rounded-full shadow-2xl shadow-zinc-500/10">
                    <MdRocketLaunch size={60} className="text-zinc-400 animate-bounce" />
                </div>
                {/* Estrelinhas decorativas */}
                <MdAutoAwesome className="absolute -top-2 -right-4 text-yellow-400 text-2xl animate-spin-slow" />
                <MdAutoAwesome className="absolute bottom-0 -left-6 text-purple-400 text-xl animate-pulse" />
            </div>

            {/* Títulos */}
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight font-serif">
                We'll be right back.
            </h1>
            
            <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed max-w-lg mx-auto">
                Our writers are crafting new worlds and our developers are polishing the pixels. 
                <span className="block mt-2 text-zinc-400 font-medium">Amazing things are coming!</span>
            </p>

            {/* Card de Status (Glassmorphism) */}
            <div className="flex flex-col md:flex-row justify-center items-center gap-6 text-sm text-gray-400 font-mono bg-white/5 p-6 rounded-2xl border border-white/5 backdrop-blur-md shadow-xl mx-auto w-fit">
                
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="flex items-center gap-2"><FaTools /> Status: <strong className="text-gray-200">Maintenance</strong></span>
                </div>

                <div className="hidden md:block w-px h-4 bg-white/10"></div>

                <div className="flex items-center gap-2">
                    <FaCoffee className="text-gray-500" />
                    <span>Fuel: <strong className="text-gray-200">Coffee & Code</strong></span>
                </div>

                <div className="hidden md:block w-px h-4 bg-white/10"></div>

                <div className="flex items-center gap-2">
                    <span>ETA: <strong className="text-green-400">Very Soon™</strong></span>
                </div>
            </div>

            {/* Botões Sociais (Para não perder tráfego) */}
            <div className="mt-12">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Follow us for updates</p>
                <div className="flex justify-center gap-4">
                    <a href="#" className="p-3 bg-[#1f1f1f] rounded-full text-gray-400 hover:text-white hover:bg-zinc-600 transition-all shadow-lg hover:-translate-y-1">
                        <FaTwitter size={20} />
                    </a>
                    <a href="#" className="p-3 bg-[#1f1f1f] rounded-full text-gray-400 hover:text-white hover:bg-[#5865F2] transition-all shadow-lg hover:-translate-y-1">
                        <FaDiscord size={20} />
                    </a>
                </div>
            </div>

        </div>
        
        {/* Rodapé Fixo */}
        <footer className="absolute bottom-6 text-gray-700 text-xs font-mono">
            ID: AH-MAINTENANCE-MODE // 2025
        </footer>
    </div>
  );
}