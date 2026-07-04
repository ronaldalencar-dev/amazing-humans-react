import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    MdAdd, MdSave, MdPublic, MdArrowBack, MdDelete,
    MdFlag, MdCallSplit, MdPlayArrow, MdClose, MdLightbulb,
    MdArrowForward, MdCheck, MdEdit,
} from 'react-icons/md';
import { FiGitBranch } from 'react-icons/fi';

// ─── TUTORIAL SLIDES ─────────────────────────────────────────────────────────
const TUTORIAL_SLIDES = [
    {
        icon: '📖',
        title: 'Scenes',
        desc: 'Your story is made of Scenes — each one is a moment where something happens. The first scene you create becomes the Start of the story.',
        tip: 'Click "+ Add Scene" in the panel on the left to create your first scene.',
    },
    {
        icon: '🔀',
        title: 'Choices',
        desc: 'Inside each scene you can add Choices — these are the buttons the reader will click to decide what happens next. Each choice leads to another scene.',
        tip: 'Select a scene and use the "Choices" section to add options like "Go left" or "Open the door".',
    },
    {
        icon: '🏁',
        title: 'Endings',
        desc: 'An Ending is a special scene that closes a story path — it has text but no choices. A story can have multiple endings depending on the reader\'s decisions.',
        tip: 'Click "+ Add Ending" to create a final scene. You can have as many endings as you want!',
    },
];

function TutorialModal({ onClose }) {
    const [slide, setSlide] = useState(0);
    const isLast = slide === TUTORIAL_SLIDES.length - 1;
    const s = TUTORIAL_SLIDES[slide];
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d1117] border border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                {/* Progress bar */}
                <div className="flex gap-1 p-4 pb-0">
                    {TUTORIAL_SLIDES.map((_, i) => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= slide ? 'bg-zinc-500' : 'bg-white/10'}`} />
                    ))}
                </div>

                <div className="p-8 text-center">
                    <div className="text-5xl mb-4">{s.icon}</div>
                    <h2 className="text-2xl font-bold text-white mb-3">{s.title}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-5">{s.desc}</p>
                    <div className="flex items-start gap-2.5 bg-zinc-500/10 border border-zinc-500/20 rounded-xl p-3 text-left">
                        <MdLightbulb className="text-zinc-400 flex-shrink-0 mt-0.5" size={15} />
                        <p className="text-zinc-300 text-xs leading-relaxed">{s.tip}</p>
                    </div>
                </div>

                <div className="flex gap-3 px-8 pb-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                    >
                        Skip tutorial
                    </button>
                    <button
                        onClick={() => isLast ? onClose() : setSlide(s => s + 1)}
                        className="flex-1 py-2.5 bg-zinc-600 hover:bg-zinc-500 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                        {isLast ? <><MdCheck size={16} /> Got it!</> : <><MdArrowForward size={16} /> Next</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CUSTOM SCENE NODE (for the mini-map graph) ───────────────────────────────
function SceneNode({ data, selected }) {
    const isEnding = data.isEnding;
    return (
        <div className={`
            relative rounded-xl border-2 transition-all duration-200 shadow-xl
            w-52 overflow-hidden cursor-pointer select-none
            ${selected
                ? isEnding ? 'border-amber-400 shadow-amber-400/30' : 'border-zinc-400 shadow-zinc-400/30'
                : isEnding ? 'border-amber-600/60 hover:border-amber-400/80' : 'border-slate-600/60 hover:border-zinc-400/60'
            }
        `}
            style={{ background: isEnding ? 'linear-gradient(135deg,#1a120a,#2a1a0a)' : 'linear-gradient(135deg,#0d1117,#161b22)' }}
        >
            <div className={`h-1 w-full ${isEnding ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-zinc-500 to-purple-500'}`} />
            <div className="px-3 pt-2 pb-2 flex items-center gap-2">
                {isEnding ? <MdFlag size={13} className="text-amber-400 flex-shrink-0" /> : <MdCallSplit size={13} className="text-zinc-400 flex-shrink-0" />}
                <p className="text-white font-semibold text-xs truncate">{data.title || 'Untitled'}</p>
                {data.isStart && <span className="ml-auto text-[9px] bg-green-500/30 text-green-400 px-1.5 py-0.5 rounded font-bold flex-shrink-0">START</span>}
            </div>
            {!isEnding && (
                <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-zinc-500 !border-2 !border-zinc-300" style={{ bottom: -5 }} />
            )}
            <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-purple-300" style={{ top: -5 }} />
        </div>
    );
}

const nodeTypes = { scene: SceneNode };

