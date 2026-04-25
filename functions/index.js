const { onDocumentWritten, onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// ======================================================
// 1. ANALYTICS & SISTEMA (ANTIGOS RESTAURADOS)
// ======================================================

exports.registerReading = onCall({ cors: true }, async (request) => {
    if (!request.auth) return { success: false };
    const { obraId, capituloId } = request.data;
    const uid = request.auth.uid;
    const viewRef = db.collection('visualizacoes_capitulos').doc(`${uid}_${capituloId}`);

    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(viewRef);
            if (doc.exists()) return;

            t.set(viewRef, { userId: uid, obraId, capituloId, data: FieldValue.serverTimestamp() });
            t.update(db.collection('obras').doc(obraId), { views: FieldValue.increment(1) });
            t.update(db.collection('usuarios').doc(uid), { contador_leituras: FieldValue.increment(1) });
        });
        return { success: true };
    } catch (e) { return { success: false }; }
});

exports.updateBookRating = onDocumentWritten("avaliacoes/{docId}", async (event) => {
    const data = event.data?.after?.data();
    if (!data) return;
    const snapshot = await db.collection("avaliacoes").where("obraId", "==", data.obraId).get();
    let soma = 0, total = 0;
    snapshot.forEach(d => { soma += d.data().rating; total++; });
    return db.collection("obras").doc(data.obraId).update({ rating: total ? soma / total : 0, votes: total });
});

exports.grantFounderBadge = onDocumentCreated("obras/{obraId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const autorId = data.autorId;
    if (!autorId) return;

    const statsRef = db.collection('stats').doc('authors_counter');
    await db.runTransaction(async (t) => {
        const stats = await t.get(statsRef);
        const count = stats.exists ? stats.data().count : 0;
        if (count >= 100) return;
        const userRef = db.collection('usuarios').doc(autorId);
        const user = await t.get(userRef);
        if (user.data().badges?.includes('pioneer')) return;
        t.set(statsRef, { count: count + 1 }, { merge: true });
        t.update(userRef, { badges: FieldValue.arrayUnion('pioneer') });
    });
});

exports.manageFollowers = onDocumentWritten("seguidores/{docId}", async (event) => {
    if (!event.data.after.exists && !event.data.before.exists) return;
    const isNew = !event.data.before.exists;
    const data = isNew ? event.data.after.data() : event.data.before.data();
    const val = isNew ? 1 : -1;

    const b = db.batch();
    b.update(db.collection('usuarios').doc(data.followedId), { followersCount: FieldValue.increment(val) });
    b.update(db.collection('usuarios').doc(data.followerId), { followingCount: FieldValue.increment(val) });
    await b.commit();
});

exports.notifyNewChapter = onDocumentCreated("capitulos/{capituloId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const navData = snapshot.data();
    const autorId = navData.autorId;
    const nomeObra = navData.nomeObra;
    const tituloCap = navData.titulo;
    const autorNome = navData.autor;

    if (!autorId) return;

    const seguidoresRef = db.collection('seguidores');

    const q = seguidoresRef.where('followedId', '==', autorId);
    const followersSnap = await q.get();

    if (followersSnap.empty) return;

    const notificationsBatch = [];
    followersSnap.forEach(docSeguidor => {
        const seguidorData = docSeguidor.data();
        notificationsBatch.push({
            paraId: seguidorData.followerId, // Atenção: Verifique se no seu banco é 'seguidorId' ou 'followerId'
            mensagem: `<strong>${autorNome}</strong> updated "${nomeObra}": ${tituloCap}`,
            tipo: 'chapter',
            linkDestino: `/ler/${snapshot.id}`,
            lida: false,
            data: FieldValue.serverTimestamp()
        });
    });

    const chunkSize = 500;
    for (let i = 0; i < notificationsBatch.length; i += chunkSize) {
        const chunk = notificationsBatch.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach(notif => {
            const newRef = db.collection('notificacoes').doc();
            batch.set(newRef, notif);
        });
        await batch.commit();
    }
});

// ======================================================
// 2. BUSCA INTELIGENTE (RESTAURADO)
// ======================================================
const createSearchTokens = (text) => {
    if (!text) return [];
    const words = text.toLowerCase().split(/[^\w\d\p{L}]+/u);
    const uniqueTokens = new Set();
    words.forEach(word => {
        if (word.length < 2) return;
        for (let i = 2; i <= word.length; i++) {
            uniqueTokens.add(word.substring(0, i));
        }
    });
    return Array.from(uniqueTokens);
};

