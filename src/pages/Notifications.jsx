import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { MdNotifications, MdPersonAdd, MdComment, MdMenuBook, MdDeleteSweep, MdCheckCircle } from 'react-icons/md';
import DOMPurify from 'dompurify';

const getStyleData = (tipo, lida) => {
    switch (tipo) {
        case 'follow':
            return {
                icon: <MdPersonAdd size={20} />,
                bg: lida ? 'bg-gray-800' : 'bg-green-500/20',
                iconColor: lida ? 'text-gray-500' : 'text-green-400'
            };
        case 'chapter':
            return {
                icon: <MdMenuBook size={20} />,
                bg: lida ? 'bg-gray-800' : 'bg-zinc-500/20',
                iconColor: lida ? 'text-gray-500' : 'text-zinc-400'
            };
        case 'comment':
            return {
                icon: <MdComment size={20} />,
                bg: lida ? 'bg-gray-800' : 'bg-yellow-500/20',
                iconColor: lida ? 'text-gray-500' : 'text-yellow-400'
            };
        default:
            return {
                icon: <MdNotifications size={20} />,
                bg: lida ? 'bg-gray-800' : 'bg-gray-700',
                iconColor: 'text-gray-400'
            };
    }
};

export default function Notifications() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [notificacoes, setNotificacoes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, "notificacoes"),
            where("paraId", "==", user.uid),
            orderBy("data", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setNotificacoes(lista);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    async function handleClick(notif) {
        if (!notif.lida) {
            const docRef = doc(db, "notificacoes", notif.id);
            await updateDoc(docRef, { lida: true });
        }

        let destino = notif.linkDestino || "/";
        destino = destino.replace('.html', '');

        if (destino.includes('perfil_publico?uid=')) destino = destino.replace('perfil_publico?uid=', 'usuario/');
        if (destino.includes('obra?id=')) destino = destino.replace('obra?id=', 'obra/');
        if (destino.includes('ler?id=')) destino = destino.replace('ler?id=', 'ler/');

        navigate(destino);
    }

    async function limparNotificacoes() {
        if (!window.confirm("Clear all notifications?")) return;

        try {
            const batch = writeBatch(db);
            notificacoes.forEach(notif => {
                const docRef = doc(db, "notificacoes", notif.id);
                batch.delete(docRef);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error clearing notifications:", error);
        }
    }

    async function marcarTodasLidas() {
        try {
            const batch = writeBatch(db);
            notificacoes.forEach(notif => {
                if (!notif.lida) {
                    const docRef = doc(db, "notificacoes", notif.id);
                    batch.update(docRef, { lida: true });
                }
            });
            await batch.commit();
        } catch (error) {
            console.error("Error updating:", error);
        }
    }



    if (loading) return <div className="loading-spinner"></div>;

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">

            {/* HEADER DA PÁGINA */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg text-primary"><MdNotifications /></div>
                    Notifications
                </h2>

                <div className="flex gap-2">
                    {notificacoes.some(n => !n.lida) && (
                        <button onClick={marcarTodasLidas} className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-500/30 hover:bg-zinc-500/20 transition flex items-center gap-1">
                            <MdCheckCircle /> Mark all read
                        </button>
                    )}
                    {notificacoes.length > 0 && (
                        <button onClick={limparNotificacoes} className="text-xs font-bold text-red-400 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition flex items-center gap-1">
                            <MdDeleteSweep /> Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* LISTA */}
            <div className="flex flex-col gap-3">
                {notificacoes.length === 0 ? (
                    <div className="text-center py-20 bg-[#151515] rounded-xl border border-[#333]">
                        <MdNotifications size={40} className="mx-auto text-gray-600 mb-3" />
                        <p className="text-gray-500 font-medium">No notifications yet.</p>
                    </div>
                ) : (
                    notificacoes.map(item => {
                        const styleData = getStyleData(item.tipo, item.lida);

                        return (
                            <div
                                key={item.id}
                                onClick={() => handleClick(item)}
                                className={`
                            relative flex items-start gap-4 p-4 rounded-xl cursor-pointer border transition-all duration-200 group
                            ${item.lida
                                        ? 'bg-[#151515] border-transparent hover:bg-[#1a1a1a] hover:border-white/5'
                                        : 'bg-[#1f1f1f] border-primary/20 hover:border-primary/50 shadow-lg shadow-black/20'
                                    }
                        `}
                            >
                                {/* Indicador de não lida (Bolinha azul na esquerda) */}
                                {!item.lida && (
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_#4a90e2]"></div>
                                )}

                                {/* Ícone */}
                                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styleData.bg} ${styleData.iconColor}`}>
                                    {styleData.icon}
                                </div>

                                {/* Conteúdo */}
                                <div className="flex-1">
                                    <div
                                        className={`text-sm leading-relaxed ${item.lida ? 'text-gray-400' : 'text-gray-200'}`}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.mensagem) }}
                                    />
                                    <p className="text-xs text-gray-600 mt-1.5 font-medium">
                                        {item.data ? new Date(item.data.seconds * 1000).toLocaleString() : "Just now"}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}