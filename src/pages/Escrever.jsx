import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db, storage } from '../services/firebaseConnection'; // ADICIONADO storage
import {
    collection, addDoc, serverTimestamp, query, where, getDocs, doc, writeBatch, updateDoc, increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // ADICIONADO
import { Editor } from '@tinymce/tinymce-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdEdit, MdBook, MdCheckCircle, MdCancel, MdClose, MdInfoOutline, MdWarning, MdSchedule, MdFileUpload, MdWorkspacePremium } from 'react-icons/md';
import toast from 'react-hot-toast';
import { parseFile } from '../utils/fileParser';

const genresList = ['Fantasy', 'Sci-Fi', 'Romance', 'Horror', 'Adventure', 'RPG', 'Mystery', 'Action', 'Isekai', 'FanFic', 'HFY'];
const formatsList = ['Interactive'];

const OPEN_SOURCE_TINY = "https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js";
const editorConfig = {
    height: 400,
    menubar: false,
    plugins: 'anchor autolink charmap emoticons link lists searchreplace visualblocks wordcount',
    toolbar: 'undo redo | blocks fontsize | bold italic underline | align lineheight | numlist bullist | emoticons charmap | removeformat',
    skin: 'oxide-dark',
    content_css: 'dark',
    body_class: 'my-editor-content',
    content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; } p { margin-bottom: 1rem !important; }',
    forced_root_block: 'p',
    paste_as_text: false,
    paste_data_images: false,
    smart_paste: false,
    invalid_elements: 'img'
};

function countWords(htmlString) {
    if (!htmlString) return 0;
    const text = htmlString.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length === 0 ? 0 : text.split(' ').length;
}