exports.indexStoryForSearch = onDocumentWritten("obras/{obraId}", async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    const data = after.data();
    const previousData = event.data?.before?.data() || {};

    if (data.titulo === previousData.titulo && data.searchKeywords) return;

    const tokens = createSearchTokens(data.titulo);
    return after.ref.update({
        searchKeywords: tokens,
        tituloBusca: data.titulo.toLowerCase()
    });
});

// ======================================================
// 3. PAGAMENTOS STRIPE (NOVOS)
// ======================================================

exports.createStripeCheckout = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { type, packId } = request.data;
    const uid = request.auth.uid;
    const email = request.auth.token.email;

    // Em produção, use process.env.STRIPE_SECRET_KEY
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // MUDAR PARA SEU DOMÍNIO EM PRODUÇÃO (ex: https://amazing-humans.web.app)
    const domain = "https://amazinghumans-ae0f3.web.app";
    // Se estiver testando local: const domain = "http://localhost:5173";

    const successUrl = `${domain}/dashboard?payment=success`;
    const cancelUrl = `${domain}/subscription?payment=cancelled`;

    let sessionData = {
        payment_method_types: ['card'],
        customer_email: email,
        client_reference_id: uid,
        metadata: { userId: uid, type },
        success_url: successUrl,
        cancel_url: cancelUrl,
    };

    if (type === 'subscription') {
        sessionData.mode = 'subscription';

        // --- ATENÇÃO: COLOQUE SEUS IDs DO STRIPE AQUI ---
        // Exemplo:
        // if (packId.includes('reader')) priceId = "price_1P5...";

        // Verificação de Autor
        if (packId.includes('author')) {
            const worksRef = db.collection('obras');
            const q = worksRef.where('autorId', '==', uid).where('totalChapters', '>=', 10);
            const snap = await q.count().get();
            if (snap.data().count < 1) {
                throw new HttpsError('failed-precondition', 'requirements not met: need 1 book with 10+ chapters');
            }
            sessionData.metadata.subTier = 'author';
        } else {
            sessionData.metadata.subTier = 'reader';
        }

        // MOCK PARA NÃO QUEBRAR O DEPLOY SE NÃO TIVER ID
        // Remova esse IF e coloque o priceId real no line_items
        if (!process.env.STRIPE_SECRET_KEY) {
            return { url: `${domain}/dashboard?mock_success=true` };
        }
    }

    try {
        const session = await stripe.checkout.sessions.create(sessionData);
        return { url: session.url };
    } catch (error) {
        console.error("Stripe Error:", error);
        return { url: `${domain}/dashboard?error=stripe_error` };
    }
});

exports.stripeWebhook = onRequest(async (request, response) => {
    const sig = request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(request.rawBody, sig, endpointSecret);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (type === 'subscription') {
            let updateData = {
                subscriptionStatus: 'active',
                subscriptionType: subTier,
                stripeSubId: session.subscription
            };
            if (subTier === 'author') {
                const userDoc = await db.collection('usuarios').doc(userId).get();
                if (!userDoc.data().referralCode) {
                    updateData.referralCode = `REF-${userId.substring(0, 5).toUpperCase()}`;
                }
            }
            await db.collection('usuarios').doc(userId).update(updateData);
        }
    }
    response.json({ received: true });
});

// ======================================================
// 4. SISTEMA DE INDICAÇÃO (REFERRAL)
// ======================================================

// Garante que todo usuário novo tenha um código de convite
exports.onUserCreate = onDocumentCreated("usuarios/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (data.referralCode) return; // Já tem código

    const userId = event.params.userId;
    const code = `REF-${userId.substring(0, 5).toUpperCase()}${Math.floor(Math.random() * 1000)}`;

    return snapshot.ref.update({
        referralCode: code,
        referralCount: 0,
        // Inicialização Segura de dados sensíveis
        coins: 0,
        subscriptionType: 'free',
        subscriptionStatus: 'inactive'
    });
});

