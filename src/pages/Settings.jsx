import React, { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { MdSettings, MdWarning, MdArrowBack } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';

export default function Settings() {
    const { user, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState(false);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#121212]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        navigate('/login');
        return null;
    }

    async function handleDeleteAccount() {
        if (!window.confirm("WARNING: This action is permanent and cannot be undone. All your books, chapters, comments, and profile data will be permanently deleted. Are you sure you want to delete your account?")) {
            return;
        }

        const confirmText = window.prompt('Type "DELETE" to confirm account deletion:');
        if (confirmText !== 'DELETE') {
            toast('Account deletion cancelled.', { icon: 'ℹ️' });
            return;
        }

        setIsDeleting(true);
        const toastId = toast.loading("Deleting your account and all associated data...");
        try {
            const functions = getFunctions();
            const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
            await deleteUserAccount();
            toast.success("Account deleted successfully.", { id: toastId });
            // The Firebase Auth listener will auto-logout and redirect.
        } catch (error) {
            console.error("Deletion error:", error);
            if (error?.code === 'functions/unauthenticated' || error?.message?.includes('unauthenticated')) {
                toast.success("Account deleted successfully.", { id: toastId });
            } else {
                toast.error("Failed to delete account: " + error.message, { id: toastId });
                setIsDeleting(false);
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#121212] pt-24 pb-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Cabeçalho */}
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => navigate('/profile')} 
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
                        title="Back to Profile"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <MdSettings className="text-primary" />
                            Account Settings
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Manage your account preferences and security.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Sidebar Simulado */}
                    <div className="md:col-span-1 space-y-2">
                        <div className="p-3 bg-white/10 text-white rounded-lg font-bold text-sm cursor-pointer border-l-4 border-primary">
                            Danger Zone
                        </div>
                        {/* Future settings tabs can go here */}
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="md:col-span-3 space-y-6">
                        {/* DANGER ZONE */}
                        <div className="bg-[#1a1a1a] border border-red-900/50 p-6 md:p-8 rounded-2xl w-full">
                            <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2 text-xl">
                                <MdWarning size={24} /> Danger Zone
                            </h3>
                            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                Once you delete your account, there is no going back. Please be certain.
                                This will permanently wipe your profile, all your published books, chapters, comments, reading history, and any items in your library.
                            </p>
                            
                            <div className="border border-red-900/30 p-4 rounded-xl bg-red-950/10 mb-6">
                                <h4 className="text-red-400 font-bold text-sm mb-2">What happens when you delete your account?</h4>
                                <ul className="list-disc list-inside text-xs text-red-300/80 space-y-1">
                                    <li>Your profile and username are permanently deleted.</li>
                                    <li>All books and chapters you authored are destroyed.</li>
                                    <li>Your comments and reviews on other books are removed.</li>
                                    <li>Your library and reading history are wiped.</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full sm:w-auto px-8 py-3 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/50 rounded-lg font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isDeleting ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : 'Deactivate & Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
