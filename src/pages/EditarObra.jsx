import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db, storage } from '../services/firebaseConnection'; // ADICIONADO storage
import {
  doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, writeBatch, serverTimestamp, increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // ADICIONADO
import { Editor } from '@tinymce/tinymce-react';
import { MdSave, MdDelete, MdArrowBack, MdVisibility, MdAdd, MdLock, MdPublic, MdCancel, MdEdit, MdSchedule, MdFileUpload, MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import { parseFile } from '../utils/fileParser';
import PremiumLock from '../components/PremiumLock';

// Lista fixa de categorias para o editor - HFY ADICIONADO
const GENRES = [
  'Fantasy', 'Sci-Fi', 'Romance', 'Horror', 'Adventure',
  'RPG', 'Mystery', 'Action', 'Isekai', 'FanFic', 'HFY'
];
const FORMATS = ['Interactive'];
const categoriesList = [...GENRES, ...FORMATS];

const OPEN_SOURCE_TINY = "https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js";
const editorConfig = {
  height: 250,
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

export default function EditarObra() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [capa, setCapa] = useState('');
  const [coverFileName, setCoverFileName] = useState(null);
  const [sinopse, setSinopse] = useState('');
  const [status, setStatus] = useState('public');
  const [categorias, setCategorias] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // Bulk Delete State
  const [selectedChapters, setSelectedChapters] = useState([]);

  useEffect(() => {
    async function loadDados() {
      if (!user?.uid) return; // Garante que tem usuário antes de buscar

      try {
        const docRef = doc(db, "obras", id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          toast.error("Book not found.");
          return navigate("/dashboard");
        }

        const dados = snapshot.data();
        if (dados.autorId !== user?.uid) {
          toast.error("Permission denied.");
          return navigate("/dashboard");
        }

        setTitulo(dados.titulo || '');
        setCapa(dados.capa || '');
        setSinopse(dados.sinopse || '');
        setStatus(dados.status || 'public');
        setCategorias(dados.categorias || []); // Garante array vazio se não existir

        // Carregar Capítulos
        const q = query(collection(db, "capitulos"), where("obraId", "==", id), orderBy("data", "asc"));
        const snapCaps = await getDocs(q);
        let lista = [];
        snapCaps.forEach(d => lista.push({ id: d.id, ...d.data() }));
        setCapitulos(lista);

      } catch (error) {
        console.error("Erro ao carregar obra:", error);
        toast.error("Error loading book data.");
      } finally {
        setLoading(false);
      }
    }

    loadDados();
  }, [id, user, navigate]);

  const handleCategoria = (cat) => {
    if (categorias.includes(cat)) {
      setCategorias(categorias.filter(c => c !== cat));
    } else {
      setCategorias([...categorias, cat]);
    }
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

  // Filtragem de Capítulos
  const now = new Date();
  const publishedChapters = capitulos.filter(c => c.status !== 'draft' && (!c.data || new Date(c.data.seconds * 1000) <= now));
  const scheduledChapters = capitulos.filter(c => c.status !== 'draft' && (c.data && new Date(c.data.seconds * 1000) > now));
  const draftChapters = capitulos.filter(c => c.status === 'draft');

  async function handleSave() {
    if (!titulo.trim()) return toast.error("Title is required.");

    setSaving(true);
    const toastId = toast.loading("Saving...");
    try {
      await updateDoc(doc(db, "obras", id), {
        titulo,
        capa,
        sinopse,
        status,
        categorias,
        tituloBusca: titulo.toLowerCase() // Atualiza também o índice de busca
      });
      toast.success("Saved!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error saving.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }



  async function handleImport() {
    if (!importFile) return;

    setImporting(true);
    const toastId = toast.loading("Parsing and importing chapters...");

    try {
      const chapters = await parseFile(importFile);
      if (!chapters || chapters.length === 0) {
        throw new Error("No chapters found. Please check file format.");
      }

      const batch = writeBatch(db);
      const newCaps = [];

      chapters.forEach((cap, index) => {
        const now = new Date(); // Base date
        // Increment date by 1 second for each chapter to preserve order
        now.setSeconds(now.getSeconds() + index);

        const newCapRef = doc(collection(db, "capitulos"));
        const capData = {
          obraId: id,
          nomeObra: titulo, // might be old title but okay
          titulo: cap.title || `Chapter ${capitulos.length + index + 1}`,
          conteudo: cap.content, // HTML content now
          authorNote: "",
          autor: user.name,
          autorId: user.uid,
          data: now,
          status: 'public',
          views: 0
        };
        batch.set(newCapRef, capData);
        
        // Simula o formato de Timestamp do Firestore para o estado local renderizar corretamente
        newCaps.push({ 
          id: newCapRef.id, 
          ...capData, 
          data: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 } 
        });
      });

      await batch.commit();

      // Update book total count
      await updateDoc(doc(db, "obras", id), {
        totalChapters: increment(chapters.length),
        lastUpdated: serverTimestamp()
      });

      // Update local state
      setCapitulos(prev => [...prev, ...newCaps]);

      toast.success(`Imported ${chapters.length} chapters!`, { id: toastId });
      setImportFile(null); // Reset import

    } catch (error) {
      console.error(error);
      toast.error("Import failed: " + error.message, { id: toastId });
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteChapter(capId) {
    if (!window.confirm("Are you sure you want to delete this chapter?")) return;

    const toastId = toast.loading("Deleting chapter...");
    try {
      await deleteDoc(doc(db, "capitulos", capId));
      
      // Update book total count
      await updateDoc(doc(db, "obras", id), {
        totalChapters: increment(-1),
        lastUpdated: serverTimestamp()
      });

      // Atualiza a lista local removendo o item deletado
      setCapitulos(prev => prev.filter(c => c.id !== capId));
      setSelectedChapters(prev => prev.filter(id => id !== capId));
      toast.success("Chapter deleted", { id: toastId });
    } catch (error) {
      console.error("Error deleting chapter:", error);
      toast.error("Failed to delete", { id: toastId });
    }
  }

  const toggleSelectChapter = (capId) => {
    setSelectedChapters(prev => 
      prev.includes(capId) ? prev.filter(id => id !== capId) : [...prev, capId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedChapters.length === capitulos.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(capitulos.map(c => c.id));
    }
  };

  async function handleBulkDelete() {
    if (selectedChapters.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedChapters.length} selected chapters? This action cannot be undone.`)) return;

    const toastId = toast.loading(`Deleting ${selectedChapters.length} chapters...`);
    setSaving(true);
    try {
      // Create chunks of 500 for Firestore batch limits
      const chunkSize = 500;
      for (let i = 0; i < selectedChapters.length; i += chunkSize) {
        const chunk = selectedChapters.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(capId => {
          batch.delete(doc(db, "capitulos", capId));
        });
        await batch.commit();
      }

      // Update total chapters in book doc
      await updateDoc(doc(db, "obras", id), {
        totalChapters: increment(-selectedChapters.length),
        lastUpdated: serverTimestamp()
      });

      setCapitulos(prev => prev.filter(c => !selectedChapters.includes(c.id)));
      toast.success(`${selectedChapters.length} chapters deleted!`, { id: toastId });
      setSelectedChapters([]);
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to delete chapters.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBook() {
    const confirmText = window.prompt("Type 'DELETE' to confirm deletion of this book and all chapters:");
    if (confirmText !== "DELETE") return;

    const toastId = toast.loading("Deleting...");
    try {
      // 1. Deleta a Obra
      await deleteDoc(doc(db, "obras", id));

      // 2. Deleta os Capítulos
      const q = query(collection(db, "capitulos"), where("obraId", "==", id));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      toast.success("Deleted.", { id: toastId });
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Error deleting.", { id: toastId });
    }
  }

  // --- LOADER ---
  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="w-10 h-10 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-white/10 pb-4 gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-white transition flex items-center gap-1">
            <MdArrowBack size={24} /> Back
          </Link>
          <h1 className="text-2xl font-bold text-white">Edit Book</h1>
        </div>
        <Link to={`/obra/${id}`} className="bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-white/10">
          <MdVisibility /> View Public Page
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* --- COLUNA 1: CONFIGURAÇÕES DA OBRA --- */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#1f1f1f] border border-[#333] rounded-xl p-6 shadow-lg">

            {/* Visibilidade */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Visibility</label>
              <div className="flex gap-2 bg-[#151515] p-1 rounded-lg border border-[#333]">
                <button
                  onClick={() => setStatus('public')}
                  className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${status === 'public' ? 'bg-green-600/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <MdPublic /> Public
                </button>
                <button
                  onClick={() => setStatus('private')}
                  className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${status === 'private' ? 'bg-red-600/20 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <MdLock /> Private
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Title</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/50 outline-none transition-all" />
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cover Image (Upload)</label>
              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="cover-upload-edit" className="cursor-pointer bg-zinc-600 hover:bg-zinc-500 text-white px-4 py-2 rounded-md text-xs font-bold transition-all shadow-lg">
                  Choose File
                </label>
                <input id="cover-upload-edit" type="file" onChange={handleCoverFile} className="hidden" accept="image/png, image/jpeg" />
                <span className="text-[10px] text-gray-400">{coverFileName || "No file chosen"}</span>
              </div>
            </div>



            {/* Categorias */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Categories</label>
              <div className="flex flex-wrap gap-2 bg-[#151515] p-3 rounded-lg border border-[#333]">
                {GENRES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoria(cat)}
                    className={`text-[10px] px-2.5 py-1 rounded border transition-all ${categorias.includes(cat) ? 'bg-zinc-500/20 border-zinc-500 text-zinc-400 font-bold' : 'bg-[#1f1f1f] border-[#333] text-gray-400 hover:border-gray-500'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2 pt-2">
                {FORMATS.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoria(cat)}
                    className={`text-[10px] px-2.5 py-1 rounded border transition-all flex items-center gap-1 ${categorias.includes(cat) ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-bold' : 'bg-[#1f1f1f] border-[#333] text-gray-400 hover:border-gray-500'}`}
                  >
                    <span>⎇</span> {cat}
                  </button>
                ))}
                <span className="text-[10px] text-gray-600 self-center">— mark only if this is a branching interactive story</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Synopsis</label>
              <div className="rounded-lg overflow-hidden border border-[#333]">
                <Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={editorConfig} value={sinopse} onEditorChange={(c) => setSinopse(c)} />
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <Link to={`/obra/${id}`} className="flex-1 bg-transparent border border-[#444] text-gray-300 hover:bg-[#333] hover:text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                <MdCancel size={18} /> Cancel
              </Link>

              <button onClick={handleSave} disabled={saving} className="flex-1 bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-zinc-500/20 disabled:opacity-50">
                <MdSave size={18} /> {saving ? "Saving..." : "Save"}
              </button>
            </div>

            <button onClick={handleDeleteBook} className="w-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm">
              <MdDelete size={16} /> Delete Book Permanently
            </button>
          </div>
        </div>

        {/* --- COLUNA 2: LISTA DE CAPÍTULOS --- */}
        <div className="lg:col-span-2">
          <div className="bg-[#1f1f1f] border border-[#333] rounded-xl overflow-hidden shadow-lg flex flex-col h-full max-h-[800px]">
            <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#252525]">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={capitulos.length > 0 && selectedChapters.length === capitulos.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer accent-red-500"
                  title="Select All"
                />
                <h3 className="text-white font-bold flex items-center gap-2">
                  Chapters <span className="bg-[#333] text-gray-400 text-xs px-2 py-0.5 rounded-full">{capitulos.length}</span>
                </h3>
              </div>
              <div className="flex gap-2">
                {selectedChapters.length > 0 && (
                  <button onClick={handleBulkDelete} disabled={saving} className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-lg shadow-red-900/20">
                    <MdDelete size={16} /> Delete ({selectedChapters.length})
                  </button>
                )}
                <PremiumLock
                  user={user}
                  feature="PDF/Word Import"
                  description="Import chapters from PDF or Word files"
                  compact
                >
                  <label htmlFor="import-chapter-edit" className={`text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-lg cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
                    <MdFileUpload size={16} /> Import PDF/Word
                  </label>
                  <input id="import-chapter-edit" type="file" onChange={(e) => {
                    if (e.target.files[0]) { setImportFile(e.target.files[0]); }
                  }} className="hidden" accept=".pdf,.docx,.doc" />
                </PremiumLock>

                <Link to={`/escrever?obraId=${id}`} className="text-xs bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-lg shadow-green-900/20">
                  <MdAdd size={16} /> New Chapter
                </Link>
              </div>
            </div>

            {/* IMPORT CONFIRMATION UI */}
            {importFile && (
              <div className="bg-purple-900/20 border-b border-purple-500/30 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MdFileUpload className="text-purple-400 text-xl" />
                  <div>
                    <p className="text-sm font-bold text-white">Import from {importFile.name}?</p>
                    <p className="text-[10px] text-gray-400">Chapters will be appended to the list.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setImportFile(null)} className="px-3 py-1 text-xs font-bold text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleImport} disabled={importing} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-lg">
                    {importing ? "Importing..." : "Confirm Import"}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-2 space-y-6">

              {/* --- SCHEDULED CHAPTERS --- */}
              {scheduledChapters.length > 0 && (
                <div>
                  <h4 className="text-zinc-400 font-bold text-xs uppercase mb-2 flex items-center gap-2 px-2">
                    <MdSchedule /> Scheduled ({scheduledChapters.length})
                  </h4>
                  <div className="space-y-1">
                    {scheduledChapters.map((cap) => (
                      <div key={cap.id} className="p-3 rounded-lg bg-[#252525] hover:bg-[#2a2a2a] flex justify-between items-center group transition border border-zinc-500/20 hover:border-zinc-500/40">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={selectedChapters.includes(cap.id)}
                            onChange={() => toggleSelectChapter(cap.id)}
                            className="w-4 h-4 cursor-pointer accent-red-500 shrink-0"
                          />
                          <div>
                            <p className="text-gray-200 font-medium text-sm group-hover:text-zinc-400 transition-colors">{cap.titulo}</p>
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                              Scheduled: {cap.data ? new Date(cap.data.seconds * 1000).toLocaleString() : '?'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/editar-capitulo/${cap.id}`} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"><MdEdit size={16} /></Link>
                          <button onClick={() => handleDeleteChapter(cap.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><MdDelete size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- DRAFTS --- */}
              {draftChapters.length > 0 && (
                <div>
                  <h4 className="text-yellow-500 font-bold text-xs uppercase mb-2 flex items-center gap-2 px-2">
                    <MdEdit /> Drafts ({draftChapters.length})
                  </h4>
                  <div className="space-y-1">
                    {draftChapters.map((cap) => (
                      <div key={cap.id} className="p-3 rounded-lg bg-[#252525] hover:bg-[#2a2a2a] flex justify-between items-center group transition border border-yellow-500/20 hover:border-yellow-500/40">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={selectedChapters.includes(cap.id)}
                            onChange={() => toggleSelectChapter(cap.id)}
                            className="w-4 h-4 cursor-pointer accent-red-500 shrink-0"
                          />
                          <div>
                            <p className="text-gray-200 font-medium text-sm group-hover:text-yellow-400 transition-colors">{cap.titulo}</p>
                            <span className="text-[10px] text-yellow-500/80 mt-0.5 block">Not Published</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/editar-capitulo/${cap.id}`} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"><MdEdit size={16} /></Link>
                          <button onClick={() => handleDeleteChapter(cap.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><MdDelete size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- PUBLISHED CHAPTERS --- */}
              <div>
                <h4 className="text-gray-500 font-bold text-xs uppercase mb-2 flex items-center gap-2 px-2">
                  <MdPublic /> Published ({publishedChapters.length})
                </h4>
                {publishedChapters.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600 text-sm italic">No published chapters yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {publishedChapters.map((cap, index) => (
                      <div key={cap.id} className="p-3 rounded-lg hover:bg-[#2a2a2a] flex justify-between items-center group transition border border-transparent hover:border-[#333]">
                        <div className="flex items-center gap-4">
                          <input 
                            type="checkbox" 
                            checked={selectedChapters.includes(cap.id)}
                            onChange={() => toggleSelectChapter(cap.id)}
                            className="w-4 h-4 cursor-pointer accent-red-500 shrink-0"
                          />
                          <span className="text-gray-600 font-mono text-xs w-6 text-center">#{index + 1}</span>
                          <div>
                            <p className="text-gray-200 font-medium text-sm group-hover:text-green-400 transition-colors">{cap.titulo}</p>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                              {cap.data ? new Date(cap.data.seconds * 1000).toLocaleDateString() : 'No date'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/editar-capitulo/${cap.id}`} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"><MdEdit size={16} /></Link>
                          <button onClick={() => handleDeleteChapter(cap.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><MdDelete size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}