// Resgata um código de convite
exports.redeemReferralCode = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { code } = request.data;
    const uid = request.auth.uid;

    if (!code) throw new HttpsError('invalid-argument', 'Code is required.');

    // 1. Verificar se o código existe e pegar o dono
    const usersRef = db.collection('usuarios');
    const q = usersRef.where('referralCode', '==', code).limit(1);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
        throw new HttpsError('not-found', 'Invalid referral code.');
    }

    const referrerDoc = querySnapshot.docs[0];
    const referrerData = referrerDoc.data();
    const referrerId = referrerDoc.id;

    // 2. Validações
    if (referrerId === uid) {
        throw new HttpsError('invalid-argument', 'You cannot refer yourself.');
    }

    const userRef = usersRef.doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.data().referredBy) {
        throw new HttpsError('already-exists', 'You have already been referred.');
    }

    const newCount = (referrerData.referralCount || 0) + 1;
    let isAuthorQualified = false;

    if (newCount === 15) {
        const worksRef = db.collection('obras');
        const qWorks = worksRef.where('autorId', '==', referrerId).where('totalChapters', '>=', 10);
        const snapWorks = await qWorks.limit(1).get();
        if (!snapWorks.empty) {
            isAuthorQualified = true;
        }
    }

    // 3. Processar a indicação
    await db.runTransaction(async (t) => {
        // Marca quem foi indicado
        t.update(userRef, {
            referredBy: referrerId,
            referredAt: FieldValue.serverTimestamp()
        });

        // Incrementa contador do indicador e verifica recompensa
        let referrerUpdates = {
            referralCount: FieldValue.increment(1)
        };

        // Regra de Ouro: 15 Indicações = 1 Mês Grátis (Reader ou Author Tier)
        if (newCount === 15) {
            // Adiciona 30 dias à data atual
            const now = new Date();
            const expiresAt = new Date(now.setDate(now.getDate() + 30));

            const tierAssigned = isAuthorQualified ? 'author' : 'reader';
            const tierName = isAuthorQualified ? 'Author' : 'Reader';

            referrerUpdates.subscriptionType = tierAssigned;
            referrerUpdates.subscriptionStatus = 'active';
            referrerUpdates.subscriptionExpiresAt = Timestamp.fromDate(expiresAt);

            // Opcional: Notificar o usuário que ele ganhou (poderia criar uma notificação aqui)
            const notifRef = db.collection('notificacoes').doc();
            t.set(notifRef, {
                paraId: referrerId,
                mensagem: `<strong>Congratulations!</strong> You reached 15 referrals and won 1 Month of ${tierName} Tier!`,
                tipo: 'system',
                lida: false,
                data: FieldValue.serverTimestamp()
            });
        }

        t.update(referrerDoc.ref, referrerUpdates);
    });

    return { success: true, referrerName: referrerData.nome };
});

// ======================================================
// 5. PROPAGAÇÃO DE DADOS DE USUÁRIO (NOVO)
// ======================================================

exports.onUserUpdate = onDocumentUpdated("usuarios/{userId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Verifica se houve mudança em Nome ou Foto
    if (before.nome === after.nome && before.avatar === after.avatar) return;

    const userId = event.params.userId;
    const novoNome = after.nome;
    const novaFoto = after.avatar;

    const batch = db.batch();
    let batchCount = 0;

    // 1. Atualizar Obras
    const obrasSnap = await db.collection('obras').where('autorId', '==', userId).get();
    obrasSnap.forEach(doc => {
        batch.update(doc.ref, { autor: novoNome });
        batchCount++;
    });

    // 2. Atualizar Capítulos
    const capsSnap = await db.collection('capitulos').where('autorId', '==', userId).get();
    capsSnap.forEach(doc => {
        batch.update(doc.ref, { autor: novoNome });
        batchCount++;
    });

    // 3. Atualizar Comentários (Nome e Foto)
    const commentsSnap = await db.collection('comentarios').where('autorId', '==', userId).get();
    commentsSnap.forEach(doc => {
        batch.update(doc.ref, {
            autorNome: novoNome,
            autorFoto: novaFoto
        });
        batchCount++;
    });

    // Limite de 500 writes por batch (simplificado, em prod usar paginação se muitos docs)
    if (batchCount > 0) {
        await batch.commit();
        logger.log(`Propagated user profile update for ${userId} to ${batchCount} documents.`);
    }
});

// ======================================================
// 6. EXCLUSÃO DE CONTA DO USUÁRIO
// ======================================================

