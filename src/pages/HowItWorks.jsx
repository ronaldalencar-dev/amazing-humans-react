import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MdMenuBook, MdCreate, MdPeople, MdDevices, 
  MdNotificationsActive, MdFavorite, MdUploadFile, MdAccountTree, MdAttachMoney
} from 'react-icons/md';

export default function HowItWorks() {
  return (
    <div className="min-h-screen pb-20 pt-10 px-4 max-w-6xl mx-auto">
      
      {/* HERO SECTION */}
      <div className="text-center mb-20 animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
          How <span className="text-primary">Amazing Humans</span> Works
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          The ultimate platform for modern storytelling. Read, write, and experience stories like never before.
        </p>
      </div>

      {/* READERS SECTION */}
      <div className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            <MdMenuBook size={28} />
          </div>
          <h2 className="text-3xl font-bold text-white">For Readers</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-2xl hover:border-primary transition-colors">
            <h3 className="text-xl font-bold text-white mb-3">Standard & Interactive Stories</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Enjoy traditional chapter-by-chapter books, or dive into Interactive Stories where your choices determine the outcome of the narrative.
            </p>
          </div>
          
          <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-2xl hover:border-primary transition-colors">
            <h3 className="text-xl font-bold text-white mb-3">Community Interaction</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Leave reviews, rate chapters, and comment on your favorite moments. Your feedback directly supports the authors.
            </p>
          </div>

          <div className="bg-[#1f1f1f] border border-[#333] p-6 rounded-2xl hover:border-primary transition-colors">
            <h3 className="text-xl font-bold text-white mb-3">Stay Updated</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Follow your favorite authors to receive instant notifications whenever they publish a new chapter or a new book.
            </p>
          </div>
        </div>
      </div>

      {/* AUTHORS SECTION */}
      <div className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
            <MdCreate size={28} />
          </div>
          <h2 className="text-3xl font-bold text-white">For Authors</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#1f1f1f] border border-[#333] p-8 rounded-2xl flex gap-6 hover:border-green-500 transition-colors">
            <div className="text-green-500"><MdAccountTree size={40} /></div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Write Interactive Branching Stories</h3>
              <p className="text-gray-400 leading-relaxed">
                Break the limits of linear storytelling. Our custom editor allows you to create branching paths, multiple endings, and give your readers agency over the plot.
              </p>
            </div>
          </div>

          <div className="bg-[#1f1f1f] border border-[#333] p-8 rounded-2xl flex gap-6 hover:border-green-500 transition-colors">
            <div className="text-green-500"><MdUploadFile size={40} /></div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Bulk PDF Upload</h3>
              <p className="text-gray-400 leading-relaxed">
                Already have a finished manuscript? You don't need to copy and paste chapter by chapter. Upload your entire book via PDF and let our system organize it for you automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* THE FUTURE SECTION */}
      <div className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500">
            <MdAttachMoney size={28} />
          </div>
          <h2 className="text-3xl font-bold text-white">Future Updates & Subscriptions</h2>
        </div>
        
        <div className="bg-gradient-to-br from-[#1f1f1f] to-yellow-900/10 border border-yellow-500/30 p-8 rounded-2xl">
          <h3 className="text-2xl font-bold text-white mb-4">Support the Ecosystem</h3>
          <p className="text-gray-300 leading-relaxed mb-6">
            Amazing Humans is currently completely free. In the future, we will introduce specialized subscription tiers to help support the platform and reward our best authors:
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="text-yellow-500 mt-1">★</div>
              <div>
                <strong className="text-white">Reader Tier:</strong> An ad-free reading experience, early access to new chapters, and exclusive community badges.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="text-yellow-500 mt-1">★</div>
              <div>
                <strong className="text-white">Author Tier:</strong> Advanced dashboard analytics, priority placement in discovery algorithms, and advanced tools for interactive storytelling.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* CALL TO ACTION */}
      <div className="bg-gradient-to-br from-primary/20 to-purple-900/20 rounded-3xl p-12 border border-white/10 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">Ready to start?</h3>
          <p className="text-gray-300 mb-8 text-lg">Join thousands of readers and writers today.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/login" className="btn-primary py-4 px-8 text-lg shadow-xl shadow-primary/20 w-full sm:w-auto">Create Free Account</Link>
              <Link to="/" className="bg-[#2a2a2a] hover:bg-[#333] text-white py-4 px-8 rounded-lg font-bold transition w-full sm:w-auto border border-white/5">Browse Library First</Link>
          </div>
      </div>

    </div>
  );
}