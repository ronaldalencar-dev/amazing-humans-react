import React, { createContext, useState, useEffect } from 'react';
import { auth, provider, db } from '../services/firebaseConnection';
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const VerifyEmailModal = ({ firebaseUser, auth }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const verifyOTP = httpsCallable(getFunctions(), 'verifyOTP');
      await verifyOTP({ code });
      toast.success("Email verified successfully!");
      await firebaseUser.reload();
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };
  
  const handleResend = async () => {
    try {
      const sendVerificationOTP = httpsCallable(getFunctions(), 'sendVerificationOTP');
      await sendVerificationOTP();
      toast.success("New code sent!");
    } catch(err) {
       toast.error("Error sending code.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-zinc-800 p-8 rounded-2xl max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
        <p className="text-zinc-400 text-sm mb-6">We've sent a 6-digit code to <strong>{firebaseUser.email}</strong></p>
        <input 
          type="text" 
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full bg-[#27272a] text-white text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          placeholder="000000"
        />
        <button 
          onClick={handleVerify} 
          disabled={loading || code.length !== 6}
          className="w-full bg-zinc-200 text-black font-bold py-3 rounded-xl hover:bg-white disabled:opacity-50 mb-4 transition-all"
        >
          {loading ? "Verifying..." : "Verify Code"}
        </button>
        <button onClick={handleResend} className="text-zinc-400 text-sm hover:text-white transition-colors">Resend Code</button>
        <button onClick={() => signOut(auth)} className="block w-full mt-6 text-red-400 text-sm hover:text-red-300 transition-colors">Logout</button>
      </div>
    </div>
  );
};

export const AuthContext = createContext({});

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

function generateAvatar(seed) {
  const safeSeed = encodeURIComponent(seed || 'default');
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [firebaseUserObject, setFirebaseUserObject] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        
        // --- VERIFICAÇÃO DE EMAIL ---
        if (!firebaseUser.emailVerified && firebaseUser.providerData.some(p => p.providerId === 'password')) {
          setFirebaseUserObject(firebaseUser);
          setUser({ isPendingVerification: true });
          setLoadingAuth(false);
          return;
        } else {
          setFirebaseUserObject(null);
        }

        const uid = firebaseUser.uid;

        const unsubscribeFirestore = onSnapshot(doc(db, "usuarios", uid), async (docSnap) => {
          if (docSnap.exists()) {
            const dados = docSnap.data();

            if (dados.banned === true) {
              toast.error("This account has been suspended.");
              await signOut(auth);
              setUser(null);
              setLoadingAuth(false);
              return;
            }

            const avatarFinal = dados.foto || generateAvatar(uid);

            setUser({
              uid: uid,
              name: dados.nome || firebaseUser.displayName,
              avatar: avatarFinal,
              cover: dados.capa || null,
              bio: dados.bio || '',
              email: firebaseUser.email,
              role: dados.role || 'user',

              // --- NOVOS CAMPOS DE ECONOMIA ---
              coins: dados.coins || 0,
              subscriptionType: 'author', // Force author for free premium
              subscriptionStatus: dados.subscriptionStatus || 'inactive', // 'active', 'past_due'
              referralCode: dados.referralCode || '',
              // Campos referrals
              referralCount: dados.referralCount || 0,
              referredBy: dados.referredBy || null,

              // Mantendo compatibilidade com código antigo
              badges: dados.badges || [],
              followersCount: dados.followersCount || 0,
              leituras: dados.contador_leituras || 0,
              website: dados.website || '', twitter: dados.twitter || '', instagram: dados.instagram || '',
              patreon: dados.patreon || '', paypal: dados.paypal || ''
            });
          } else {
            // Usuário novo
            setUser({
              uid: uid,
              name: firebaseUser.displayName || "Loading...",
              avatar: generateAvatar(uid),
              bio: '',
              email: firebaseUser.email,
              role: 'user',
              coins: 0,
              subscriptionType: 'author', // Override Default
              subscriptionStatus: 'inactive'
            });
          }
          setLoadingAuth(false);
        });
        return () => unsubscribeFirestore();
      } else {
        setUser(null);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  async function signInGoogle(inviteCode) {
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const uid = result.user.uid;
        const userRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Criar novo usuário se não existir
          // REMOVED: coins, subscriptionType, subscriptionStatus (initialized server-side)
          await setDoc(userRef, {
            uid: uid,
            nome: result.user.displayName,
            email: result.user.email,
            createdAt: new Date(),
            avatar: generateAvatar(uid)
          });
        }
        // Se já existir, NÃO atualizamos o nome para não sobrescrever customizações do usuário

        // Tentar aplicar código de convite se houver
        if (inviteCode) {
          const functions = getFunctions();
          const redeemReferralCode = httpsCallable(functions, 'redeemReferralCode');
          redeemReferralCode({ code: inviteCode })
            .then((res) => toast.success(`Referred by ${res.data.referrerName}!`))
            .catch((err) => {
              console.error("Referral Error:", err);
              // Não exibe erro se for "already exists" silenciosamente ou warning
              if (!err.message.includes("already")) toast.error("Invalid invite code, but you are logged in.");
            });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Error logging in");
    }
  }

  async function registerEmail(name, email, password, inviteCode) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      if (result.user) {
        const uid = result.user.uid;
        const userRef = doc(db, "usuarios", uid);
        
        await setDoc(userRef, {
          uid: uid,
          nome: name,
          email: email,
          createdAt: new Date(),
          avatar: generateAvatar(uid),
          // Defaults are handled inside the listener but we can set them here to be safe
          coins: 0,
          role: 'user',
          subscriptionType: 'author', // Force premium
          subscriptionStatus: 'inactive'
        });

        if (inviteCode) {
          try {
            const functions = getFunctions();
            const redeemReferralCode = httpsCallable(functions, 'redeemReferralCode');
            const res = await redeemReferralCode({ code: inviteCode });
            toast.success(`Referred by ${res.data.referrerName}!`);
          } catch (err) {
            console.error("Referral Error:", err);
            if (!err.message.includes("already")) toast.error("Invalid invite code, but you are registered.");
          }
        }

        // --- ENVIAR EMAIL DE VERIFICAÇÃO COM CÓDIGO (OTP) ---
        const sendVerificationOTP = httpsCallable(getFunctions(), 'sendVerificationOTP');
        await sendVerificationOTP();
        toast.success("Account created! We've sent a 6-digit code to your email.", { duration: 6000 });
        
        // Mantemos o usuário logado para que ele veja a tela de inserir o código OTP.

      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("This email already exists. If you used Google to sign in before, you need to use the Google button again.", { duration: 5000 });
      } else if (error.code === 'auth/weak-password') {
        toast.error("Password must be at least 6 characters.");
      } else {
        toast.error("Error creating account.");
      }
    }
  }

  async function loginEmail(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error("Incorrect email or password.");
      } else {
        toast.error("Error logging in.");
      }
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  const isAdmin = React.useCallback(() => user?.role === 'admin', [user]);

  // --- LÓGICA ATUALIZADA DE ANÚNCIOS ---
  const hasAds = React.useCallback(() => {
    if (!user) return true;
    // Se a assinatura estiver ativa (seja leitor ou autor), remove anúncios
    if (user.subscriptionStatus === 'active') return false;

    // Regra antiga de nível (opcional, pode manter ou tirar)
    const currentLevel = Math.floor((user.leituras || 0) / 20) + 1;
    if (currentLevel >= 100) return false;

    return true;
  }, [user]);

  if (user?.isPendingVerification && firebaseUserObject) {
    return <VerifyEmailModal firebaseUser={firebaseUserObject} auth={auth} />;
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, signInGoogle, registerEmail, loginEmail, logout, loadingAuth, isAdmin, hasAds }}>
      {children}
    </AuthContext.Provider>
  );
}