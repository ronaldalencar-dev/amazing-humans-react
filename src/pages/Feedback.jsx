import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebaseConnection';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MdBugReport, MdLightbulb, MdChatBubbleOutline, MdSend } from 'react-icons/md';

export default function Feedback() {
  const { signed, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!signed) {
      toast.error("You must be logged in to submit feedback.");
      return;
    }

    const wordCount = message.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 50 || wordCount > 2000) {
      toast.error(`Feedback must be between 50 and 2000 words. Currently: ${wordCount}`);
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Sending feedback...");

    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        type: type,
        message: message,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      toast.success("Thank you for your feedback!", { id: toastId });
      setMessage('');
      // Optionally navigate away
    } catch (error) {
      console.error(error);
      toast.error("Error sending feedback. Try again later.", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">Give Your Feedback</h1>
        <p className="text-gray-400">Help us improve the platform! Report bugs or suggest new features.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#1f1f1f] border border-[#333] p-6 md:p-8 rounded-2xl shadow-xl">
        
        <div className="mb-8">
          <label className="block text-gray-400 text-sm font-bold uppercase mb-4">What kind of feedback?</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setType('bug')}
              className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${type === 'bug' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-[#151515] border-[#333] text-gray-500 hover:text-white'}`}
            >
              <MdBugReport size={20} /> Bug Report
            </button>
            <button
              type="button"
              onClick={() => setType('enhancement')}
              className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${type === 'enhancement' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-[#151515] border-[#333] text-gray-500 hover:text-white'}`}
            >
              <MdLightbulb size={20} /> Suggestion
            </button>
            <button
              type="button"
              onClick={() => setType('other')}
              className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${type === 'other' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-[#151515] border-[#333] text-gray-500 hover:text-white'}`}
            >
              <MdChatBubbleOutline size={20} /> General
            </button>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-gray-400 text-sm font-bold uppercase mb-2">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue or your idea in detail..."
            className="w-full h-40 bg-[#151515] border border-[#333] text-white p-4 rounded-xl outline-none focus:border-primary transition-colors resize-none"
            disabled={loading}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            {loading ? "Sending..." : "Submit Feedback"} <MdSend />
          </button>
        </div>
      </form>
    </div>
  );
}
