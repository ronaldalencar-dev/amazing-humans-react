import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConnection';
import { doc, getDoc, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { Helmet } from 'react-helmet-async';
import { MdLibraryBooks, MdArrowBack } from 'react-icons/md';
import StoryCard from '../components/StoryCard';

export default function Collection() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [collectionData, setCollectionData] = useState(null);
    const [authorName, setAuthorName] = useState('');
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchCollection() {
            try {
                // Tenta carregar do cache da sessão
                const cachedData = sessionStorage.getItem(`collection_${id}`);
                if (cachedData) {
                    const parsedData = JSON.parse(cachedData);
                    setCollectionData(parsedData.collectionData);
                    setAuthorName(parsedData.authorName);
                    setBooks(parsedData.books);
                    setLoading(false);
                    return;
                }

                // Fetch the collection doc
                const colRef = doc(db, 'colecoes', id);
                const colSnap = await getDoc(colRef);

                if (!colSnap.exists()) {
                    setError('Collection not found.');
                    setLoading(false);
                    return;
                }

                const data = colSnap.data();
                const colDataFinal = { id: colSnap.id, ...data };
                setCollectionData(colDataFinal);

                // Fetch Author Name
                let aName = '';
                if (data.autorId) {
                    const authorRef = doc(db, 'usuarios', data.autorId);
                    const authorSnap = await getDoc(authorRef);
                    if (authorSnap.exists()) {
                        aName = authorSnap.data().nome;
                        setAuthorName(aName);
                    }
                }

                // Fetch Books in the collection
                let allBooks = [];
                if (data.obrasIds && data.obrasIds.length > 0) {
                    // Firebase `in` query is limited to 10 items.
                    const batches = [];
                    for (let i = 0; i < data.obrasIds.length; i += 10) {
                        batches.push(data.obrasIds.slice(i, i + 10));
                    }

                    for (let batch of batches) {
                        const q = query(collection(db, 'obras'), where(documentId(), 'in', batch));
                        const booksSnap = await getDocs(q);
                        booksSnap.forEach(doc => {
                            allBooks.push({ id: doc.id, ...doc.data() });
                        });
                    }

                    allBooks.sort((a, b) => data.obrasIds.indexOf(a.id) - data.obrasIds.indexOf(b.id));
                    setBooks(allBooks);
                }
                
                // Salva no cache
                sessionStorage.setItem(`collection_${id}`, JSON.stringify({
                    collectionData: colDataFinal,
                    authorName: aName,
                    books: allBooks
                }));
                
            } catch (err) {
                console.error("Error fetching collection:", err);
                setError('Failed to load collection.');
            } finally {
                setLoading(false);
            }
        }

        fetchCollection();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen pt-24 px-4 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !collectionData) {
        return (
            <div className="min-h-screen pt-24 px-4 flex flex-col items-center justify-center text-center">
                <MdLibraryBooks size={64} className="text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
                <p className="text-gray-400 mb-6">{error || 'Collection not found'}</p>
                <button onClick={() => navigate('/')} className="bg-primary text-black px-6 py-2 rounded-full font-bold">
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
            <Helmet>
                <title>{collectionData.nome} | Amazing Humans</title>
            </Helmet>

            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
                <MdArrowBack /> Back
            </button>

            <div className="bg-[#1f1f1f] rounded-2xl p-6 md:p-10 border border-white/5 shadow-2xl mb-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500"></div>
                <div className="flex items-center gap-3 mb-2">
                    <MdLibraryBooks className="text-primary" size={24} />
                    <span className="text-primary font-bold tracking-wider uppercase text-sm">Collection</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4">{collectionData.nome}</h1>
                <p className="text-gray-400">
                    Curated by <Link to={`/user/${collectionData.autorId}`} className="text-primary hover:underline">{authorName || 'Unknown Author'}</Link>
                </p>
                <div className="mt-6 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-sm text-gray-300">
                    <span className="font-bold text-white">{books.length}</span> {books.length === 1 ? 'Book' : 'Books'}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {books.map(book => (
                    <StoryCard key={book.id} data={book} />
                ))}
            </div>

            {books.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                    This collection has no books yet.
                </div>
            )}
        </div>
    );
}
