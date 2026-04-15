import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { doc, updateDoc, collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import {
    MdEdit, MdPerson, MdLink, MdClose, MdImage,
    MdVerified, MdPeople, MdPersonAdd, MdLibraryBooks, MdTimeline, MdAutoStories,
    MdDiamond, MdContentCopy, MdCardGiftcard, MdSettings
} from 'react-icons/md';
import { FaInstagram, FaTwitter, FaGlobe, FaPatreon, FaPaypal } from 'react-icons/fa';
import StoryCard from '../components/StoryCard';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Função auxiliar para evitar links quebrados
const formatUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};

export default function Perfil() {
    const { user } = useContext(AuthContext);

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const navigate = useNavigate();
    const [avatarUrl, setAvatarUrl] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [social, setSocial] = useState({ website: '', twitter: '', instagram: '', patreon: '', paypal: '' });
    const [coverFileName, setCoverFileName] = useState(null);

    const [minhasObras, setMinhasObras] = useState([]);
    const [libraryCount, setLibraryCount] = useState(0);
    const [loadingObras, setLoadingObras] = useState(true);

    // Mantive apenas 'leituras' para as estatísticas gerais, removi cálculos de nível
    const leituras = user?.leituras || 0;

    useEffect(() => {
        async function loadData() {
            if (!user?.uid) return;
            try {
                const qObras = query(collection(db, "obras"), where("autorId", "==", user.uid));
                const snap = await getDocs(qObras);
                let lista = [];
                snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
                setMinhasObras(lista);

                const qLib = query(collection(db, "biblioteca"), where("userId", "==", user.uid));
                const snapLib = await getCountFromServer(qLib);
                setLibraryCount(snapLib.data().count);
            } catch (err) { console.error(err); } finally { setLoadingObras(false); }
        }
        loadData();
    }, [user]);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setBio(user.bio || '');
            setAvatarUrl(user.avatar || '');
            setCoverUrl(user.cover || '');
            setSocial({
                website: user.website || '',
                twitter: user.twitter || '',
                instagram: user.instagram || '',
                patreon: user.patreon || '',
                paypal: user.paypal || ''
            });
        }
    }, [user]);

    async function handleSaveProfile() {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, "usuarios", user.uid);
            await updateDoc(userRef, {
                nome: name,
                bio: bio,
                foto: avatarUrl,
                capa: coverUrl,
                website: social.website,
                twitter: social.twitter,
                instagram: social.instagram,
                patreon: social.patreon,
                paypal: social.paypal
            });
            toast.success("Profile updated!");
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Error updating profile: " + error.message);
        }
    }



    function copyToClipboard(text) {
        navigator.clipboard.writeText(text);
        toast.success("Code copied!");
    }

    function handleCoverFile(e) {
        const file = e.target.files[0];
        if (file) {
            setCoverFileName(file.name);
            toast('Feature under development. Backend prepared for storage integration.', {
                icon: '🚧',
                duration: 4000
            });
            // Logic to upload would go here, updating setCoverUrl with the result
        }
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-8 items-start">

                {/* COLUNA DA ESQUERDA (Info do Usuário) */}
                <div className="w-full md:w-1/3 flex flex-col gap-6">
                    <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden border border-white/5 bg-[#1a1a1a]">
                        {user?.cover ? (
                            <div className="absolute inset-0 z-0">
                                <img src={user.cover} alt="Cover" className="w-full h-full object-cover opacity-30" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/80 to-transparent"></div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-900/10 opacity-50 -z-10"></div>
                        )}

                        <div className="relative mb-4">
                            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-500 shadow-xl relative">
                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#121212] bg-[#222]">
                                    <img src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user?.uid} alt="Avatar" className="w-full h-full object-cover" />
                                </div>
                                {!isEditing && <button onClick={() => setIsEditing(true)} className="absolute bottom-0 right-0 bg-[#222] text-white p-2 rounded-full border border-gray-600 hover:bg-primary transition-all shadow-lg"><MdEdit size={16} /></button>}
                            </div>
                            
                            {!isEditing && (
                                <button onClick={() => navigate('/settings')} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-black/30 p-2 rounded-full backdrop-blur-md transition-colors z-20" title="Account Settings">
                                    <MdSettings size={20} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col items-center w-full mb-4">
                            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                                {user?.name}
                                {user?.isVip && <MdDiamond className="text-yellow-400 text-xl drop-shadow-md" title="VIP Member" />}
                                {user?.badges?.includes('pioneer') && <MdVerified className="text-zinc-400 text-xl" title="Pioneer" />}
                            </h2>
                            {!isEditing && (
                                user?.bio ? (
                                    <p className="text-sm text-gray-300 mt-2 px-2 italic text-center w-full max-w-[280px]">"{user.bio}"</p>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-2 px-2 italic text-center w-full max-w-[280px]">This user does not have a bio yet.</p>
                                )
                            )}
                        </div>

                        {!isEditing && (
                            <div className="flex flex-col gap-4 mb-6 w-full px-4">
                                <div className="flex justify-center gap-4">
                                    {user?.website && <a href={formatUrl(user.website)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors"><FaGlobe size={20} /></a>}
                                    {user?.twitter && <a href={formatUrl(user.twitter)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-zinc-400 transition-colors"><FaTwitter size={20} /></a>}
                                    {user?.instagram && <a href={formatUrl(user.instagram)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors"><FaInstagram size={20} /></a>}
                                </div>
                                {(user?.patreon || user?.paypal) && (
                                    <div className="flex gap-2 justify-center mt-2 border-t border-white/5 pt-4">
                                        {user.patreon && <a href={formatUrl(user.patreon)} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#ff424d]/10 text-[#ff424d] hover:bg-[#ff424d] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-[#ff424d]/20"><FaPatreon /> Support</a>}
                                        {user.paypal && <a href={formatUrl(user.paypal)} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#00457C]/10 text-[#00457C] hover:bg-[#00457C] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-[#00457C]/20"><FaPaypal /> Donate</a>}
                                    </div>
                                )}
                            </div>
                        )}

                        {isEditing && (
                            <div className="w-full bg-black/20 p-4 rounded-xl border border-white/5 mt-4 animate-fade-in text-left">
                                <div className="space-y-3 mb-4">
                                    {/* Cover Image Input */}
                                    <div className="p-3 bg-white/5 rounded-lg border border-dashed border-white/10 text-center">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Cover Image</label>
                                        <div className="flex flex-col items-center gap-2">
                                            <label htmlFor="cover-upload" className="cursor-pointer bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md text-xs font-bold transition-all shadow-lg">
                                                Choose File
                                            </label>
                                            <input id="cover-upload" type="file" onChange={handleCoverFile} className="hidden" accept="image/png, image/jpeg" />
                                            <span className="text-[10px] text-gray-400">{coverFileName || "No file chosen"}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-600 mt-1">Supports JPG, PNG (Max 5MB)</p>
                                    </div>

                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Display Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-modern w-full text-xs" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Bio / About Me</label><textarea maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} className="input-modern w-full text-xs min-h-[80px] resize-y" placeholder="Tell us about yourself..." /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Avatar URL</label><input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input-modern w-full text-xs" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Website</label><input type="text" value={social.website} onChange={(e) => setSocial({ ...social, website: e.target.value })} className="input-modern w-full text-xs" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Twitter</label><input type="text" value={social.twitter} onChange={(e) => setSocial({ ...social, twitter: e.target.value })} className="input-modern w-full text-xs" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Instagram</label><input type="text" value={social.instagram} onChange={(e) => setSocial({ ...social, instagram: e.target.value })} className="input-modern w-full text-xs" /></div>
                                    <div className="pt-2 border-t border-gray-700 mt-2">
                                        <p className="text-[10px] text-yellow-500 font-bold mb-2">Monetization</p>
                                        <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Patreon</label><input type="text" value={social.patreon} onChange={(e) => setSocial({ ...social, patreon: e.target.value })} className="input-modern w-full text-xs" /></div>
                                        <div className="mt-2"><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">PayPal</label><input type="text" value={social.paypal} onChange={(e) => setSocial({ ...social, paypal: e.target.value })} className="input-modern w-full text-xs" /></div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
                                    <button onClick={handleSaveProfile} className="flex-1 py-2 rounded-lg text-xs font-bold bg-primary hover:bg-primary-dark text-white">Save</button>
                                </div>
                            </div>
                        )}

                        <div className="w-full mt-2 space-y-4">
                            {/* REMOVIDO: Barra de Progresso e Nível */}

                            {/* Seguidores / Seguindo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                                    <span className="text-xl font-bold text-white">{user?.followersCount || 0}</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-1"><MdPeople /> Followers</span>
                                </div>
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                                    <span className="text-xl font-bold text-white">{user?.followingCount || 0}</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-1"><MdPersonAdd /> Following</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Reader Stats moved up slightly */}
                    <div className="bg-[#1a1a1a] border border-white/5 p-6 rounded-2xl w-full">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><MdTimeline className="text-green-500" /> Reader Stats</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#333]">
                                <div className="flex items-center gap-3"><div className="p-2 bg-zinc-500/20 text-zinc-400 rounded-lg"><MdLibraryBooks size={20} /></div><span className="text-sm text-gray-300">In Library</span></div>
                                <span className="text-white font-bold">{libraryCount} Books</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#333]">
                                <div className="flex items-center gap-3"><div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><MdAutoStories size={20} /></div><span className="text-sm text-gray-300">Chapters Read</span></div>
                                <span className="text-white font-bold">{leituras}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA DA DIREITA (Obras) */}
                <div className="w-full md:w-2/3">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><MdPerson className="text-primary" /> My Works</h2>
                        {minhasObras.length > 0 && <span className="text-xs bg-white/10 text-gray-300 px-3 py-1 rounded-full">{minhasObras.length} Stories</span>}
                    </div>
                    {loadingObras ? <div className="loading-spinner"></div> : minhasObras.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <h3 className="text-lg font-bold text-gray-300">No stories yet</h3>
                            <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2">Start writing your first masterpiece!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {minhasObras.map(obra => <StoryCard key={obra.id} data={obra} />)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}