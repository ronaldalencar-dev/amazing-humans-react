import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { MdAdd, MdEdit, MdVisibility, MdStar, MdBarChart, MdPlayArrow } from 'react-icons/md';
import { FiGitBranch } from 'react-icons/fi';
import PremiumLock from '../components/PremiumLock';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [obras, setObras] = useState([]);
  const [historias, setHistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('published');

  useEffect(() => {
    if (!user?.uid) return;

    async function loadWorkData() {
      // Load regular books
      const q = query(collection(db, "obras"), where("autorId", "==", user.uid));
      const snapshot = await getDocs(q);
      let lista = [];
      snapshot.forEach((doc) => { lista.push({ id: doc.id, ...doc.data() }); });
      setObras(lista);

      // Load interactive stories
      const qH = query(collection(db, "historias_interativas"), where("autorId", "==", user.uid));
      const snapH = await getDocs(qH);
      let listaH = [];
      snapH.forEach((doc) => { listaH.push({ id: doc.id, ...doc.data() }); });
      setHistorias(listaH);

      setLoading(false);
    }

    loadWorkData();
  }, [user]);

  // Filtra obras por status
  const publishedBooks = obras.filter(o => o.status !== 'draft');
  const draftBooks = obras.filter(o => o.status === 'draft');

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 min-h-screen">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-8 gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Author Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your stories</p>
        </div>
        <div className="flex gap-3">
          <PremiumLock user={user} feature="Interactive Stories" description="" compact>
            <Link to="/write-interactive-story" className="flex items-center gap-2 bg-zinc-600/20 hover:bg-zinc-600/40 border border-zinc-500/40 text-zinc-300 px-4 py-2 rounded-lg font-bold text-sm transition-all">
              <FiGitBranch size={16} /> New Interactive Story
            </Link>
          </PremiumLock>
          <Link to="/write" className="btn-primary shadow-lg shadow-zinc-500/20 group">
            <MdAdd size={22} className="group-hover:rotate-90 transition-transform duration-300" /> Create New Book
          </Link>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 mb-8 border-b border-white/5">
        <button
          onClick={() => setActiveTab('published')}
          className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'published' ? 'border-primary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          Published ({publishedBooks.length})
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'drafts' ? 'border-primary text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          Drafts ({draftBooks.length})
        </button>
        <button
          onClick={() => setActiveTab('interactive')}
          className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'interactive' ? 'border-zinc-400 text-zinc-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <FiGitBranch size={14} /> Interactive ({historias.length})
        </button>
      </div>

      {/* ─── REGULAR BOOKS TABS ───────────────────────────────── */}
      {(activeTab === 'published' || activeTab === 'drafts') && (
        <>
          {(activeTab === 'published' ? publishedBooks : draftBooks).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#1a1a1a] border border-[#333] rounded-xl text-center">
              <MdEdit size={40} className="text-gray-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{activeTab === 'published' ? 'No published books yet' : 'No drafts yet'}</h3>
              <p className="text-gray-500 mb-6 text-sm">{activeTab === 'published' ? 'Get started by creating your first story!' : 'Save your ideas as drafts to work on them later.'}</p>
              <Link to="/write" className="btn-primary">Write Your First Story</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {(activeTab === 'published' ? publishedBooks : draftBooks).map(obra => (
                <div key={obra.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden flex flex-col sm:flex-row hover:border-primary/40 transition-all group shadow-lg">
                  <div className="sm:w-36 h-48 sm:h-auto relative shrink-0 bg-[#222]">
                    <img
                      src={obra.capa || '/logo-ah.png'}
                      alt={obra.titulo}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/logo-ah.png'; }}
                    />
                    {obra.status === 'draft' && <div className="absolute top-2 left-2 bg-yellow-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">Draft</div>}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-xl font-bold text-white">{obra.titulo}</h2>
                      <span className={`text-[10px] px-2 py-1 rounded text-gray-300 uppercase ${obra.status === 'draft' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10'}`}>{obra.status}</span>
                    </div>
                    {obra.status !== 'draft' && (
                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                        <div className="flex items-center gap-1"><MdBarChart className="text-zinc-400" /> {obra.views || 0} reads</div>
                        <div className="flex items-center gap-1"><MdStar className="text-yellow-500" /> {obra.rating ? obra.rating.toFixed(1) : '0.0'}</div>
                      </div>
                    )}
                    {obra.status === 'draft' && (
                      <p className="text-gray-500 text-sm mb-6 italic">This book is not visible to the public.</p>
                    )}

                    <div className="mt-auto pt-4 border-t border-white/5 flex flex-wrap gap-3">
                      <Link to={`/write?obraId=${obra.id}`} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <MdAdd /> {obra.status === 'draft' ? 'Continue Writing' : 'New Chapter'}
                      </Link>
                      <Link to={`/edit-story/${obra.id}`} className="bg-[#2a2a2a] hover:bg-[#333] text-gray-200 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 border border-white/10">
                        <MdEdit /> Settings
                      </Link>
                      {obra.status !== 'draft' && (
                        <Link to={`/story/${obra.id}`} className="bg-[#2a2a2a] hover:bg-[#333] text-gray-200 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 border border-white/10">
                          <MdVisibility /> View
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── INTERACTIVE STORIES TAB ─────────────────────────── */}
      {activeTab === 'interactive' && (
        <PremiumLock
          user={user}
          feature="Interactive Stories"
          description="Create branching 'Choose Your Adventure' stories where readers shape the outcome. Exclusive to Author Plan subscribers."
        >
          <>
            {historias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-[#1a1a1a] border border-[#333] rounded-xl text-center">
                <FiGitBranch size={40} className="text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No interactive stories yet</h3>
                <p className="text-gray-500 mb-6 text-sm max-w-sm">Create branching stories where readers make choices that change the outcome!</p>
                <Link to="/write-interactive-story" className="flex items-center gap-2 bg-zinc-600 hover:bg-zinc-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-zinc-500/20">
                  <FiGitBranch size={16} /> Create Interactive Story
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {historias.map(h => (
                  <div key={h.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden hover:border-zinc-500/40 transition-all group shadow-lg flex flex-col">
                    {/* Card header with gradient */}
                    <div className="h-24 relative bg-gradient-to-br from-zinc-900/40 via-purple-900/30 to-slate-900 flex items-center justify-center">
                      <FiGitBranch size={36} className="text-zinc-400/50" />
                      <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${h.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {h.status === 'draft' ? 'Draft' : 'Published'}
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="text-white font-bold text-base mb-1 truncate">{h.titulo || 'Untitled'}</h3>
                      {h.descricao && <p className="text-gray-500 text-xs mb-3 line-clamp-2">{h.descricao}</p>}

                      <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-4">
                        <FiGitBranch size={10} />
                        <span>{h.nodes?.length || 0} scenes</span>
                      </div>

                      <div className="mt-auto flex gap-2">
                        <Link
                          to={`/write-interactive-story/${h.id}`}
                          className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-200 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all"
                        >
                          <MdEdit size={14} /> Edit
                        </Link>
                        <Link
                          to={`/interactive-story/${h.id}`}
                          className="flex-1 bg-zinc-600/20 hover:bg-zinc-600/40 border border-zinc-500/30 text-zinc-300 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <MdPlayArrow size={14} /> Play
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Create new card */}
                <Link
                  to="/write-interactive-story"
                  className="bg-[#1a1a1a] border-2 border-dashed border-[#333] rounded-xl overflow-hidden hover:border-zinc-500/40 transition-all group flex flex-col items-center justify-center py-12 gap-3 text-gray-600 hover:text-zinc-400"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-zinc-500/10 transition-colors">
                    <MdAdd size={24} />
                  </div>
                  <span className="text-sm font-bold">New Interactive Story</span>
                </Link>
              </div>
            )}
          </>
        </PremiumLock>
      )}
    </div>
  );
}