exports.deleteUserAccount = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    
    const uid = request.auth.uid;
    const { getAuth } = require("firebase-admin/auth");

    const batchDelete = async (query) => {
        const snap = await query.get();
        if (snap.empty) return;
        
        const batches = [];
        let batch = db.batch();
        let count = 0;
        
        snap.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            if (count === 500) {
                batches.push(batch.commit());
                batch = db.batch();
                count = 0;
            }
        });
        if (count > 0) batches.push(batch.commit());
        await Promise.all(batches);
    };

    try {
        logger.log(`Starting account deletion for user: ${uid}`);

        // 1. Deletar as obras do usuário e tudo dentro delas (capítulos, avaliações, visualizações)
        const obrasSnap = await db.collection('obras').where('autorId', '==', uid).get();
        for (const doc of obrasSnap.docs) {
            await batchDelete(db.collection('capitulos').where('obraId', '==', doc.id));
            await batchDelete(db.collection('avaliacoes').where('obraId', '==', doc.id));
            await batchDelete(db.collection('visualizacoes_capitulos').where('obraId', '==', doc.id));
            await doc.ref.delete();
        }

        // 2. Deletar interações do usuário no site
        await batchDelete(db.collection('comentarios').where('autorId', '==', uid));
        await batchDelete(db.collection('avaliacoes').where('userId', '==', uid));
        await batchDelete(db.collection('biblioteca').where('userId', '==', uid));
        await batchDelete(db.collection('historico').where('userId', '==', uid));
        await batchDelete(db.collection('notificacoes').where('paraId', '==', uid));
        
        // Seguidores
        await batchDelete(db.collection('seguidores').where('followerId', '==', uid));
        await batchDelete(db.collection('seguidores').where('followedId', '==', uid));
        
        // 3. Deletar documento na coleção 'usuarios'
        await db.collection('usuarios').doc(uid).delete();

        // 4. Deletar usuário do Firebase Auth
        await getAuth().deleteUser(uid);
        
        logger.log(`Account ${uid} deleted successfully.`);
        return { success: true };
    } catch (error) {
        logger.error(`Error deleting user ${uid}:`, error);
        throw new HttpsError('internal', 'Error deleting user account.', error.message);
    }
});

// ======================================================
// 7. EMAIL OTP VERIFICATION
// ======================================================

exports.sendVerificationOTP = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    
    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const { getAuth } = require("firebase-admin/auth");
    
    const userRecord = await getAuth().getUser(uid);
    if (userRecord.emailVerified) {
        throw new HttpsError('failed-precondition', 'Email is already verified.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    await db.collection('verificationCodes').doc(uid).set({
        code: otp,
        email: email,
        expiresAt: Timestamp.fromDate(expiresAt),
        attempts: 0
    });

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: `Amazing Humans <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Your Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center; border: 1px solid #eaeaea; border-radius: 10px;">
                <h2 style="color: #333;">Welcome to Amazing Humans!</h2>
                <p style="color: #555; font-size: 16px;">Use the 6-digit code below to verify your email address. This code expires in 15 minutes.</p>
                <div style="background-color: #f4f4f4; padding: 15px; font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; color: #111;">
                    ${otp}
                </div>
                <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        logger.error("Error sending OTP email:", error);
        throw new HttpsError('internal', 'Error sending email.');
    }
});

exports.verifyOTP = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    
    const uid = request.auth.uid;
    const { code } = request.data;
    
    if (!code) throw new HttpsError('invalid-argument', 'Code is required.');

    const docRef = db.collection('verificationCodes').doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists()) {
        throw new HttpsError('not-found', 'No verification code found. Please request a new one.');
    }

    const data = docSnap.data();

    if (data.attempts >= 5) {
        throw new HttpsError('resource-exhausted', 'Too many failed attempts. Request a new code.');
    }

    if (data.expiresAt.toDate() < new Date()) {
        throw new HttpsError('failed-precondition', 'Verification code has expired. Request a new one.');
    }

    if (data.code !== code) {
        await docRef.update({ attempts: FieldValue.increment(1) });
        throw new HttpsError('invalid-argument', 'Incorrect code.');
    }

    const { getAuth } = require("firebase-admin/auth");
    await getAuth().updateUser(uid, { emailVerified: true });

    await docRef.delete();

    return { success: true };
});

