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
const Obra = lazy(() => import('./pages/Obra'));
const Ler = lazy(() => import('./pages/Ler'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Escrever = lazy(() => import('./pages/Escrever'));

const Perfil = lazy(() => import('./pages/Perfil'));
const PerfilPublico = lazy(() => import('./pages/PerfilPublico'));
const Biblioteca = lazy(() => import('./pages/Biblioteca'));
const Historico = lazy(() => import('./pages/Historico'));
const Notificacoes = lazy(() => import('./pages/Notificacoes'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Admin = lazy(() => import('./pages/Admin'));
const EditarObra = lazy(() => import('./pages/EditarObra'));
const EditarCapitulo = lazy(() => import('./pages/EditarCapitulo'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Manutencao = lazy(() => import('./pages/Manutencao'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Settings = lazy(() => import('./pages/Settings'));
const EscreverHistoriaInterativa = lazy(() => import('./pages/EscreverHistoriaInterativa'));
const LerHistoriaInterativa = lazy(() => import('./pages/LerHistoriaInterativa'));
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
                <Route path="/obra/:id" element={<Obra />} />
                <Route path="/ler/:id" element={<Ler />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/escrever" element={<Escrever />} />

                <Route path="/perfil" element={<Perfil />} />
                <Route path="/usuario/:id" element={<PerfilPublico />} />
                <Route path="/biblioteca" element={<Biblioteca />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/notificacoes" element={<Notificacoes />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/editar-obra/:id" element={<EditarObra />} />
                <Route path="/editar-capitulo/:id" element={<EditarCapitulo />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/escrever-historia-interativa" element={<EscreverHistoriaInterativa />} />
                <Route path="/escrever-historia-interativa/:id" element={<EscreverHistoriaInterativa />} />
                <Route path="/historia-interativa/:id" element={<LerHistoriaInterativa />} />
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