export default function Escrever() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const obraIdUrl = searchParams.get('obraId');
    const [modo, setModo] = useState(obraIdUrl ? 'capitulo' : 'nova');
    const [minhasObras, setMinhasObras] = useState([]);

    // Campos do Formulário
    const [tituloObra, setTituloObra] = useState('');
    const [capa, setCapa] = useState('');
    const [coverFileName, setCoverFileName] = useState(null);
    const [sinopse, setSinopse] = useState('');
    const [categorias, setCategorias] = useState([]);

    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');

    const [obraSelecionada, setObraSelecionada] = useState(obraIdUrl || '');
    const [tituloCapitulo, setTituloCapitulo] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [notaAutor, setNotaAutor] = useState('');


    // NOVO: Estado para agendamento e importação
    const [dataAgendada, setDataAgendada] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    
    // NOVO: Estados para Preview de Bulk Import
    const [extractedChapters, setExtractedChapters] = useState([]);
    const [editingChapterIndex, setEditingChapterIndex] = useState(null);

    const [loadingPost, setLoadingPost] = useState(false);

    useEffect(() => {
        async function loadObras() {
            if (user?.uid) {
                const q = query(collection(db, "obras"), where("autorId", "==", user.uid));
                const snap = await getDocs(q);
                let lista = [];
                snap.forEach(d => lista.push({ id: d.id, titulo: d.data().titulo }));
                setMinhasObras(lista);
            }
        }
        loadObras();
    }, [user]);

    const handleCategoria = (e) => {
        const valor = e.target.value;
        if (e.target.checked) { setCategorias([...categorias, valor]); } else { setCategorias(categorias.filter(c => c !== valor)); }
    };

    const handleCoverFile = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File too large (Max 5MB).");
                return;
            }

            setCoverFileName(file.name);
            const toastId = toast.loading("Uploading cover...");

            try {
                const storageRef = ref(storage, `covers/${user.uid}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const url = await getDownloadURL(snapshot.ref);

                setCapa(url);
                toast.success("Cover uploaded!", { id: toastId });
            } catch (error) {
                console.error("Upload error:", error);
                toast.error("Upload failed.", { id: toastId });
            }
        }
    };

    const handleTagKeyDown = React.useCallback((e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = tagInput.trim();
            if (val && !tags.includes(val) && tags.length < 10) {
                setTags(prev => [...prev, val]);
                setTagInput('');
            }
        }
    }, [tagInput, tags]);

    const removeTag = React.useCallback((tagToRemove) => {
        setTags(prev => prev.filter(tag => tag !== tagToRemove));
    }, []);

    // Placeholder to prevent ReferenceError if this was called somewhere else
    async function enviarNotificacoes() {
        console.log("Notification logic moved to backend.");
    }

    const handleScanFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setImportFile(file);
        setIsImporting(true);
        const scanToast = toast.loading("Scanning document...");
        
        try {
            const chapters = await parseFile(file);
            if (!chapters || chapters.length === 0) {
                throw new Error("No chapters found. Please check formatting.");
            }
            setExtractedChapters(chapters);
            toast.success(`Found ${chapters.length} chapters!`, { id: scanToast });
        } catch (error) {
            console.error(error);
            toast.error(error.message, { id: scanToast });
            setImportFile(null);
            setExtractedChapters([]);
        } finally {
            setIsImporting(false);
        }
    };





    async function handlePublicar(status = 'public') {
        if (!user) return toast.error("You must be logged in!");

        if (modo === 'nova') {
            if (!tituloObra) return toast.error("Please fill in Book Title.");
            if (!sinopse) return toast.error("Please fill in Synopsis.");
        } else {
            if (!obraSelecionada) return toast.error("Select a book.");
        }

        // --- BULK IMPORT LOGIC ---
        if (importFile && extractedChapters.length > 0) {
            if (status === 'draft') return toast.error("Bulk import currently only supports immediate publishing.");

            setLoadingPost(true);
            const toastId = toast.loading("Processing file & publishing...");

            try {
                // Chapters already parsed and edited from state
                const chapters = extractedChapters;

                // 2. Create Book (if new)
                let idFinalObra = obraSelecionada;
                let nomeFinalObra = "";

                if (modo === 'nova') {
                    const docRef = await addDoc(collection(db, "obras"), {
                        titulo: tituloObra,
                        capa: capa,
                        sinopse: sinopse,
                        categorias: categorias,
                        tags: tags,
                        autor: user.name,
                        autorId: user.uid,
                        dataCriacao: serverTimestamp(),
                        tituloBusca: tituloObra.toLowerCase(),
                        views: 0, rating: 0, votes: 0,
                        status: 'public',
                        totalChapters: 0,
                        lastUpdated: serverTimestamp()
                    });
                    idFinalObra = docRef.id;
                    nomeFinalObra = tituloObra;
                } else {
                    const obraObj = minhasObras.find(o => o.id === obraSelecionada);
                    nomeFinalObra = obraObj ? obraObj.titulo : "Unknown";
                }

                // 3. Create Chapters Batch
                const batch = writeBatch(db);
                // Firestore batch limit is 500. Assuming < 500 chapters for now.
                // If > 500, we'd need to chunk.

                let addedCount = 0;
                let firstChapterId = null; // Store first chapter ID for redirect

                chapters.forEach((cap, index) => {
                    const now = new Date(); // Base date
                    // Increment date by 1 second for each chapter to preserve order
                    now.setSeconds(now.getSeconds() + index);

                    const newCapRef = doc(collection(db, "capitulos"));

                    // Capture the first chapter ID
                    if (index === 0) firstChapterId = newCapRef.id;

                    batch.set(newCapRef, {
                        obraId: idFinalObra,
                        nomeObra: nomeFinalObra, // This might be empty if new book, fixed below
                        titulo: cap.title || `Chapter ${index + 1}`,
                        conteudo: cap.content, // HTML content
                        authorNote: "",
                        autor: user.name,
                        autorId: user.uid,
                        data: now,
                        status: 'public',
                        views: 0
                    });
                    addedCount++;
                });

                await batch.commit();

                // 4. Update Book Count
                const bookRef = doc(db, 'obras', idFinalObra);
                await updateDoc(bookRef, {
                    totalChapters: increment(addedCount),
                    lastUpdated: serverTimestamp()
                });

                toast.success(`Successfully imported ${addedCount} chapters!`, { id: toastId });

                // Redirect to the first chapter if available, otherwise book page
                if (firstChapterId) {
                    navigate(`/ler/${firstChapterId}`);
                } else {
                    navigate(`/obra/${idFinalObra}`);
                }

            } catch (error) {
                console.error(error);
                toast.error("Import failed: " + error.message, { id: toastId });
            } finally {
                setLoadingPost(false);
            }
            return; // EXIT FUNCTION
        }
        // --- END BULK IMPORT LOGIC ---

        if (!tituloCapitulo) return toast.error("Please fill in Chapter Title.");

        // Drafts can be shorter/incomplete
        const wordCount = countWords(conteudo);
        if (status === 'public') {
            if (!conteudo) return toast.error("Please fill in Content.");
            if (wordCount < 500) {
                return toast.error(`Chapter too short! Minimum 500 words required. (Current: ${wordCount})`);
            }
            if (wordCount > 15000) {
                return toast.error(`Chapter too long! Maximum 15,000 words allowed. (Current: ${wordCount})`);
            }
        }

        setLoadingPost(true);
        const toastId = toast.loading(status === 'draft' ? "Saving draft..." : "Publishing...");

        try {
            let idFinalObra = obraSelecionada;
            let nomeFinalObra = "";

            // REGRA: Se for nova obra, forçar dataAgendada a ser nula (publicação imediata) se for PUBLIC
            let dataFinalParaUso = dataAgendada;

            if (modo === 'nova') {
                const docRef = await addDoc(collection(db, "obras"), {
                    titulo: tituloObra,
                    capa: capa,
                    sinopse: sinopse,
                    categorias: categorias,
                    tags: tags,
                    autor: user.name,
                    autorId: user.uid,
                    dataCriacao: serverTimestamp(),
                    tituloBusca: tituloObra.toLowerCase(),
                    views: 0, rating: 0, votes: 0,
                    status: status, // 'public' or 'draft'
                    totalChapters: 0
                });
                idFinalObra = docRef.id;
                nomeFinalObra = tituloObra;
                dataFinalParaUso = '';
            } else {
                const obraObj = minhasObras.find(o => o.id === obraSelecionada);
                nomeFinalObra = obraObj ? obraObj.titulo : "Unknown";
            }

            const dataPublicacao = dataFinalParaUso ? new Date(dataFinalParaUso) : new Date();

            const capRef = await addDoc(collection(db, "capitulos"), {
                obraId: idFinalObra,
                nomeObra: nomeFinalObra,
                titulo: tituloCapitulo,
                conteudo: conteudo || '',
                authorNote: notaAutor,
                autor: user.name,
                autorId: user.uid,
                data: dataPublicacao,
                status: status, // 'public' or 'draft'
                views: 0
            });

            const bookRef = doc(db, 'obras', idFinalObra);
            await updateDoc(bookRef, {
                totalChapters: increment(1), // Should we count drafts? Maybe not public chapters count.
                // But for now keeping simple.
                lastUpdated: serverTimestamp()
            });

            if (status === 'draft') {
                toast.success("Draft saved successfully!", { id: toastId });
                // Stay on page or redirect? Maybe redirect to edit?
                // For now, let's redirect to edit chapter so they can continue working
                navigate(`/editar-capitulo/${capRef.id}`);
            } else {
                // ... existing success logic
                let msg = "Published successfully!";
                if (dataFinalParaUso) {
                    // ... existing formatting
                    const dateObj = new Date(dataFinalParaUso);
                    const formattedDate = dateObj.toLocaleString('en-US', {
                        month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
                    });
                    msg = `Scheduled for ${formattedDate}`;
                }
                toast.success(msg, { id: toastId });
                navigate(`/ler/${capRef.id}`);
            }

        } catch (error) {
            console.error(error);
            toast.error("Error: " + error.message, { id: toastId });
        } finally {
            setLoadingPost(false);
        }
    }



    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><MdEdit className="text-primary" /> Editor Studio</h1>
                <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors"><MdCancel size={20} /> Cancel</button>
            </div>

            {/* BOTÕES DE MODO */}
            <div className="flex gap-4 mb-8 bg-[#1f1f1f] p-1 rounded-lg w-fit border border-[#333]">
                <button onClick={() => setModo('nova')} className={`px-6 py-2 rounded-md font-bold transition-all ${modo === 'nova' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Create New Book</button>
                <button onClick={() => setModo('capitulo')} className={`px-6 py-2 rounded-md font-bold transition-all ${modo === 'capitulo' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>New Chapter Only</button>
                <button
                    onClick={() => {
                        navigate('/escrever-historia-interativa');
                    }}
                    className="px-6 py-2 rounded-md font-bold transition-all text-gray-400 hover:text-white flex items-center gap-2"
                >
                    <><span className="text-zinc-400">⎇</span> Interactive Story</>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* COLUNA DA ESQUERDA (Inputs do Livro) */}
                    {modo === 'nova' ? (
                        <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-xl">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><MdBook className="text-yellow-500" /> Book Details</h3>
                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Book Title</label><input type="text" value={tituloObra} onChange={(e) => setTituloObra(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-primary outline-none" /></div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cover Image (Upload)</label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <label htmlFor="cover-upload-book" className="cursor-pointer bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md text-xs font-bold transition-all shadow-lg">
                                            Choose File
                                        </label>
                                        <input id="cover-upload-book" type="file" onChange={handleCoverFile} className="hidden" accept="image/png, image/jpeg" />
                                        <span className="text-[10px] text-gray-400">{coverFileName || "No file chosen"}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Genres</label>
                                    <div className="flex flex-wrap gap-2">{genresList.map(cat => (<label key={cat} className={`cursor-pointer text-xs px-3 py-1.5 rounded-full border transition-all ${categorias.includes(cat) ? 'bg-primary/20 border-primary text-primary' : 'bg-[#151515] border-[#333] text-gray-400'}`}><input type="checkbox" value={cat} onChange={handleCategoria} className="hidden" /> {cat}</label>))}</div>
                                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[#222]">
                                        {formatsList.map(cat => (<label key={cat} className={`cursor-pointer text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${categorias.includes(cat) ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-[#151515] border-[#333] text-gray-400'}`}><input type="checkbox" value={cat} onChange={handleCategoria} className="hidden" /><span className="text-[10px]">⎇</span> {cat}</label>))}
                                        <span className="text-[10px] text-gray-600 self-center">— mark if this is an interactive branching story</span>
                                    </div>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Synopsis</label><Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={{ ...editorConfig, height: 200 }} onEditorChange={(content) => setSinopse(content)} /></div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-xl">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Book</label>
                            <select value={obraSelecionada} onChange={(e) => setObraSelecionada(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-primary outline-none cursor-pointer">
                                <option value="">-- Select --</option>
                                {minhasObras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-xl relative">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <MdEdit className="text-green-500" /> Content Editor
                        </h3>

                        {/* IMPORT ALERT */}
                        <div className="mb-6 bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <MdFileUpload className="text-purple-400 text-xl flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-purple-400 text-sm font-bold mb-1">Bulk Import Chapters</h4>
                                        <p className="text-gray-400 text-xs mb-2">
                                            Upload a <b>.docx (Word)</b> or <b>.pdf</b> file containing multiple chapters.
                                            The system will automatically detect chapters like "Chapter 1", "Capítulo 5", etc.
                                            You will be able to review and edit them before publishing.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <label htmlFor="bulk-import" className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2">
                                        <MdFileUpload /> {importFile ? "Change File" : "Select File"}
                                    </label>
                                    <input id="bulk-import" type="file" onChange={handleScanFile} className="hidden" accept=".docx,.doc,.pdf" />
                                    {importFile && (
                                        <div className="flex items-center gap-2 bg-purple-500/20 px-2 py-1 rounded text-[10px] text-purple-200">
                                            <span>{importFile.name}</span>
                                            <button onClick={() => {
                                                setImportFile(null);
                                                setExtractedChapters([]);
                                            }} className="hover:text-white"><MdClose /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {importFile ? (
                            <div className="p-6 border-2 border-dashed border-purple-500/30 rounded-lg bg-[#151515]">
                                <div className="text-center mb-6">
                                    <MdBook size={48} className="mx-auto text-purple-500 mb-2 opacity-50" />
                                    <h3 className="text-xl font-bold text-white mb-2">Ready to Publish</h3>
                                    <p className="text-gray-400 text-sm">
                                        We scanned <b>{importFile.name}</b> and found <b>{extractedChapters.length}</b> chapters.<br />
                                        Review and edit them below before publishing.
                                    </p>
                                </div>

                                {isImporting ? (
                                    <div className="text-center text-purple-400 py-8 font-bold animate-pulse flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                        Scanning document...
                                    </div>
                                ) : (
                                    <div className="space-y-4 mb-8 text-left">
                                        {extractedChapters.map((cap, index) => (
                                            <div key={index} className="border border-[#333] rounded-lg overflow-hidden relative">
                                                <div 
                                                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-[#2a2a2a] transition-colors ${editingChapterIndex === index ? 'bg-[#2a2a2a] border-b border-[#333]' : 'bg-[#1f1f1f]'}`}
                                                    onClick={() => setEditingChapterIndex(editingChapterIndex === index ? null : index)}
                                                >
                                                    <span className="text-white font-bold flex items-center gap-2"><span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full">{index + 1}</span> {cap.title}</span>
                                                    <span className="text-xs text-purple-400 flex items-center gap-1">
                                                        <MdEdit /> {editingChapterIndex === index ? 'Close' : 'Edit'}
                                                    </span>
                                                </div>
                                                
                                                {editingChapterIndex === index && (
                                                    <div className="p-4 bg-black/40 space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                                            <input 
                                                                type="text" 
                                                                value={cap.title} 
                                                                onChange={(e) => {
                                                                    const newChapters = [...extractedChapters];
                                                                    newChapters[index].title = e.target.value;
                                                                    setExtractedChapters(newChapters);
                                                                }}
                                                                className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-bold text-sm transition-all" 
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between mb-1">
                                                                <label className="block text-xs font-bold text-gray-500 uppercase">Content (Visual Editor)</label>
                                                                <span className="text-[10px] text-gray-500">
                                                                    {countWords(cap.content)} words
                                                                </span>
                                                            </div>
                                                            <div className="border border-[#333] rounded-lg overflow-hidden">
                                                                <Editor 
                                                                    tinymceScriptSrc={OPEN_SOURCE_TINY} 
                                                                    init={{ ...editorConfig, height: 400 }} 
                                                                    value={cap.content}
                                                                    onEditorChange={(content) => {
                                                                        const newChapters = [...extractedChapters];
                                                                        newChapters[index].content = content;
                                                                        setExtractedChapters(newChapters);
                                                                    }} 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="text-center pt-6 border-t border-white/5">
                                    <button onClick={() => handlePublicar('public')} disabled={loadingPost || extractedChapters.length === 0 || isImporting} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg inline-flex items-center gap-2 text-base transition-all disabled:opacity-50">
                                        {loadingPost ? "Publishing..." : `Publish All ${extractedChapters.length} Chapters`}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chapter Title</label>
                                        <input type="text" value={tituloCapitulo} onChange={(e) => setTituloCapitulo(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-green-500 outline-none font-bold text-lg" />
                                    </div>

                                    {/* LÓGICA DE AGENDAMENTO */}
                                    {modo === 'nova' ? (
                                        <div className="bg-zinc-500/10 border border-zinc-500/30 p-4 rounded-lg flex items-start gap-3">
                                            <MdInfoOutline className="text-zinc-500 text-xl flex-shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-zinc-500 text-sm font-bold mb-1">First Chapter Policy</h4>
                                                <p className="text-gray-400 text-xs">The first chapter of a new book must be published immediately to ensure the book listing is active.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
                                                <MdSchedule /> Schedule Publication (Optional)
                                            </label>
                                            {/* O input type="datetime-local" segue o padrão do navegador, mas a lógica foi tratada */}
                                            <input
                                                type="datetime-local"
                                                value={dataAgendada}
                                                onChange={(e) => setDataAgendada(e.target.value)}
                                                className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-zinc-500 outline-none"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">Leave blank to publish immediately. Format: Month/Day/Year Time</p>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Content</label>
                                            <span className={`text-xs font-bold ${countWords(conteudo) < 500 ? 'text-red-400' : 'text-green-400'}`}>
                                                {countWords(conteudo)} words (Min: 500)
                                            </span>
                                        </div>
                                        <Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={{ ...editorConfig, height: 600 }} onEditorChange={(content) => setConteudo(content)} />
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block tracking-wider">Author Note (Optional)</label>
                                        <div className="border border-[#333] rounded-lg overflow-hidden">
                                            <Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={{ ...editorConfig, height: 200, statusbar: false }} onEditorChange={(content) => setNotaAutor(content)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-white/10">
                                    <button onClick={() => handlePublicar('draft')} disabled={loadingPost} className="bg-[#333] hover:bg-[#444] text-gray-300 font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50">
                                        <MdEdit /> Save Draft
                                    </button>
                                    <button onClick={() => handlePublicar('public')} disabled={loadingPost} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50">
                                        {loadingPost ? "Processing..." : (dataAgendada && modo !== 'nova') ? <><MdSchedule size={20} /> Schedule</> : <><MdCheckCircle size={20} /> Publish</>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
}