import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../services/firebaseConnection';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'; 
import { AuthContext } from '../contexts/AuthContext';
import StoryCard from '../components/StoryCard';
import { MdVerified, MdPersonAdd, MdCheck, MdPeople, MdAutoStories, MdTimeline, MdDiamond, MdLibraryBooks } from 'react-icons/md';
import { FaInstagram, FaTwitter, FaGlobe, FaPatreon, FaPaypal } from 'react-icons/fa'; 
import toast from 'react-hot-toast';

// Função auxiliar para evitar links quebrados
const formatUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);

  const [perfil, setPerfil] = useState(null);
  const [obras, setObras] = useState([]);
  const [colecoes, setColecoes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  
  // Novo estado para VIP
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    async function loadData() {
        try {
            // Tenta carregar do cache da sessão
            const cachedProfile = sessionStorage.getItem(`public_profile_${id}`);
            if (cachedProfile) {
                const { perfilCache, obrasCache, colecoesCache, isVipCache } = JSON.parse(cachedProfile);
                setPerfil(perfilCache);
                setObras(obrasCache);
                setColecoes(colecoesCache);
                setIsVip(isVipCache);
                
                // Seguidor precisa ser sempre checado pois o user logado muda
                if(user?.uid) {
                    const followId = `${user.uid}_${id}`;
                    const followDoc = await getDoc(doc(db, "seguidores", followId));
                    setIsFollowing(followDoc.exists());
                }
                setLoading(false);
                return;
            }

            const userDoc = await getDoc(doc(db, "usuarios", id));
            let finalPerfil = null;
            let finalIsVip = false;

            if(userDoc.exists()) {
                const data = userDoc.data();
                finalPerfil = { id: userDoc.id, ...data };
                setPerfil(finalPerfil);

                // Lógica de verificação VIP para Profile Público
                if(data.vipUntil) {
                    let vipDate = null;
                    try {
                        if(typeof data.vipUntil.toDate === 'function') {
                            vipDate = data.vipUntil.toDate();
                        } else {
                            vipDate = new Date(data.vipUntil);
                        }
                        if(vipDate > new Date()) {
                            finalIsVip = true;
                            setIsVip(true);
                        }
                    } catch(e) { console.error("Erro data VIP", e); }
                }
            }

            const q = query(collection(db, "obras"), where("autorId", "==", id), where("status", "==", "public"));
            const snap = await getDocs(q);
            let lista = [];
            snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
            setObras(lista);

            // Fetch Coleções
            const qCol = query(collection(db, "colecoes"), where("autorId", "==", id));
            const snapCol = await getDocs(qCol);
            let listaCol = [];
            snapCol.forEach(d => listaCol.push({ id: d.id, ...d.data() }));
            setColecoes(listaCol);
            
            // Salva no cache da sessão
            if (finalPerfil) {
                sessionStorage.setItem(`public_profile_${id}`, JSON.stringify({
                    perfilCache: finalPerfil,
                    obrasCache: lista,
                    colecoesCache: listaCol,
                    isVipCache: finalIsVip
                }));
            }

            if(user?.uid) {
                const followId = `${user.uid}_${id}`;
                const followDoc = await getDoc(doc(db, "seguidores", followId));
                setIsFollowing(followDoc.exists());
            }
        } catch(e) { console.error(e); } finally { setLoading(false); }
    }
    loadData();
  }, [id, user]);

  async function handleFollow() {
      if(!user) return toast.error("Login to follow.");
      if(loadingFollow) return;
      if(user.uid === id) return toast.error("You cannot follow yourself.");

      setLoadingFollow(true);
      const followId = `${user.uid}_${id}`;
      const followRef = doc(db, "seguidores", followId);

      try {
          if(isFollowing) {
              await deleteDoc(followRef);
              setIsFollowing(false);
              toast.success("Unfollowed.");
              setPerfil(prev => ({ ...prev, followersCount: (prev.followersCount || 1) - 1 }));
          } else {
              await setDoc(followRef, { followerId: user.uid, followedId: id, createdAt: new Date() });
              setIsFollowing(true);
              toast.success("Following!");
              setPerfil(prev => ({ ...prev, followersCount: (prev.followersCount || 0) + 1 }));
          }
      } catch(e) { toast.error("Error updating follow."); } finally { setLoadingFollow(false); }
  }

  if(loading) return <div className="loading-spinner"></div>;
  if(!perfil) return <div className="text-center text-white py-20">User not found.</div>;

  const leituras = perfil.contador_leituras || 0;
  // REMOVIDO: const currentLevel = Math.floor(leituras / 20) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-8 items-start">
            
            <div className="w-full md:w-1/3 space-y-6">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden border border-white/5 bg-[#1a1a1a]">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-900/10 opacity-50 -z-10"></div>
                    
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-500 shadow-xl mb-4">
                        <img src={perfil.foto || `https://ui-avatars.com/api/?name=${perfil.nome}`} alt="Avatar" className="w-full h-full rounded-full object-cover bg-[#222]" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                        {perfil.nome}
                        {isVip && <MdDiamond className="text-yellow-400 drop-shadow-md" title="VIP User" />}
                        {perfil.badges?.includes('pioneer') && <MdVerified className="text-zinc-400" title="Founder Author" />}
                    </h2>
                    
                    <div className="flex gap-2 mb-4 justify-center">
                        <span className="text-gray-400 text-xs font-bold uppercase bg-white/5 px-3 py-1 rounded border border-white/10">{perfil.role || 'User'}</span>
                        {/* REMOVIDO: Span do Nível */}
                    </div>

                    {perfil.bio ? (
                        <p className="text-sm text-gray-300 mb-6 px-2 italic text-center w-full max-w-[280px]">"{perfil.bio}"</p>
                    ) : (
                        <p className="text-xs text-gray-500 mb-6 px-2 italic text-center w-full max-w-[280px]">This user does not have a bio yet.</p>
                    )}

                    {/* REDES SOCIAIS E APOIO */}
                    <div className="flex flex-col gap-4 mb-6 w-full px-4">
                        <div className="flex justify-center gap-4">
                            {perfil.website && <a href={formatUrl(perfil.website)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors"><FaGlobe size={20} /></a>}
                            {perfil.twitter && <a href={formatUrl(perfil.twitter)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-zinc-400 transition-colors"><FaTwitter size={20} /></a>}
                            {perfil.instagram && <a href={formatUrl(perfil.instagram)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors"><FaInstagram size={20} /></a>}
                        </div>

                        {(perfil.patreon || perfil.paypal) && (
                            <div className="flex gap-2 justify-center mt-2 pt-4 border-t border-white/5">
                                {perfil.patreon && (
                                    <a href={formatUrl(perfil.patreon)} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#ff424d]/10 text-[#ff424d] hover:bg-[#ff424d] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-[#ff424d]/20">
                                        <FaPatreon /> Support
                                    </a>
                                )}
                                {perfil.paypal && (
                                    <a href={formatUrl(perfil.paypal)} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#00457C]/10 text-[#00457C] hover:bg-[#00457C] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-[#00457C]/20">
                                        <FaPaypal /> Donate
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {user?.uid !== id && (
                        <button 
                            onClick={handleFollow} 
                            disabled={loadingFollow}
                            className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 transition-all ${isFollowing ? 'bg-white/10 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-white/10' : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'}`}
                        >
                            {loadingFollow ? 'Processing...' : isFollowing ? <><MdCheck /> Following</> : <><MdPersonAdd /> Follow</>}
                        </button>
                    )}

                    <div className="grid grid-cols-3 gap-2 w-full">
                        <div className="bg-black/20 p-2 py-3 rounded-xl border border-white/5 flex flex-col items-center">
                            <span className="text-lg font-bold text-white">{perfil.followersCount || 0}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center gap-1"><MdPeople /> Fans</span>
                        </div>
                        <div className="bg-black/20 p-2 py-3 rounded-xl border border-white/5 flex flex-col items-center">
                            <span className="text-lg font-bold text-white">{perfil.followingCount || 0}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center gap-1">Following</span>
                        </div>
                        <div className="bg-black/20 p-2 py-3 rounded-xl border border-white/5 flex flex-col items-center">
                            <span className="text-lg font-bold text-white">{leituras}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center gap-1"><MdAutoStories /> Reads</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full md:w-2/3">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                    <MdTimeline className="text-primary" /> Published Works <span className="bg-white/10 text-xs px-2 py-1 rounded-full text-gray-300">{obras.length}</span>
                </h2>
                {obras.length === 0 ? (
                    <div className="text-center py-20 bg-[#1f1f1f] rounded-xl border border-dashed border-[#333]">
                        <p className="text-gray-500 italic">This user hasn't published any stories yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                        {obras.map(obra => <StoryCard key={obra.id} data={obra} />)}
                    </div>
                )}

                {/* COLEÇÕES */}
                {colecoes.length > 0 && (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2 mt-10">
                            <MdLibraryBooks className="text-primary" /> Collections <span className="bg-white/10 text-xs px-2 py-1 rounded-full text-gray-300">{colecoes.length}</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {colecoes.map(col => (
                                <Link to={`/collection/${col.id}`} key={col.id} className="bg-[#1f1f1f] border border-white/5 hover:border-primary/50 hover:bg-[#2a2a2a] transition-all p-5 rounded-xl flex flex-col items-start text-decoration-none group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary group-hover:bg-purple-500 transition-colors"></div>
                                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{col.nome}</h3>
                                    <p className="text-xs text-gray-400 font-bold bg-white/5 px-2 py-1 rounded-md mt-2">
                                        {col.obrasIds?.length || 0} {col.obrasIds?.length === 1 ? 'Book' : 'Books'}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    </div>
  );
}