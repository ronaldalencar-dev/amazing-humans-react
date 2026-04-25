import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { MdClose } from 'react-icons/md';
import { AuthContext } from '../contexts/AuthContext';

export default function WelcomeModal() {
  const { signed, loadingAuth } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Wait until auth state is determined
    if (loadingAuth) return;

    // Only show if user is NOT logged in and hasn't seen the modal this session
    if (!signed) {
      const hasSeen = sessionStorage.getItem('welcomeShown');
      if (!hasSeen) {
        setIsOpen(true);
      }
    }
  }, [signed, loadingAuth]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('welcomeShown', 'true');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-[#1a1a1a] border border-white/10 p-8 md:p-10 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in text-center z-10">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
        >
          <MdClose size={24} />
        </button>

        <div className="mb-6">
          <img src="/logo-ah.png" alt="Amazing Humans" className="h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Amazing Humans!</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Discover a new universe of storytelling. Read thousands of original books and interactive branching stories completely for free.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          <Link 
            to="/how-it-works" 
            onClick={handleClose}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20"
          >
            See How it Works
          </Link>
          <button 
            onClick={handleClose}
            className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-gray-300 font-bold py-3 px-6 rounded-xl transition-all"
          >
            Just Browse
          </button>
        </div>
      </div>
    </div>
  );
}
