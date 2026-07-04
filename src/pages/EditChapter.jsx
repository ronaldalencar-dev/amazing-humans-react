import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Editor } from '@tinymce/tinymce-react';
import { MdSave, MdArrowBack, MdWarning, MdCancel } from 'react-icons/md'; // MdCancel adicionado
import toast from 'react-hot-toast';

const OPEN_SOURCE_TINY = "https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js";
const editorConfig = {
  height: 500,
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

export default function EditChapter() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [notaAutor, setNotaAutor] = useState('');
  const [obraId, setObraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idMismatch, setIdMismatch] = useState(false);

  useEffect(() => {
    async function loadCap() {
      try {
        const docRef = doc(db, "capitulos", id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          toast.error("Chapter not found.");
          return navigate("/dashboard");
        }

        const dados = snapshot.data();
        let permitido = false;

        if (dados.autorId === user?.uid) {
          permitido = true;
        }
        else if (dados.obraId) {
          const bookRef = doc(db, "obras", dados.obraId);
          const bookSnap = await getDoc(bookRef);
          if (bookSnap.exists() && bookSnap.data().autorId === user?.uid) {
            permitido = true;
            setIdMismatch(true);
          }
        }

        if (!permitido) {
          toast.error("Permission denied: You are not the author.");
          return navigate("/dashboard");
        }

        setTitulo(dados.titulo);
        setConteudo(dados.conteudo);
        setNotaAutor(dados.authorNote || '');
        setObraId(dados.obraId);
        setLoading(false);

      } catch (error) {
        console.error(error);
        toast.error("Error loading data.");
        setLoading(false);
      }
    }

    if (user?.uid) {
      loadCap();
    }
  }, [id, user, navigate]);

  async function handleSave() {
    if (!titulo || !conteudo) return toast.error("Please fill in title and content.");

    setSaving(true);
    const toastId = toast.loading("Saving...");

    try {
      const updateData = { titulo, conteudo, authorNote: notaAutor };
      if (idMismatch && user?.uid) updateData.autorId = user.uid;

      await updateDoc(doc(db, "capitulos", id), updateData);

      toast.success("Chapter updated successfully!", { id: toastId });
      if (idMismatch) setIdMismatch(false);

    } catch (error) {
      console.error(error);
      if (error.code === 'permission-denied') {
        toast.error("Database Rule Error: Update Firestore Rules.", { id: toastId });
      } else {
        toast.error("Error saving chapter.", { id: toastId });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <Link to={`/edit-story/${obraId}`} className="text-gray-400 hover:text-white transition flex items-center gap-1">
            <MdArrowBack size={20} /> Back
          </Link>
          <h1 className="text-2xl font-bold text-white">Edit Chapter</h1>
        </div>

        <div className="flex gap-2">
          {/* Botão Cancelar */}
          <button onClick={() => navigate(`/edit-story/${obraId}`)} className="bg-transparent border border-[#444] hover:bg-[#333] text-gray-300 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
            <MdCancel size={18} /> Cancel
          </button>

          <button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
            <MdSave size={20} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {idMismatch && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 p-3 rounded-lg flex items-center gap-3 text-sm">
          <MdWarning className="text-yellow-500 text-xl" />
          <span>
            <strong>Notice:</strong> This chapter had an ownership mismatch. Saving now will automatically fix the ownership to your account.
          </span>
        </div>
      )}

      <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-xl space-y-6 shadow-xl">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Chapter Title</label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-4 text-white text-lg font-bold focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all" placeholder="Enter chapter title..." />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Content</label>
          <div className="border border-[#333] rounded-lg overflow-hidden">
            <Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={editorConfig} value={conteudo} onEditorChange={(c) => setConteudo(c)} />
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block tracking-wider">Author Note (Optional)</label>
          <div className="border border-[#333] rounded-lg overflow-hidden">
            <Editor tinymceScriptSrc={OPEN_SOURCE_TINY} init={{ ...editorConfig, height: 150, statusbar: false }} value={notaAutor} onEditorChange={(c) => setNotaAutor(c)} />
          </div>
        </div>
      </div>
    </div>
  );
}