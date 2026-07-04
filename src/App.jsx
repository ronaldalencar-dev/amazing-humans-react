import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import WelcomeModal from './components/WelcomeModal';
import CacheProvider from './contexts/CacheContext';
import BottomNav from './components/BottomNav';

// --- IMPORTS DINÂMICOS ---
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Story = lazy(() => import('./pages/Story'));
const Read = lazy(() => import('./pages/Read'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Write = lazy(() => import('./pages/Write'));

const Profile = lazy(() => import('./pages/Profile'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const Library = lazy(() => import('./pages/Library'));
const History = lazy(() => import('./pages/History'));
const Notifications = lazy(() => import('./pages/Notifications'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Admin = lazy(() => import('./pages/Admin'));
const EditStory = lazy(() => import('./pages/EditStory'));
const EditChapter = lazy(() => import('./pages/EditChapter'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Settings = lazy(() => import('./pages/Settings'));
const WriteInteractiveStory = lazy(() => import('./pages/WriteInteractiveStory'));
const ReadInteractiveStory = lazy(() => import('./pages/ReadInteractiveStory'));
const Feedback = lazy(() => import('./pages/Feedback'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#121212]">
    <div className="w-10 h-10 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);
function App() {
  return (
    <AuthProvider>
      <CacheProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Header />
          <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', border: '1px solid #4a90e2' } }} />

          <main className="min-h-screen">
            <WelcomeModal />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/story/:id" element={<Story />} />
                <Route path="/read/:id" element={<Read />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/write" element={<Write />} />

                <Route path="/profile" element={<Profile />} />
                <Route path="/user/:id" element={<PublicProfile />} />
                <Route path="/library" element={<Library />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/edit-story/:id" element={<EditStory />} />
                <Route path="/edit-chapter/:id" element={<EditChapter />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/write-interactive-story" element={<WriteInteractiveStory />} />
                <Route path="/write-interactive-story/:id" element={<WriteInteractiveStory />} />
                <Route path="/interactive-story/:id" element={<ReadInteractiveStory />} />
                <Route path="/feedback" element={<Feedback />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <BottomNav />
        </BrowserRouter>
      </CacheProvider>
    </AuthProvider >
  );
}

export default App;