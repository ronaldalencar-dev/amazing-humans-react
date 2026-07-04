import React, { useEffect, useState } from 'react';
import { db } from '../services/firebaseConnection';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { MdClose } from 'react-icons/md';
import { Link } from 'react-router-dom';

export default function FollowersModal({ userId, type, onClose }) {
    // type = 'followers' (quem me segue) ou 'following' (quem eu sigo)
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadList() {
            try {
                const collRef = collection(db, "seguidores");
                let q;
                
                // Se type == 'followers', busco onde followedId == userId
                // Se type == 'following', busco onde followerId == userId
                if (type === 'followers') {
                    q = query(collRef, where("followedId", "==", userId), limit(20));
                } else {
                    q = query(collRef, where("followerId", "==", userId), limit(20));
                }

                const snapshot = await getDocs(q);
                
                const list = await Promise.all(snapshot.docs.map(async (d) => {
                    const data = d.data();
                    // Pega o ID do perfil que queremos mostrar
                    const targetId = type === 'followers' ? data.followerId : data.followedId;
                    
                    // Busca dados básicos do usuário (Nome/Foto)
                    const userSnap = await getDoc(doc(db, "usuarios", targetId));
                    if (userSnap.exists()) {
                        return { id: userSnap.id, ...userSnap.data() };
                    }
                    return null;
                }));

                setUsers(list.filter(u => u !== null));

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        loadList();
    }, [userId, type]);

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#222]">
                    <h3 className="text-white font-bold capitalize">{type}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><MdClose size={24} /></button>
                </div>
                
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No users found.</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {users.map(u => (
                                <Link to={`/user/${u.id}`} key={u.id} onClick={onClose} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition border border-transparent hover:border-white/5">
                                    <img src={u.foto || `https://ui-avatars.com/api/?name=${u.nome}`} className="w-10 h-10 rounded-full bg-black/50 object-cover" alt={u.nome} />
                                    <div className="flex-1">
                                        <p className="text-white font-bold text-sm">{u.nome}</p>
                                        <p className="text-[10px] text-primary border border-primary/20 bg-primary/10 px-1.5 py-0.5 rounded inline-block">{u.role || 'User'}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}