"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  Upload,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Loader2,
  KeyRound,
  Search,
  Lock,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot } from "firebase/firestore";

const PACKS = [
  { id: "ff-100", game: "Free Fire", title: "100 + 10 Diamants", price: 4.5, badge: "Populaire" },
  { id: "ff-310", game: "Free Fire", title: "310 + 31 Diamants", price: 13.0 },
  { id: "ff-520", game: "Free Fire", title: "520 + 52 Diamants", price: 21.5, badge: "Meilleur choix" },
  { id: "ef-1040", game: "eFootball", title: "1040 Coins", price: 34.0 },
  { id: "ef-2130", game: "eFootball", title: "2130 Coins", price: 65.0 },
];

interface TrackedOrder {
  id: string;
  orderNumber: string;
  game: string;
  packTitle: string;
  status: string;
  verificationCode?: string;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export default function GenShopOrderPage() {
  const [selectedGame, setSelectedGame] = useState<"Free Fire" | "eFootball">("Free Fire");
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

  // Champs Free Fire
  const [playerId, setPlayerId] = useState("");

  // Champs eFootball (Login + Code de vérification)
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // Champs communs
  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"D17" | "Flouci" | "Recharge">("D17");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedDocId, setSubmittedDocId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<TrackedOrder | null>(null);

  // Suivi manuel par code GEN-XXXX
  const [trackCodeInput, setTrackCodeInput] = useState("");
  const [trackedDocId, setTrackedDocId] = useState<string | null>(null);

  const filteredPacks = PACKS.filter((p) => p.game === selectedGame);

  // Écoute en temps réel la commande courante (après création ou recherche)
  const activeDocId = submittedDocId || trackedDocId;
  useEffect(() => {
    if (!activeDocId) return;
    const unsub = onSnapshot(doc(db, "orders", activeDocId), (snap) => {
      if (snap.exists()) {
        setLiveOrder({ id: snap.id, ...snap.data() } as TrackedOrder);
      }
    });
    return () => unsub();
  }, [activeDocId]);

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackCodeInput.trim().toUpperCase();
    if (!clean) return;
    const unsub = onSnapshot(collection(db, "orders"), (snapshot) => {
      const found = snapshot.docs.find((d) => d.data().orderNumber === clean);
      if (found) {
        setTrackedDocId(found.id);
        setOrderNumber(clean);
      } else {
        alert("Aucune commande trouvée avec ce numéro.");
      }
      unsub();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp || !receiptFile) {
      alert("Veuillez renseigner votre numéro WhatsApp et ajouter la capture du reçu.");
      return;
    }
    if (selectedGame === "Free Fire" && !playerId.trim()) {
      alert("Veuillez saisir votre ID Joueur Free Fire.");
      return;
    }
    if (selectedGame === "eFootball" && (!accountEmail.trim() || !accountPassword.trim())) {
      alert("Veuillez saisir l'identifiant/e-mail et le mot de passe du compte eFootball.");
      return;
    }

    setLoading(true);
    try {
      const receiptUrl = await compressImage(receiptFile);
      const generatedCode = `GEN-${Math.floor(1000 + Math.random() * 9000)}`;

      const docRef = await addDoc(collection(db, "orders"), {
        orderNumber: generatedCode,
        game: selectedGame,
        packTitle: selectedPack.title,
        priceTND: selectedPack.price,
        playerId: selectedGame === "Free Fire" ? playerId.trim() : "",
        accountEmail: selectedGame === "eFootball" ? accountEmail.trim() : "",
        accountPassword: selectedGame === "eFootball" ? accountPassword : "",
        verificationCode: "",
        whatsapp: whatsapp.trim(),
        paymentMethod,
        receiptUrl,
        status: selectedGame === "eFootball" ? "en_attente_connexion" : "en_attente",
        createdAt: serverTimestamp(),
      });

      setSubmittedDocId(docRef.id);
      setOrderNumber(generatedCode);
    } catch (error) {
      console.error("Erreur lors de la commande :", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveOrder || !otpInput.trim()) return;
    setSendingOtp(true);
    try {
      await updateDoc(doc(db, "orders", liveOrder.id), {
        verificationCode: otpInput.trim(),
        status: "code_recu",
      });
      setOtpInput("");
    } catch {
      alert("Impossible d'envoyer le code pour le moment.");
    } finally {
      setSendingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white font-sans">
      <header className="border-b border-slate-800 bg-[#0D1322]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black text-lg">
              G
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              GenShop <span className="text-cyan-400">TN</span>
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs sm:text-sm text-emerald-400">
            <Zap className="w-4 h-4" /> Livraison rapide
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-blue-900/40 via-[#131B2E] to-cyan-900/30 border border-blue-500/20 rounded-2xl p-6 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            La nouvelle génération de recharge gaming en Tunisie
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Diamants Free Fire par ID et Coins eFootball avec confirmation de code de vérification en direct.
          </p>
        </div>

        {/* Barre rapide pour retrouver une commande eFootball & envoyer son code OTP */}
        <form onSubmit={handleTrackSearch} className="bg-[#131B2E] border border-slate-800 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#090D16] border border-slate-700 rounded-xl px-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Déjà commandé ? Entre ton code (ex: GEN-4821) pour envoyer le code de vérification"
              value={trackCodeInput}
              onChange={(e) => setTrackCodeInput(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm text-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition"
          >
            Suivre / Code OTP
          </button>
        </form>

        {/* Sélecteur de Jeu */}
        <div className="flex gap-3 mb-8">
          {(["Free Fire", "eFootball"] as const).map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => {
                setSelectedGame(game);
                const firstPack = PACKS.find((p) => p.game === game);
                if (firstPack) setSelectedPack(firstPack);
              }}
              className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition border ${
                selectedGame === game
                  ? "bg-blue-600 border-cyan-400 text-white shadow-lg shadow-blue-600/20"
                  : "bg-[#131B2E] border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {game}
            </button>
          ))}
        </div>

        {liveOrder && orderNumber ? (
          <div className="bg-[#131B2E] border border-cyan-500/30 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-2xl font-bold mb-1">Commande {orderNumber}</h2>
              <p className="text-slate-400 text-sm">
                {liveOrder.game} • <strong className="text-white">{liveOrder.packTitle}</strong> • Statut :{" "}
                <span className="text-cyan-400 font-bold">{liveOrder.status}</span>
              </p>
            </div>

            {/* Bloc spécial eFootball : saisie du code de vérification demandé après login */}
            {liveOrder.game === "eFootball" && liveOrder.status !== "livree" && liveOrder.status !== "rejetee" && (
              <div className="bg-[#090D16] border border-amber-500/40 rounded-xl p-5">
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                  <KeyRound className="w-5 h-5" />
                  <span>Code de vérification eFootball</span>
                </div>

                {liveOrder.status === "attente_code_client" ? (
                  <p className="text-sm text-slate-300 mb-4">
                    La connexion est lancée sur ton compte. Entre ici le <strong>code de vérification</strong> reçu par e-mail/application :
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 mb-4">
                    Dès que l&apos;administrateur lance la connexion sur ton compte, tu pourras envoyer ici le code de vérification (ou le soumettre dès réception).
                  </p>
                )}

                {liveOrder.verificationCode ? (
                  <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-lg p-3 text-sm text-emerald-300">
                    Code transmis : <strong className="font-mono text-base">{liveOrder.verificationCode}</strong> (traitement en cours).
                  </div>
                ) : (
                  <form onSubmit={handleSendOtp} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Ex: 123456"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      className="flex-1 bg-[#131B2E] border border-slate-700 rounded-xl px-4 py-3 font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={sendingOtp}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-6 py-3 rounded-xl transition"
                    >
                      {sendingOtp ? "Envoi..." : "Envoyer le code"}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => {
                  setSubmittedDocId(null);
                  setTrackedDocId(null);
                  setOrderNumber(null);
                  setLiveOrder(null);
                  setReceiptFile(null);
                }}
                className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl font-semibold transition"
              >
                Nouvelle commande
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Étape 1 : Infos selon le jeu */}
            <section className="bg-[#131B2E] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-sm font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-bold">Informations du compte ({selectedGame})</h2>
              </div>

              {selectedGame === "Free Fire" ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">ID Joueur (Player ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 123456789"
                      value={playerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                      className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Numéro WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: 22 123 456"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">E-mail / ID de connexion eFootball</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: joueur@email.com"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" /> Mot de passe du compte
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Mot de passe de connexion"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Numéro WhatsApp (pour alerte code de vérification)</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: 22 123 456"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    Après validation, le code de vérification te sera demandé dès le lancement de la connexion.
                  </p>
                </div>
              )}
            </section>

            {/* Étape 2 : Choix du Pack */}
            <section className="bg-[#131B2E] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-sm font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg font-bold">Choisir le montant</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {filteredPacks.map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack)}
                    className={`cursor-pointer rounded-xl p-4 border transition relative ${
                      selectedPack.id === pack.id
                        ? "bg-blue-600/15 border-cyan-400"
                        : "bg-[#090D16] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {pack.badge && (
                      <span className="absolute -top-2.5 right-3 bg-amber-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        {pack.badge}
                      </span>
                    )}
                    <div className="font-bold text-base mb-1">{pack.title}</div>
                    <div className="text-cyan-400 font-extrabold text-lg">{pack.price.toFixed(2)} TND</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Étape 3 : Paiement */}
            <section className="bg-[#131B2E] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-sm font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-lg font-bold">Méthode de paiement & Preuve</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {(["D17", "Flouci", "Recharge"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-3 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      paymentMethod === method
                        ? "bg-cyan-500/15 border-cyan-400 text-cyan-300"
                        : "bg-[#090D16] border-slate-800 text-slate-400"
                    }`}
                  >
                    {method === "Recharge" ? <Smartphone className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    {method}
                  </button>
                ))}
              </div>

              <div className="bg-[#090D16] border border-slate-800 rounded-xl p-4 mb-5 text-sm text-slate-300">
                {paymentMethod === "D17" && (
                  <p>
                    Envoyez <strong className="text-cyan-400">{selectedPack.price.toFixed(2)} TND</strong> via{" "}
                    <strong>D17</strong> au numéro : <strong className="text-white">XX XXX XXX</strong> puis importez la capture ci-dessous.
                  </p>
                )}
                {paymentMethod === "Flouci" && (
                  <p>
                    Transférez <strong className="text-cyan-400">{selectedPack.price.toFixed(2)} TND</strong> via{" "}
                    <strong>Flouci</strong> au numéro : <strong className="text-white">XX XXX XXX</strong> puis importez la capture du reçu.
                  </p>
                )}
                {paymentMethod === "Recharge" && (
                  <p>
                    Envoyez une photo claire du ticket de recharge (TT / Ooredoo / Orange) de{" "}
                    <strong className="text-cyan-400">{Math.ceil(selectedPack.price)} TND</strong>.
                  </p>
                )}
              </div>

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-xl p-6 cursor-pointer transition bg-[#090D16]/50">
                <Upload className="w-8 h-8 text-cyan-400 mb-2" />
                <span className="text-sm font-medium text-slate-300">
                  {receiptFile ? receiptFile.name : "Cliquez pour importer la capture du reçu"}
                </span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </label>
            </section>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-extrabold py-4 rounded-xl text-lg shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" /> Valider ma commande ({selectedPack.price.toFixed(2)} TND)
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}