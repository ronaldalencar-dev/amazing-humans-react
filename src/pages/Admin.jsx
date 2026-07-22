import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import {
    collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc,
    where, getCountFromServer, limit, arrayUnion, arrayRemove, getDoc
} from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import {
    MdDelete, MdCheck, MdWarning, MdSecurity, MdOpenInNew,
    MdPeople, MdMenuBook, MdBarChart, MdSearch, MdBlock, MdVerified,
    MdSupervisedUserCircle, MdVisibility, MdVisibilityOff, MdClose, MdEditDocument,
    MdLibraryBooks, MdComment, MdStar, MdPerson
} from 'react-icons/md';
import toast from 'react-hot-toast';

export default function Admin() {
    const { user, isAdmin, loadingAuth } = useContext(AuthContext);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('reports'); // reports, users, feedback
    const [reports, setReports] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState({ users: 0, books: 0, reports: 0, feedbacks: 0 });
    const [loading, setLoading] = useState(true);

    // States para User Management
    const [userSearch, setUserSearch] = useState('');
    const [foundUsers, setFoundUsers] = useState([]);

    // States para Modal de Conteúdo do Usuário
    const [selectedUser, setSelectedUser] = useState(null);
    const [userModalTab, setUserModalTab] = useState('published'); // published, library, comments
    const [userWorks, setUserWorks] = useState([]);
    const [userLibrary, setUserLibrary] = useState([]);
    const [userComments, setUserComments] = useState([]);
    const [loadingUserData, setLoadingUserData] = useState(false);

    useEffect(() => {
        if (loadingAuth) return;
        if (!isAdmin()) {
            toast.error("Access Denied");
            navigate('/');
            return;
        }
        loadDashboard();
    }, [user, loadingAuth, isAdmin, navigate]);

    async function loadDashboard() {
        setLoading(true);
        try {
            // 1. Carregar Reports
            const qReports = query(collection(db, "reports"), orderBy("timestamp", "desc"));
            const snapReports = await getDocs(qReports);
            let listaReports = [];
            snapReports.forEach(d => listaReports.push({ id: d.id, ...d.data() }));
            setReports(listaReports);

            // 1.5 Carregar Feedbacks
            const qFeedbacks = query(collection(db, "feedback"), orderBy("timestamp", "desc"));
            const snapFeedbacks = await getDocs(qFeedbacks);
            let listaFeedbacks = [];
            snapFeedbacks.forEach(d => listaFeedbacks.push({ id: d.id, ...d.data() }));
            setFeedbacks(listaFeedbacks);

            // 2. Carregar Estatísticas (Counts)
            const collUsers = collection(db, "usuarios");
            const collBooks = collection(db, "obras");
            const snapUsers = await getCountFromServer(collUsers);
            const snapBooks = await getCountFromServer(collBooks);

            setStats({
                users: snapUsers.data().count,
                books: snapBooks.data().count,
                reports: snapReports.size,
                feedbacks: snapFeedbacks.size
            });

        } catch (error) {
            console.error(error);
            toast.error("Error loading admin data");
        } finally {
            setLoading(false);
        }
    }

    // --- AÇÕES DE REPORTS ---

    async function handleDeleteContent(report) {
        if (!window.confirm(`DANGER: Delete "${report.targetName}" permanently?`)) return;
        try {
            const collectionName = report.targetType === 'book' ? 'obras' : 'capitulos';
            await deleteDoc(doc(db, collectionName, report.targetId));
            await updateDoc(doc(db, "reports", report.id), { status: 'resolved_deleted' });

            setReports(reports.map(r => r.id === report.id ? { ...r, status: 'resolved_deleted' } : r));
            toast.success("Content deleted.");
        } catch (error) {
            toast.error("Error deleting content.");
        }
    }

    async function handleDismiss(reportId) {
        try {
            await updateDoc(doc(db, "reports", reportId), { status: 'dismissed' });
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
            toast.success("Report dismissed.");
        } catch (error) { toast.error("Error updating report."); }
    }

    // --- AÇÕES DE FEEDBACK ---

    async function handleDismissFeedback(feedbackId) {
        try {
            await updateDoc(doc(db, "feedback", feedbackId), { status: 'resolved' });
            setFeedbacks(feedbacks.map(f => f.id === feedbackId ? { ...f, status: 'resolved' } : f));
            toast.success("Feedback marked as resolved.");
        } catch (error) { toast.error("Error updating feedback."); }
    }

    async function handleDeleteFeedback(feedbackId) {
        if (!window.confirm("Delete this feedback?")) return;
        try {
            await deleteDoc(doc(db, "feedback", feedbackId));
            setFeedbacks(feedbacks.filter(f => f.id !== feedbackId));
            toast.success("Feedback deleted.");
        } catch (error) { toast.error("Error deleting feedback."); }
    }

    // --- AÇÕES DE USUÁRIOS ---

    async function searchUsers(e) {
        e.preventDefault();
        if (!userSearch.trim()) return;

        try {
            // Busca por Email exato
            const q = query(collection(db, "usuarios"), where("email", "==", userSearch.trim()));
            const snap = await getDocs(q);
            let users = [];
            snap.forEach(d => users.push({ id: d.id, ...d.data() }));

            // Busca "contains" (simulada) por nome se não achar por email
            if (users.length === 0) {
                const qName = query(collection(db, "usuarios"), orderBy("nome"), limit(50));
                const snapName = await getDocs(qName);
                snapName.forEach(d => {
                    const u = d.data();
                    if (u.nome.toLowerCase().includes(userSearch.toLowerCase())) {
                        users.push({ id: d.id, ...u });
                    }
                });
            }

            users = users.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i); // Remove duplicatas
            setFoundUsers(users);

            if (users.length === 0) toast("No user found.");

        } catch (error) {
            console.error(error);
            toast.error("Search failed.");
        }
    }

    async function toggleBanUser(targetUser) {
        const isBanned = targetUser.banned === true;
        const action = isBanned ? "Unban" : "Ban";

        if (!window.confirm(`Are you sure you want to ${action} ${targetUser.nome}?`)) return;

        try {
            await updateDoc(doc(db, "usuarios", targetUser.id), { banned: !isBanned });
            setFoundUsers(foundUsers.map(u => u.id === targetUser.id ? { ...u, banned: !isBanned } : u));
            toast.success(`User ${action}ned successfully.`);
        } catch (error) { toast.error("Action failed."); }
    }

    async function toggleAdminRole(targetUser) {
        const isAdminAlready = targetUser.role === 'admin';
        const action = isAdminAlready ? "Revoke Admin from" : "Promote to Admin";
        const newRole = isAdminAlready ? 'user' : 'admin';

        if (!window.confirm(`${action} ${targetUser.nome}?`)) return;
        try {
            await updateDoc(doc(db, "usuarios", targetUser.id), { role: newRole });
            setFoundUsers(foundUsers.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
            toast.success(`Success: ${action} ${targetUser.nome}`);
        } catch (error) { toast.error("Failed."); }
    }

    async function toggleVerifyUser(targetUser) {
        const isVerified = targetUser.badges?.includes('verified');
        const action = isVerified ? "Remove Verification" : "Verify User";

        try {
            const userRef = doc(db, "usuarios", targetUser.id);
            if (isVerified) {
                await updateDoc(userRef, { badges: arrayRemove('verified') });
            } else {
                await updateDoc(userRef, { badges: arrayUnion('verified') });
            }

            // Atualiza lista local
            const updatedBadges = isVerified
                ? (targetUser.badges || []).filter(b => b !== 'verified')
                : [...(targetUser.badges || []), 'verified'];

            setFoundUsers(foundUsers.map(u => u.id === targetUser.id ? { ...u, badges: updatedBadges } : u));
            toast.success(`${action} successful.`);
        } catch (error) { toast.error("Failed to update badge."); }
    }

    // --- GERENCIAMENTO DE SUBSCRIPTION ---

    async function grantSubscription(targetUser, type) {
        const confirmMsg = type === 'free'
            ? `Remove subscription from ${targetUser.nome}?`
            : `Grant FREE ${type.toUpperCase()} subscription to ${targetUser.nome}?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const userRef = doc(db, "usuarios", targetUser.id);
            const source = type === 'free' ? null : 'admin_gift';

            await updateDoc(userRef, {
                subscriptionType: type === 'free' ? null : type,
                subscriptionSource: source
            });

            setFoundUsers(foundUsers.map(u => u.id === targetUser.id ? {
                ...u,
                subscriptionType: type === 'free' ? null : type,
                subscriptionSource: source
            } : u));

            toast.success(`Subscription updated: ${type}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update subscription.");
        }
    }

    // --- GERENCIAMENTO DE CONTEÚDO DO USUÁRIO ---

    async function openUserDetails(targetUser) {
        setSelectedUser(targetUser);
        setUserModalTab('published');
        setLoadingUserData(true);

        try {
            // 1. Published Works
            const qWorks = query(collection(db, "obras"), where("autorId", "==", targetUser.id));
            const snapWorks = await getDocs(qWorks);
            let works = [];
            snapWorks.forEach(d => works.push({ id: d.id, ...d.data() }));
            setUserWorks(works);

            // 2. Library (Followed Books)
            const qLib = query(collection(db, "biblioteca"), where("userId", "==", targetUser.id));
            const snapLib = await getDocs(qLib);
            let library = [];

            // Fetch book details manually for library items
            const libraryPromises = snapLib.docs.map(async (d) => {
                const libData = d.data();
                try {
                    const bookSnap = await getDoc(doc(db, "obras", libData.obraId));
                    return {
                        id: d.id,
                        ...libData,
                        bookTitle: bookSnap.exists() ? bookSnap.data().titulo : "Unknown Book",
                        bookCover: bookSnap.exists() ? bookSnap.data().capa : null
                    };
                } catch (e) {
                    return { id: d.id, ...libData, bookTitle: "Error loading book", bookCover: null };
                }
            });

            library = await Promise.all(libraryPromises);
            setUserLibrary(library);

            // 3. Comments (Recent 20)
            const qComm = query(collection(db, "comentarios"), where("autorId", "==", targetUser.id));
            const snapComm = await getDocs(qComm);
            let comments = [];

            // Fetch target details (Book or Chapter) for comments
            const commentPromises = snapComm.docs.map(async (d) => {
                const cData = d.data();
                return { id: d.id, ...cData };
            });

            comments = await Promise.all(commentPromises);
            
            // Sort comments descending in memory to avoid missing composite index error
            comments.sort((a, b) => {
                const timeA = a.data?.seconds || 0;
                const timeB = b.data?.seconds || 0;
                return timeB - timeA;
            });
            
            // Limit to 20
            comments = comments.slice(0, 20);
            
            setUserComments(comments);

        } catch (error) {
            console.error(error);
            toast.error("Error loading user data.");
        } finally {
            setLoadingUserData(false);
        }
    }

    async function toggleWorkVisibility(work) {
        const isBanned = work.status === 'banned';
        const newStatus = isBanned ? 'public' : 'banned';
        try {
            await updateDoc(doc(db, "obras", work.id), { status: newStatus });
            setUserWorks(userWorks.map(w => w.id === work.id ? { ...w, status: newStatus } : w));
            toast.success(`Work ${isBanned ? 'Restored' : 'Hidden/Banned'}`);
        } catch (e) { toast.error("Error updating work."); }
    }

    async function deleteWork(workId) {
        if (!window.confirm("DELETE this story permanently? This cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "obras", workId));
            setUserWorks(userWorks.filter(w => w.id !== workId));
            toast.success("Story deleted.");
        } catch (e) { toast.error("Error deleting story."); }
    }

    async function deleteComment(commentId) {
        if (!window.confirm("Delete this comment?")) return;
        try {
            await deleteDoc(doc(db, "comentarios", commentId));
            setUserComments(userComments.filter(c => c.id !== commentId));
            toast.success("Comment deleted.");
        } catch (e) { toast.error("Error deleting comment."); }
    }

    if (loading || loadingAuth) return <div className="loading-spinner"></div>;

    return (
        <div className="max-w-6xl mx-auto px-4 py-10 min-h-screen relative">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <MdSecurity size={36} className="text-red-500" />
                    <div>
                        <h1 className="text-3xl font-bold text-white">Admin Console</h1>
                        <p className="text-gray-500 text-xs uppercase tracking-widest">System Management</p>
                    </div>
                </div>

                {/* STATS CARDS */}
                <div className="flex gap-4">
                    <div className="bg-[#1f1f1f] px-4 py-2 rounded-lg border border-[#333] text-center">
                        <span className="block text-xl font-bold text-white">{stats.users}</span>
                        <span className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1"><MdPeople /> Users</span>
                    </div>
                    <div className="bg-[#1f1f1f] px-4 py-2 rounded-lg border border-[#333] text-center">
                        <span className="block text-xl font-bold text-white">{stats.books}</span>
                        <span className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1"><MdMenuBook /> Books</span>
                    </div>
                    <div className="bg-[#1f1f1f] px-4 py-2 rounded-lg border border-[#333] text-center">
                        <span className="block text-xl font-bold text-red-400">{stats.reports}</span>
                        <span className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1"><MdWarning /> Reports</span>
                    </div>
                    <div className="bg-[#1f1f1f] px-4 py-2 rounded-lg border border-[#333] text-center">
                        <span className="block text-xl font-bold text-purple-400">{stats.feedbacks}</span>
                        <span className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1"><MdComment /> Feedback</span>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-6 mb-8 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all ${activeTab === 'reports' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-white'}`}
                >
                    <span>Reports</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all ${activeTab === 'users' ? 'text-zinc-500 border-b-2 border-zinc-500' : 'text-gray-500 hover:text-white'}`}
                >
                    <span>User Manager</span>
                </button>
                <button
                    onClick={() => setActiveTab('feedback')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all ${activeTab === 'feedback' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}
                >
                    <span>Feedback</span>
                </button>
            </div>

            {/* --- ABA REPORTS --- */}
            {activeTab === 'reports' && (
                <div className="grid gap-4">
                    {reports.length === 0 ? <p className="text-gray-500">No reports found.</p> : reports.map(report => (
                        <div key={report.id} className={`p-4 rounded-xl border ${report.status === 'pending' ? 'bg-[#1f1f1f] border-red-500/30' : 'bg-[#151515] border-[#333] opacity-60'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${report.targetType === 'book' ? 'bg-zinc-900 text-zinc-300' : 'bg-green-900 text-green-300'}`}>
                                            {report.targetType}
                                        </span>
                                        <span className="text-xs text-gray-500">{report.timestamp ? new Date(report.timestamp.seconds * 1000).toLocaleString() : ''}</span>
                                        {report.status !== 'pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-gray-700 text-gray-300">{report.status}</span>}
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-1">{report.targetName}</h3>
                                    <p className="text-red-400 text-sm font-bold flex items-center gap-2"><MdWarning /> Reason: {report.reason}</p>
                                    <p className="text-gray-400 text-sm mt-1 bg-black/20 p-2 rounded">"{report.description}"</p>
                                    <p className="text-gray-600 text-xs mt-2">Reporter: {report.reporterName}</p>
                                </div>

                                <div className="flex flex-col gap-2 ml-4">
                                    <Link to={report.targetType === 'book' ? `/story/${report.targetId}` : `/read/${report.targetId}`} target="_blank" className="btn-admin-action bg-[#333] text-white"><MdOpenInNew /> View</Link>
                                    {report.status === 'pending' && (
                                        <>
                                            <button onClick={() => handleDismiss(report.id)} className="btn-admin-action bg-green-900/30 text-green-500 border-green-500/30"><MdCheck /> Dismiss</button>
                                            <button onClick={() => handleDeleteContent(report)} className="btn-admin-action bg-red-900/30 text-red-500 border-red-500/30"><MdDelete /> Delete</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- ABA FEEDBACK --- */}
            {activeTab === 'feedback' && (
                <div className="grid gap-4">
                    {feedbacks.length === 0 ? <p className="text-gray-500">No feedback found.</p> : feedbacks.map(fb => (
                        <div key={fb.id} className={`p-4 rounded-xl border ${fb.status === 'pending' ? 'bg-[#1f1f1f] border-purple-500/30' : 'bg-[#151515] border-[#333] opacity-60'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${fb.type === 'bug' ? 'bg-red-900 text-red-300' : fb.type === 'enhancement' ? 'bg-green-900 text-green-300' : 'bg-purple-900 text-purple-300'}`}>
                                            {fb.type}
                                        </span>
                                        <span className="text-xs text-gray-500">{fb.timestamp ? new Date(fb.timestamp.seconds * 1000).toLocaleString() : ''}</span>
                                        {fb.status !== 'pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-gray-700 text-gray-300">{fb.status}</span>}
                                    </div>
                                    <p className="text-gray-300 text-sm mt-1 bg-black/20 p-3 rounded-lg">"{fb.message}"</p>
                                    <p className="text-gray-500 text-xs mt-3 flex items-center gap-1">
                                        <MdPerson /> {fb.userName || 'Unknown'} ({fb.userEmail || 'No email'}) - ID: {fb.userId}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 ml-4">
                                    {fb.status === 'pending' && (
                                        <button onClick={() => handleDismissFeedback(fb.id)} className="btn-admin-action bg-green-900/30 text-green-500 border-green-500/30"><MdCheck /> Resolve</button>
                                    )}
                                    <button onClick={() => handleDeleteFeedback(fb.id)} className="btn-admin-action bg-red-900/30 text-red-500 border-red-500/30"><MdDelete /> Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- ABA USERS --- */}
            {activeTab === 'users' && (
                <div>
                    <form onSubmit={searchUsers} className="flex gap-2 mb-8 max-w-lg">
                        <div className="relative flex-1">
                            <MdSearch className="absolute left-3 top-3 text-gray-500 text-xl" />
                            <input
                                type="text"
                                placeholder="Search user by email or name..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-[#333] text-white pl-10 pr-4 py-3 rounded-lg outline-none focus:border-zinc-500"
                            />
                        </div>
                        <button type="submit" className="bg-zinc-600 hover:bg-zinc-500 text-white px-6 rounded-lg font-bold">Search</button>
                    </form>

                    <div className="space-y-4">
                        {foundUsers.map(u => (
                            <div key={u.id} className="bg-[#1f1f1f] border border-[#333] p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <img src={u.foto || "https://ui-avatars.com/api/?background=random"} className="w-12 h-12 rounded-full object-cover" alt="User" />
                                    <div>
                                        <h4 className="text-white font-bold flex items-center gap-2">
                                            {u.nome}
                                            {u.role === 'admin' && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><MdSecurity size={10} /> Admin</span>}
                                            {u.banned && <span className="bg-gray-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><MdBlock size={10} /> Banned</span>}
                                            {u.subscriptionType && <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><MdStar size={10} /> {u.subscriptionType}</span>}
                                            {u.badges?.includes('verified') && <MdVerified className="text-zinc-400" title="Verified" />}
                                        </h4>
                                        <p className="text-gray-500 text-sm">{u.email}</p>
                                        <p className="text-gray-600 text-xs mt-1">ID: {u.id}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openUserDetails(u)}
                                            className="text-xs font-bold text-gray-300 hover:text-white border border-[#444] px-3 py-2 rounded hover:bg-[#333] flex items-center gap-1"
                                        >
                                            <MdEditDocument /> Detailed Info
                                        </button>

                                        <div className="relative group">
                                            <button className="text-xs font-bold text-purple-400 border border-purple-500/30 px-3 py-2 rounded hover:bg-purple-500/10 flex items-center gap-1">
                                                <MdStar /> Subscription
                                            </button>
                                            <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-lg p-2 shadow-xl z-10 w-48 hidden group-hover:block">
                                                <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Set Subscription:</p>
                                                <button onClick={() => grantSubscription(u, 'free')} className="w-full text-left text-xs text-gray-300 hover:text-white hover:bg-[#333] px-2 py-1.5 rounded">None (Free)</button>
                                                <button onClick={() => grantSubscription(u, 'reader')} className="w-full text-left text-xs text-zinc-400 hover:text-zinc-300 hover:bg-[#333] px-2 py-1.5 rounded font-bold">Reader Tier</button>
                                                <button onClick={() => grantSubscription(u, 'author')} className="w-full text-left text-xs text-purple-400 hover:text-purple-300 hover:bg-[#333] px-2 py-1.5 rounded font-bold">Author Tier</button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleVerifyUser(u)}
                                            className={`text-xs font-bold px-3 py-2 rounded flex items-center gap-1 transition-colors border ${u.badges?.includes('verified') ? 'border-zinc-500/50 text-zinc-400 hover:bg-zinc-500/10' : 'border-gray-600 text-gray-400 hover:text-white'}`}
                                        >
                                            <MdVerified /> {u.badges?.includes('verified') ? 'Unverify' : 'Verify'}
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => toggleAdminRole(u)} className={`text-xs font-bold border border-[#444] px-3 py-2 rounded hover:bg-[#333] flex items-center gap-1 ${u.role === 'admin' ? 'text-red-400' : 'text-gray-400'}`}>
                                            <MdSupervisedUserCircle /> {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                        </button>

                                        <button
                                            onClick={() => toggleBanUser(u)}
                                            className={`text-xs font-bold px-4 py-2 rounded flex items-center gap-1 transition-colors ${u.banned ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white'}`}
                                        >
                                            {u.banned ? <><MdCheck /> Unban User</> : <><MdBlock /> Ban User</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MODAL DE DETALHES DO USUÁRIO --- */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#222]">
                            <div className="flex items-center gap-3">
                                <img src={selectedUser.foto || "https://ui-avatars.com/api/?background=random"} className="w-10 h-10 rounded-full object-cover" alt="User" />
                                <div>
                                    <h3 className="text-white font-bold text-lg leading-tight">{selectedUser.nome}</h3>
                                    <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"><MdClose size={24} /></button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex border-b border-white/5 bg-[#1f1f1f]">
                            <button onClick={() => setUserModalTab('published')} className={`flex-1 py-3 text-sm font-bold uppercase transition-all ${userModalTab === 'published' ? 'text-zinc-500 border-b-2 border-zinc-500 bg-[#252525]' : 'text-gray-500 hover:text-white'}`}>
                                Published Works ({userWorks.length})
                            </button>
                            <button onClick={() => setUserModalTab('library')} className={`flex-1 py-3 text-sm font-bold uppercase transition-all ${userModalTab === 'library' ? 'text-green-500 border-b-2 border-green-500 bg-[#252525]' : 'text-gray-500 hover:text-white'}`}>
                                Library / Following ({userLibrary.length})
                            </button>
                            <button onClick={() => setUserModalTab('comments')} className={`flex-1 py-3 text-sm font-bold uppercase transition-all ${userModalTab === 'comments' ? 'text-yellow-500 border-b-2 border-yellow-500 bg-[#252525]' : 'text-gray-500 hover:text-white'}`}>
                                Comments ({userComments.length})
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 overflow-y-auto flex-1 bg-[#121212]">
                            {loadingUserData ? (
                                <div className="text-center py-10"><div className="loading-spinner"></div></div>
                            ) : (
                                <>
                                    {/* WORKS TAB */}
                                    {userModalTab === 'published' && (
                                        <div className="space-y-3">
                                            {userWorks.length === 0 ? <p className="text-gray-500 text-center py-10">No published works.</p> : userWorks.map(work => (
                                                <div key={work.id} className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333] flex justify-between items-center group hover:border-[#555]">
                                                    <div className="flex gap-3">
                                                        <img src={work.capa} className="w-10 h-14 object-cover rounded bg-[#333]" alt="Cover" />
                                                        <div>
                                                            <h4 className="text-white font-bold text-sm line-clamp-1">{work.titulo}</h4>
                                                            <div className="flex gap-2 mt-1">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${work.status === 'banned' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                                                                    {work.status}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 flex items-center gap-1"><MdVisibility /> {work.views || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => toggleWorkVisibility(work)} className={`p-2 rounded-lg border transition-colors ${work.status === 'banned' ? 'border-green-500/30 text-green-500 hover:bg-green-500/10' : 'border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10'}`}>
                                                            {work.status === 'banned' ? <MdVisibility /> : <MdVisibilityOff />}
                                                        </button>
                                                        <button onClick={() => deleteWork(work.id)} className="p-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                                                            <MdDelete />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* LIBRARY TAB */}
                                    {userModalTab === 'library' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {userLibrary.length === 0 ? <p className="text-gray-500 text-center py-10 col-span-2">No items in library.</p> : userLibrary.map(item => (
                                                <div key={item.id} className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333] flex items-center gap-3">
                                                    <div className="w-10 h-14 bg-[#333] rounded shrink-0 overflow-hidden">
                                                        {item.bookCover && <img src={item.bookCover} className="w-full h-full object-cover" alt="Cover" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-white font-bold text-sm line-clamp-1">{item.bookTitle}</h4>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900/30 text-zinc-400 border border-zinc-500/20 uppercase font-bold">{item.status}</span>
                                                            {item.isFavorite && <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><MdStar size={10} /> Favorite</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* COMMENTS TAB */}
                                    {userModalTab === 'comments' && (
                                        <div className="space-y-3">
                                            {userComments.length === 0 ? <p className="text-gray-500 text-center py-10">No recent comments.</p> : userComments.map(comment => (
                                                <div key={comment.id} className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333] flex flex-col gap-2 relative group">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-gray-300 text-sm italic">"{comment.texto}"</p>
                                                        <button onClick={() => deleteComment(comment.id)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-1 rounded transition-all"><MdDelete /></button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 border-t border-[#333] pt-2">
                                                        <MdComment className="text-gray-600" size={12} />
                                                        <span className="text-[10px] text-gray-500">
                                                            {comment.data ? new Date(comment.data.seconds * 1000).toLocaleString() : 'Just now'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-600 bg-[#252525] px-1.5 rounded">ID: {comment.targetId}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
            .btn-admin-action {
                @apply px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-transparent hover:border-white/20;
            }
        `}</style>
        </div>
    );
} 