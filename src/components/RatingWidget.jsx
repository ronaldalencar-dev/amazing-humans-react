import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { 
    doc, getDoc, setDoc, collection, query, where, getDocs 
} from 'firebase/firestore';
import { MdStar, MdStarBorder } from 'react-icons/md';
import toast from 'react-hot-toast';

export default function RatingWidget({ obraId, onRatingUpdate }) {
  const { user } = useContext(AuthContext);
  
  const [userRating, setUserRating] = useState(0); 
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);

  // 1. Check existing rating
  useEffect(() => {
    async function checkUserRating() {
      if (!user?.uid || !obraId) return;
      
      const cacheKey = `rating_${obraId}_${user.uid}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached !== null) {
          setUserRating(Number(cached));
          return;
      }
      
      const docRef = doc(db, "avaliacoes", `${obraId}_${user.uid}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const rating = docSnap.data().rating;
        setUserRating(rating);
        sessionStorage.setItem(cacheKey, rating);
      } else {
        sessionStorage.setItem(cacheKey, 0);
      }
    }
    checkUserRating();
  }, [obraId, user]);

  // 2. Save rating
  async function handleRate(rate) {
   if (!user) return toast.error("Login to rate.");
    setLoading(true);

    try {
      // Just save the user rating.
      // Cloud Functions will detect this and update the book average automatically.
      await setDoc(doc(db, "avaliacoes", `${obraId}_${user.uid}`), {
        obraId: obraId,
        userId: user.uid,
        rating: rate,
        updatedAt: new Date()
      });

      setUserRating(rate);
      sessionStorage.setItem(`rating_${obraId}_${user.uid}`, rate);
      toast.success("Rating saved!");
      
      // Optional: Optimistic visual update
      if(onRatingUpdate) {
          onRatingUpdate(rate, 999); 
      }

    } catch (error) {
      console.error("Error saving rating:", error);
      toast.error("Error saving rating.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 15, padding: 15, background: '#252525', borderRadius: 5, border: '1px solid #444' }}>
      <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9rem' }}>
        {userRating > 0 ? "Your rating:" : "Rate this story:"}
      </p>
      
      <div style={{ display: 'flex', gap: 5, cursor: 'pointer' }} onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <div 
            key={star}
            onClick={() => !loading && handleRate(star)}
            onMouseEnter={() => !loading && setHoverRating(star)}
            style={{ transition: '0.2s', transform: (hoverRating >= star || (!hoverRating && userRating >= star)) ? 'scale(1.1)' : 'scale(1)' }}
          >
            {(hoverRating >= star || (!hoverRating && userRating >= star)) ? (
              <MdStar size={32} color="#ffd700" />
            ) : (
              <MdStarBorder size={32} color="#555" />
            )}
          </div>
        ))}
      </div>
      
      {loading && <span style={{ fontSize: '0.8rem', color: '#4a90e2' }}>Saving...</span>}
    </div>
  );
}