// ─── MAIN EDITOR ─────────────────────────────────────────────────────────────
export default function WriteInteractiveStory() {
    const { id: editId } = useParams();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [saving, setSaving] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    // Sidebar editing state
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editChoices, setEditChoices] = useState([]);
    const [editIsEnding, setEditIsEnding] = useState(false);

    const nodeIdCounter = useRef(1);
    // Track if we're currently editing to avoid clobbering from node selection effect
    const isEditingRef = useRef(false);

    // ── First-access tutorial ─────────────────────────────────────
    useEffect(() => {
        if (!localStorage.getItem('ih_tutorial_seen')) {
            setShowTutorial(true);
        }
    }, []);

    const dismissTutorial = () => {
        localStorage.setItem('ih_tutorial_seen', '1');
        setShowTutorial(false);
    };

    // ── Load existing story ──────────────────────────────────────
    useEffect(() => {
        if (!editId) return;
        async function load() {
            const snap = await getDoc(doc(db, 'historias_interativas', editId));
            if (!snap.exists()) return toast.error('Story not found.');
            const d = snap.data();
            setTitulo(d.titulo || '');
            setDescricao(d.descricao || '');

            const storedNodes = (d.nodes || []).map(n => ({
                id: n.id,
                type: 'scene',
                position: n.position || { x: 0, y: 0 },
                data: {
                    title: n.title,
                    content: n.content,
                    choices: n.choices || [],
                    isEnding: n.isEnding || false,
                    isStart: n.id === d.startNodeId,
                }
            }));

            const storedEdges = [];
            (d.nodes || []).forEach(n => {
                (n.choices || []).forEach(ch => {
                    if (ch.targetNodeId) {
                        storedEdges.push({
                            id: `e-${n.id}-${ch.targetNodeId}-${ch.id}`,
                            source: n.id,
                            target: ch.targetNodeId,
                            label: ch.label,
                            style: { stroke: '#4a90e2', strokeWidth: 2 },
                            labelStyle: { fill: '#aaa', fontSize: 10 },
                            labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
                        });
                    }
                });
            });

            setNodes(storedNodes);
            setEdges(storedEdges);

            const maxNum = storedNodes.reduce((acc, n) => {
                const num = parseInt(n.id.replace('node-', ''), 10);
                return isNaN(num) ? acc : Math.max(acc, num);
            }, 0);
            nodeIdCounter.current = maxNum + 1;
        }
        load();
    }, [editId]);

    // ── Sync sidebar when selected node changes ──────────────────
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    useEffect(() => {
        if (selectedNode && !isEditingRef.current) {
            setEditTitle(selectedNode.data.title || '');
            setEditContent(selectedNode.data.content || '');
            setEditChoices(selectedNode.data.choices ? JSON.parse(JSON.stringify(selectedNode.data.choices)) : []);
            setEditIsEnding(selectedNode.data.isEnding || false);
        }
        if (!selectedNode) {
            isEditingRef.current = false;
        }
    }, [selectedNodeId]); // only trigger on node ID change, not on every render

    const onConnect = useCallback((params) => {
        setEdges(eds => addEdge({ ...params, style: { stroke: '#4a90e2', strokeWidth: 2 }, animated: true }, eds));
    }, [setEdges]);

    // ── Add new node ─────────────────────────────────────────────
    const addNode = useCallback((isEnding = false) => {
        const id = `node-${nodeIdCounter.current++}`;
        const isFirst = nodes.length === 0;
        const newNode = {
            id,
            type: 'scene',
            position: { x: 80 + (nodes.length % 3) * 220, y: 80 + Math.floor(nodes.length / 3) * 160 },
            data: {
                title: isFirst ? 'Opening Scene' : isEnding ? 'The End' : `Scene ${nodes.length + 1}`,
                content: '',
                choices: [],
                isEnding,
                isStart: isFirst,
            }
        };
        setNodes(nds => [...nds, newNode]);
        isEditingRef.current = false;
        setSelectedNodeId(id);
    }, [nodes.length, setNodes]);

    const deleteNode = (nodeId) => {
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    };

    // ── Apply edits back to the node ─────────────────────────────
    const applyEdits = useCallback(() => {
        if (!selectedNodeId) return;
        setNodes(nds => nds.map(n => {
            if (n.id !== selectedNodeId) return n;
            return { ...n, data: { ...n.data, title: editTitle, content: editContent, choices: editChoices, isEnding: editIsEnding } };
        }));

        setEdges(eds => {
            const filtered = eds.filter(e => e.source !== selectedNodeId);
            const newEdges = editChoices.filter(c => c.targetNodeId).map(c => ({
                id: `e-${selectedNodeId}-${c.targetNodeId}-${c.id}`,
                source: selectedNodeId,
                target: c.targetNodeId,
                label: c.label,
                style: { stroke: '#4a90e2', strokeWidth: 2 },
                animated: true,
                labelStyle: { fill: '#aaa', fontSize: 10 },
                labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
            }));
            return [...filtered, ...newEdges];
        });
        toast.success('Scene saved!', { icon: '✅', duration: 1500 });
    }, [selectedNodeId, editTitle, editContent, editChoices, editIsEnding, setNodes, setEdges]);

    // ── Auto-apply when switching scene ─────────────────────────
    const selectNode = (nodeId) => {
        // save current edits before switching
        if (selectedNodeId && selectedNodeId !== nodeId) {
            applyEdits();
        }
        isEditingRef.current = false;
        setSelectedNodeId(nodeId);
    };

    // ── Choice helpers ───────────────────────────────────────────
    const addChoice = () => {
        isEditingRef.current = true;
        setEditChoices(prev => [...prev, { id: `choice-${Date.now()}`, label: '', targetNodeId: '' }]);
    };
    const updateChoice = (idx, field, value) => {
        isEditingRef.current = true;
        setEditChoices(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };
    const removeChoice = (idx) => {
        isEditingRef.current = true;
        setEditChoices(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Serialize and save ───────────────────────────────────────
    const serialize = () => {
        const startNode = nodes.find(n => n.data.isStart) || nodes[0];
        return {
            nodes: nodes.map(n => ({
                id: n.id, title: n.data.title, content: n.data.content,
                choices: n.data.choices, isEnding: n.data.isEnding, position: n.position,
            })),
            startNodeId: startNode?.id || null,
        };
    };

    const handleSave = async (status = 'draft') => {
        if (!user) return toast.error('You must be logged in!');
        if (!titulo.trim()) return toast.error('Please enter a title.');
        if (nodes.length === 0) return toast.error('Add at least one scene.');

        // Apply any pending edits first
        if (selectedNodeId) applyEdits();

        setSaving(true);
        const toastId = toast.loading(status === 'draft' ? 'Saving draft…' : 'Publishing…');
        try {
            const { nodes: sNodes, startNodeId } = serialize();
            const payload = {
                titulo: titulo.trim(), descricao: descricao.trim(),
                autorId: user.uid, autor: user.name,
                status, nodes: sNodes, startNodeId, lastUpdated: serverTimestamp(),
            };
            if (editId) {
                await updateDoc(doc(db, 'historias_interativas', editId), payload);
                toast.success(status === 'draft' ? 'Draft saved!' : 'Published!', { id: toastId });
            } else {
                payload.dataCriacao = serverTimestamp();
                const ref = await addDoc(collection(db, 'historias_interativas'), payload);
                toast.success(status === 'draft' ? 'Draft saved!' : 'Published!', { id: toastId });
                navigate(`/write-interactive-story/${ref.id}`, { replace: true });
            }
        } catch (err) {
            console.error(err);
            toast.error('Error: ' + err.message, { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const scenes = nodes.filter(n => !n.data.isEnding);
    const endings = nodes.filter(n => n.data.isEnding);

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#080b10]">

            {showTutorial && <TutorialModal onClose={dismissTutorial} />}

            {/* ─── TOP TOOLBAR ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0d1117] border-b border-white/10 flex-shrink-0 z-10">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Back to Dashboard"
                >
                    <MdArrowBack size={20} />
                </button>

                <FiGitBranch className="text-zinc-400 text-xl flex-shrink-0" />

                <div className="flex flex-col flex-1 min-w-0">
                    <input
                        type="text"
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        placeholder="Story title…"
                        className="bg-transparent text-white font-bold text-base outline-none placeholder-gray-600 w-full max-w-xs"
                    />
                    <input
                        type="text"
                        value={descricao}
                        onChange={e => setDescricao(e.target.value)}
                        placeholder="Short description…"
                        className="bg-transparent text-gray-400 text-xs outline-none placeholder-gray-700 w-full max-w-sm"
                    />
                </div>

                <button
                    onClick={() => setShowTutorial(true)}
                    className="p-2 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
                    title="Show tutorial"
                >
                    <MdLightbulb size={18} />
                </button>

                <div className="w-px bg-white/10 h-8" />

                <button
                    onClick={() => editId ? window.open(`/interactive-story/${editId}`, '_blank') : toast('Save first to preview!')}
                    disabled={!editId}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
                >
                    <MdPlayArrow size={18} /> Preview
                </button>
                <button
                    onClick={() => handleSave('draft')}
                    disabled={saving}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-gray-200 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                >
                    <MdSave size={18} /> Save Draft
                </button>
                <button
                    onClick={() => handleSave('public')}
                    disabled={saving}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                >
                    <MdPublic size={18} /> Publish
                </button>
            </div>

            {/* ─── MAIN AREA ───────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── LEFT: Scene List ─────────────────────────────── */}
                <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[#0a0d14] flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/5 flex-shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Your Story</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {nodes.length === 0 && (
                            <div className="text-center py-10 text-gray-700">
                                <FiGitBranch size={28} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No scenes yet.<br />Click a button below to start.</p>
                            </div>
                        )}

                        {/* Scenes */}
                        {scenes.length > 0 && (
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 px-1 mb-1">Scenes ({scenes.length})</p>
                                {scenes.map((n, i) => (
                                    <SceneListItem
                                        key={n.id}
                                        node={n}
                                        index={i}
                                        isSelected={selectedNodeId === n.id}
                                        onSelect={() => selectNode(n.id)}
                                        onDelete={() => deleteNode(n.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Endings */}
                        {endings.length > 0 && (
                            <div className="pt-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700/70 px-1 mb-1">Endings ({endings.length})</p>
                                {endings.map((n, i) => (
                                    <SceneListItem
                                        key={n.id}
                                        node={n}
                                        index={i}
                                        isSelected={selectedNodeId === n.id}
                                        onSelect={() => selectNode(n.id)}
                                        onDelete={() => deleteNode(n.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add buttons */}
                    <div className="p-3 border-t border-white/5 space-y-2 flex-shrink-0">
                        <button
                            onClick={() => addNode(false)}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-600/20 hover:bg-zinc-600/40 border border-zinc-500/30 text-zinc-300 py-2.5 rounded-xl text-xs font-bold transition-all"
                        >
                            <MdAdd size={16} /> Add Scene
                        </button>
                        <button
                            onClick={() => addNode(true)}
                            className="w-full flex items-center justify-center gap-2 bg-amber-600/15 hover:bg-amber-600/30 border border-amber-500/25 text-amber-400 py-2.5 rounded-xl text-xs font-bold transition-all"
                        >
                            <MdFlag size={14} /> Add Ending
                        </button>
                    </div>
                </div>

                {/* ── CENTER: Scene Editor ──────────────────────────── */}
                <div className="flex-1 overflow-y-auto border-r border-white/10">
                    {!selectedNode ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                <MdEdit size={32} className="text-white/20" />
                            </div>
                            <h3 className="text-white/30 text-lg font-bold mb-1">Select a scene to edit</h3>
                            <p className="text-white/15 text-sm max-w-xs">Click any scene in the list on the left, or create your first one using the buttons below the list.</p>
                        </div>
                    ) : (
                        <div className="p-6 max-w-2xl mx-auto space-y-6">

                            {/* Scene type badge + header */}
                            <div className="flex items-center gap-3">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${editIsEnding ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                                    {editIsEnding ? <><MdFlag size={12} /> Ending</> : <><MdCallSplit size={12} /> Scene</>}
                                    {selectedNode.data.isStart && <span className="ml-1 text-green-400">· START</span>}
                                </div>
                                <div className="flex gap-1 ml-auto">
                                    <button
                                        onClick={() => { isEditingRef.current = true; setEditIsEnding(false); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!editIsEnding ? 'bg-zinc-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >Scene</button>
                                    <button
                                        onClick={() => { isEditingRef.current = true; setEditIsEnding(true); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${editIsEnding ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >Ending</button>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Scene Title</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={e => { isEditingRef.current = true; setEditTitle(e.target.value); }}
                                    placeholder="Give this scene a name…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-semibold focus:border-zinc-500 outline-none transition-colors placeholder-gray-700"
                                />
                            </div>

                            {/* Content — plain textarea (no TinyMCE to avoid cursor bug) */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Scene Content</label>
                                <textarea
                                    value={editContent}
                                    onChange={e => { isEditingRef.current = true; setEditContent(e.target.value); }}
                                    placeholder="Write what happens in this scene… The reader will see this text before making a choice."
                                    rows={10}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-200 text-sm leading-relaxed focus:border-zinc-500 outline-none transition-colors resize-y placeholder-gray-700 font-serif"
                                    style={{ fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: '1.75' }}
                                />
                            </div>

                            {/* Choices — only for scene nodes */}
                            {!editIsEnding && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest">Reader Choices</label>
                                            <p className="text-gray-700 text-[10px] mt-0.5">Buttons the reader will click to continue</p>
                                        </div>
                                        <button
                                            onClick={addChoice}
                                            className="flex items-center gap-1.5 bg-zinc-600/20 hover:bg-zinc-600/40 border border-zinc-500/30 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        >
                                            <MdAdd size={14} /> Add Choice
                                        </button>
                                    </div>

                                    {editChoices.length === 0 ? (
                                        <div className="text-center py-6 bg-white/3 border border-dashed border-white/10 rounded-xl">
                                            <p className="text-gray-600 text-sm">No choices yet.</p>
                                            <p className="text-gray-700 text-xs mt-1">Add choices to let readers decide what happens next. Without choices, the scene becomes an ending.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {editChoices.map((choice, idx) => (
                                                <div key={choice.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Choice {idx + 1}</span>
                                                        <button onClick={() => removeChoice(idx)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                                                            <MdClose size={14} />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder='Button text (e.g. "Go left" or "Open the door")'
                                                        value={choice.label}
                                                        onChange={e => updateChoice(idx, 'label', e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-zinc-500 outline-none transition-colors placeholder-gray-700"
                                                    />
                                                    <div>
                                                        <label className="text-[10px] text-gray-600 mb-1 block">Leads to scene:</label>
                                                        <select
                                                            value={choice.targetNodeId}
                                                            onChange={e => updateChoice(idx, 'targetNodeId', e.target.value)}
                                                            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm focus:border-zinc-500 outline-none cursor-pointer"
                                                        >
                                                            <option value="">→ Select a destination scene</option>
                                                            {nodes.filter(n => n.id !== selectedNodeId).map(n => (
                                                                <option key={n.id} value={n.id}>
                                                                    {n.data.isEnding ? '🏁 ' : '📖 '}{n.data.title || n.id}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Save scene button */}
                            <button
                                onClick={applyEdits}
                                className="w-full bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-zinc-600/20 flex items-center justify-center gap-2 text-sm"
                            >
                                <MdCheck size={18} /> Save Scene
                            </button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Graph Overview ──────────────────────────── */}
                <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/5 flex-shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Story Map</p>
                        <p className="text-[9px] text-gray-700 mt-0.5">overview of all scenes and connections</p>
                    </div>
                    <div className="flex-1 relative">
                        {nodes.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                <FiGitBranch size={32} className="text-white/10 mb-3" />
                                <p className="text-white/20 text-xs">Your story map will appear here as you add scenes</p>
                            </div>
                        ) : (
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={(_, node) => selectNode(node.id)}
                                onPaneClick={() => { }}
                                nodeTypes={nodeTypes}
                                fitView
                                colorMode="dark"
                                defaultEdgeOptions={{ style: { stroke: '#4a90e2', strokeWidth: 2 }, animated: true }}
                                nodesDraggable={true}
                                nodesConnectable={true}
                                elementsSelectable={true}
                            >
                                <Background color="#1a2035" gap={20} size={1} />
                                <Controls className="!bg-[#0d1117] !border-white/10" showInteractive={false} />
                                <MiniMap
                                    className="!bg-[#0d1117] !border-white/10"
                                    nodeColor={n => n.data.isEnding ? '#b45309' : '#1d4ed8'}
                                />
                                <Panel position="bottom-left">
                                    <div className="flex gap-3 text-[9px] text-gray-700">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" /> Scene</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Ending</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Start</span>
                                    </div>
                                </Panel>
                            </ReactFlow>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── SCENE LIST ITEM ──────────────────────────────────────────────────────────
function SceneListItem({ node, index, isSelected, onSelect, onDelete }) {
    const isEnding = node.data.isEnding;
    return (
        <div
            onClick={onSelect}
            className={`
                group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all
                ${isSelected
                    ? isEnding ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-zinc-500/15 border border-zinc-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }
            `}
        >
            <div className="flex-shrink-0">
                {isEnding
                    ? <MdFlag size={13} className={isSelected ? 'text-amber-400' : 'text-gray-600'} />
                    : <MdCallSplit size={13} className={isSelected ? 'text-zinc-400' : 'text-gray-600'} />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs truncate font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                    {node.data.title || 'Untitled'}
                </p>
                {node.data.isStart && <span className="text-[9px] text-green-500 font-bold">START</span>}
            </div>
            {!node.data.isStart && (
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
                >
                    <MdDelete size={13} />
                </button>
            )}
        </div>
    );
}
