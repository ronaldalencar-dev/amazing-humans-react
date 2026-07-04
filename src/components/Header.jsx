import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  MdMenu, MdNotifications, MdPerson, MdEditNote,
  MdBookmarks, MdLogout, MdArrowDropDown,
  MdHome, MdClose, MdInfoOutline, MdSecurity, MdSettings, MdChatBubbleOutline
} from 'react-icons/md';
import { FaCoffee } from 'react-icons/fa';

export default function Header() {
  const { signed, user, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Estados de Notificação
  const [notifCount, setNotifCount] = useState(0);
  const [animateBell, setAnimateBell] = useState(false);
  const prevCountRef = useRef(0);

  const [scrolled, setScrolled] = useState(false);

  const toggleDropdown = () => setShowDropdown(!showDropdown);
  const toggleDrawer = () => setShowDrawer(!showDrawer);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Notificações em Tempo Real
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "notificacoes"),
      where("paraId", "==", user.uid),
      where("lida", "==", false),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      if (count > prevCountRef.current) {
        setAnimateBell(true);
        setTimeout(() => setAnimateBell(false), 1000);
      }
      setNotifCount(count);
      prevCountRef.current = count;
    });

    return () => unsubscribe();
  }, [user]);

  const avatarUrl = React.useMemo(() => {
    if (user?.avatar && user.avatar.length > 5) return user.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random&color=fff`;
  }, [user]);

  const handleImgError = (e, fallbackType) => {
    e.target.onerror = null;
    if (fallbackType === 'avatar') {
      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random&color=fff`;
    } else {
      e.target.style.display = 'none';
    }
  };

  const isUserAdmin = user?.role === 'admin';

  return (
    <>
      <style>{`
        @keyframes bell-shake {
          0% { transform: rotate(0); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-15deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(5deg); }
          85% { transform: rotate(-5deg); }
          100% { transform: rotate(0); }
        }
        .animate-bell {
          animation: bell-shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
          color: #4a90e2 !important;
        }
        .drawer-link { @apply flex items-center gap-3 text-gray-400 py-3 hover:text-white border-b border-white/5 transition-colors text-sm font-medium px-2; } 
        .dropdown-item { @apply px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors; }
      `}</style>

      {/* Mobile Drawer */}
      {showDrawer && <div className="fixed inset-0 bg-black/60 z-[1000] backdrop-blur-sm" onClick={() => setShowDrawer(false)}></div>}

      <div className={`fixed top-0 left-0 h-full w-72 bg-[#121212] border-r border-white/5 shadow-2xl z-[1001] transform transition-transform duration-300 ease-in-out ${showDrawer ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`}>
        <div className="flex justify-end p-4">
          <button onClick={() => setShowDrawer(false)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition"><MdClose size={24} /></button>
        </div>

        <div className="flex flex-col gap-1 p-4 pb-20">
          {signed ? (
            <>
              <div className="flex flex-col gap-2 mb-6 p-3 bg-white/5 rounded-xl border border-white/5 mx-2">
                <div className="flex items-center gap-3">
                  <img src={avatarUrl} alt="User" className="w-10 h-10 rounded-full border border-primary object-cover" onError={(e) => handleImgError(e, 'avatar')} />
                  <div className="overflow-hidden">
                    <p className="text-white font-bold truncate text-sm">{user.name}</p>
                  </div>
                </div>
              </div>

              {isUserAdmin && <Link to="/admin" onClick={() => setShowDrawer(false)} className="drawer-link text-red-400 bg-red-500/10 border-red-500/20 mb-2 rounded-lg"><MdSecurity size={20} /> <span>Admin Panel</span></Link>}

              <Link to="/dashboard" onClick={() => setShowDrawer(false)} className="drawer-link"><MdEditNote size={20} /> <span>Dashboard</span></Link>
              <Link to="/biblioteca" onClick={() => setShowDrawer(false)} className="drawer-link"><MdBookmarks size={20} /> <span>Library</span></Link>

              <Link to="/feedback" onClick={(e) => { setShowDrawer(false); if (!signed) { e.preventDefault(); toast.error("Você precisa estar logado para enviar um feedback."); } }} className="drawer-link text-purple-400"><MdChatBubbleOutline size={20} /> <span>Give your Feedback</span></Link>

              <Link to="/settings" onClick={() => setShowDrawer(false)} className="drawer-link"><MdSettings size={20} /> <span>Settings</span></Link>
              <button onClick={() => { logout(); setShowDrawer(false); }} className="drawer-link text-red-400 mt-4 border-t border-white/5 pt-4"><MdLogout size={20} /> <span>Logout</span></button>
            </>
          ) : (
            <>
              <Link to="/how-it-works" onClick={() => setShowDrawer(false)} className="drawer-link"><MdInfoOutline size={20} /> <span>How it Works</span></Link>
              
              <Link to="/feedback" onClick={(e) => { setShowDrawer(false); e.preventDefault(); toast.error("Você precisa estar logado para enviar um feedback."); }} className="drawer-link text-purple-400"><MdChatBubbleOutline size={20} /> <span>Give your Feedback</span></Link>

              <Link to="/login" onClick={() => setShowDrawer(false)} className="mt-4 mx-2 bg-primary text-white py-3 rounded-lg font-bold text-center shadow-lg"><span>Login / Sign Up</span></Link>
            </>
          )}
        </div>
      </div>

      <header className={`sticky top-0 z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#0a0a0a]/80 backdrop-blur-xl border-white/5 py-3 shadow-lg' : 'bg-transparent border-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-gray-300 hover:text-white" onClick={toggleDrawer}><MdMenu size={28} /></button>
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute -inset-1 bg-primary rounded-full blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                <img src="/logo-ah.png" alt="Logo" className="relative h-9 w-auto object-contain" onError={(e) => handleImgError(e, 'logo')} />
              </div>
            </Link>
          </div>

          <div className="flex lg:hidden items-center gap-4">
            {signed && (
              <Link to="/notificacoes" className={`relative transition-colors ${animateBell ? 'animate-bell' : 'text-gray-400 hover:text-white'}`}>
                <MdNotifications size={24} />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a] animate-bounce"></span>
                )}
              </Link>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-6">

            <Link to="/how-it-works" className="flex items-center gap-2 text-gray-300 hover:text-white font-bold text-sm transition-colors">
              <MdInfoOutline size={18} /> How it Works
            </Link>

            <Link to="/feedback" onClick={(e) => { if (!signed) { e.preventDefault(); toast.error("Você precisa estar logado para enviar um feedback."); } }} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm transition-colors">
              <MdChatBubbleOutline size={18} /> Give your Feedback
            </Link>

            <a href="https://buymeacoffee.com/rlokin222" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 px-4 py-1.5 rounded-full font-bold text-xs transition-all"><FaCoffee size={14} /> Support</a>

            {!signed ? (
              <Link to="/login" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-full font-bold transition text-sm shadow-lg shadow-primary/20">Login</Link>
            ) : (
              <div className="flex items-center gap-6 border-l border-white/10 pl-6">

                <Link to="/notificacoes" className={`relative transition-colors ${animateBell ? 'animate-bell' : 'text-gray-400 hover:text-white'}`}>
                  <MdNotifications size={24} />
                  {notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a] animate-bounce"></span>
                  )}
                </Link>

                <div className="relative group">
                  <button onClick={toggleDropdown} className="flex items-center gap-3 focus:outline-none">
                    <img src={avatarUrl} className="w-9 h-9 rounded-full border-2 border-transparent group-hover:border-primary/50 transition-all object-cover" onError={(e) => handleImgError(e, 'avatar')} />
                    <MdArrowDropDown className="text-gray-500 group-hover:text-white transition-colors" />
                  </button>

                  {showDropdown && (
                    <div className="absolute top-12 right-0 w-60 glass-panel rounded-xl py-2 flex flex-col z-50 animate-fade-in origin-top-right overflow-hidden" onMouseLeave={() => setShowDropdown(false)}>
                      <div className="px-4 py-3 border-b border-white/5 mb-1">
                        <p className="text-white font-bold truncate text-sm">{user.name}</p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</p>
                        </div>
                      </div>
                      {isUserAdmin && <Link to="/admin" className="dropdown-item text-red-400 hover:bg-red-500/10"><MdSecurity className="text-red-400" /> <span>Admin Panel</span></Link>}
                      {/* <Link to="/subscription" className="dropdown-item"><span className="text-yellow-500">★</span> <span>Subscription</span></Link> */}
                      <Link to="/dashboard" className="dropdown-item"><MdEditNote className="text-green-400" /> <span>Dashboard</span></Link>
                      <Link to="/perfil" className="dropdown-item"><MdPerson className="text-zinc-400" /> <span>Profile</span></Link>
                      <Link to="/biblioteca" className="dropdown-item"><MdBookmarks className="text-purple-400" /> <span>Library</span></Link>
                      <Link to="/settings" className="dropdown-item"><MdSettings className="text-gray-400" /> <span>Settings</span></Link>

                      <div className="h-px bg-white/5 my-1"></div>
                      <button onClick={logout} className="dropdown-item text-red-400 hover:text-red-300"><MdLogout /> <span>Logout</span></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}