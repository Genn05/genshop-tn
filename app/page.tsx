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
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot } from "firebase/firestore";

type GameType = "Free Fire" | "eFootball" | "Netflix";

interface Pack {
  id: string;
  game: GameType;
  title: string;
  price: number;
  badge?: string;
}

const PACKS: Pack[] = [
  { id: "ff-100", game: "Free Fire", title: "100 + 10 Diamants", price: 4.5, badge: "Populaire" },
  { id: "ff-310", game: "Free Fire", title: "310 + 31 Diamants", price: 13.0 },
  { id: "ff-520", game: "Free Fire", title: "520 + 52 Diamants", price: 21.5, badge: "Meilleur choix" },
  { id: "ef-1040", game: "eFootball", title: "1040 Coins", price: 34.0, badge: "Populaire" },
  { id: "ef-2130", game: "eFootball", title: "2130 Coins", price: 65.0 },
  { id: "nf-1m", game: "Netflix", title: "1 Mois UHD (Profil Privé)", price: 14.0, badge: "Top vente" },
  { id: "nf-3m", game: "Netflix", title: "3 Mois UHD (Profil Privé)", price: 39.0 },
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
  const [selectedGame, setSelectedGame] = useState<GameType>("Free Fire");
  const [selectedPack, setSelectedPack] = useState<Pack>(PACKS[0]);

  const [playerId, setPlayerId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"D17" | "Flouci" | "Recharge">("D17");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedDocId, setSubmittedDocId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<TrackedOrder | null>(null);

  const [trackCodeInput, setTrackCodeInput] = useState("");
  const [trackedDocId, setTrackedDocId] = useState<string | null>(null);

  const filteredPacks = PACKS.filter((p) => p.game === selectedGame);

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
    if ((selectedGame === "eFootball" || selectedGame === "Netflix") && !accountEmail.trim()) {
      alert("Veuillez saisir votre e-mail ou identifiant de compte.");
      return;
    }
    if (selectedGame === "eFootball" && !accountPassword.trim()) {
      alert("Veuillez saisir le mot de passe du compte eFootball.");
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
        accountEmail: selectedGame !== "Free Fire" ? accountEmail.trim() : "",
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
    <div className="min-h-screen bg-[#060B17] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Header Premium Bleu Nuit & Or */}
      <header className="border-b border-amber-500/20 bg-[#0A1224]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="GEN SHOP Logo"
              className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
            />
            <div>
              <span className="text-xl font-extrabold tracking-wide text-amber-300 block leading-none">
                GEN SHOP
              </span>
              <span className="text-[11px] uppercase tracking-widest text-slate-400">
                Gaming &amp; Streaming TN
              </span>
            </div>
          </div>

          <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-3 py-1.5 rounded-full">
            <Zap className="w-4 h-4 text-amber-400" /> D17 &amp; Flouci Sécurisé
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Bannière Hero */}
        <div className="bg-gradient-to-br from-[#0E1A36] via-[#0B1326] to-[#171625] border border-amber-400/25 rounded-2xl p-6 sm:p-8 mb-6 shadow-xl shadow-black/40">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Recharge Rapide &amp; Fiable
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Free Fire, eFootball &amp; Netflix en Tunisie
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
            Commandez vos diamants, coins et abonnements en quelques minutes avec paiement simple via D17, Flouci ou recharge.
          </p>
        </div>

        {/* Suivi commande / Code OTP */}
        <form
          onSubmit={handleTrackSearch}
          className="bg-[#0D162B] border border-slate-800 hover:border-amber-500/30 transition rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 flex items-center gap-2 bg-[#060B17] border border-slate-700/80 rounded-xl px-3.5">
            <Search className="w-4 h-4 text-amber-400" />
            <input
              type="text"
              placeholder="Suivre une commande ou envoyer le code eFootball (ex: GEN-4821)"
              value={trackCodeInput}
              onChange={(e) => setTrackCodeInput(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-400/30 px-5 py-2.5 rounded-xl text-sm font-bold transition"
          >
            Suivre / Code OTP
          </button>
        </form>

        {/* Sélecteur de Catégorie */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {(["Free Fire", "eFootball", "Netflix"] as const).map((game) => {
            const active = selectedGame === game;
            return (
              <button
                key={game}
                type="button"
                onClick={() => {
                  setSelectedGame(game);
                  const firstPack = PACKS.find((p) => p.game === game);
                  if (firstPack) setSelectedPack(firstPack);
                }}
                className={`py-3.5 px-3 rounded-xl font-extrabold text-xs sm:text-base transition border ${
                  active
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-[#0D162B] border-slate-800 text-slate-300 hover:border-amber-500/40"
                }`}
              >
                {game}
              </button>
            );
          })}
        </div>

        {liveOrder && orderNumber ? (
          <div className="bg-[#0D162B] border border-amber-400/35 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-white mb-1">Commande {orderNumber}</h2>
              <p className="text-slate-400 text-sm">
                {liveOrder.game} • <strong className="text-amber-300">{liveOrder.packTitle}</strong> • Statut :{" "}
                <span className="text-amber-400 font-bold">{liveOrder.status}</span>
              </p>
            </div>

            {liveOrder.game === "eFootball" && liveOrder.status !== "livree" && liveOrder.status !== "rejetee" && (
              <div className="bg-[#060B17] border border-amber-400/40 rounded-xl p-5">
                <div className="flex items-center gap-2 text-amber-300 font-bold mb-2">
                  <KeyRound className="w-5 h-5" />
                  <span>Code de vérification eFootball</span>
                </div>

                <p className="text-sm text-slate-300 mb-4">
                  {liveOrder.status === "attente_code_client"
                    ? "La connexion est lancée sur ton compte. Saisis ici le code de vérification reçu :"
                    : "Dès que la connexion est lancée sur ton compte, envoie ici ton code de vérification :"}
                </p>

                {liveOrder.verificationCode ? (
                  <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-lg p-3 text-sm text-emerald-300">
                    Code transmis : <strong className="font-mono text-base">{liveOrder.verificationCode}</strong> (en cours de traitement).
                  </div>
                ) : (
                  <form onSubmit={handleSendOtp} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Ex: 123456"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      className="flex-1 bg-[#0D162B] border border-slate-700 rounded-xl px-4 py-3 font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={sendingOtp}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold px-6 py-3 rounded-xl transition"
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
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 hover:from-amber-400 hover:to-yellow-300 px-6 py-2.5 rounded-xl font-extrabold transition"
              >
                Nouvelle commande
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Étape 1 */}
            <section className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 text-sm font-black flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-bold text-white">Informations du compte ({selectedGame})</h2>
              </div>

              {selectedGame === "Free Fire" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">ID Joueur (Player ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 123456789"
                      value={playerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
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
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {selectedGame === "eFootball" && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">E-mail / ID eFootball</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: joueur@email.com"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-400" /> Mot de passe
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Mot de passe du compte"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Numéro WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: 22 123 456"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {selectedGame === "Netflix" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">E-mail ou Pseudo souhaité</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: client@email.com"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Numéro WhatsApp (envoi accès)</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: 22 123 456"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Étape 2 */}
            <section className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 text-sm font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg font-bold text-white">Choisir l&apos;offre</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {filteredPacks.map((pack) => {
                  const isSelected = selectedPack.id === pack.id;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPack(pack)}
                      className={`cursor-pointer rounded-xl p-4 border transition relative ${
                        isSelected
                          ? "bg-amber-400/15 border-amber-400 shadow-md shadow-amber-500/10"
                          : "bg-[#060B17] border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {pack.badge && (
                        <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          {pack.badge}
                        </span>
                      )}
                      <div className="font-bold text-base text-white mb-1">{pack.title}</div>
                      <div className="text-amber-300 font-extrabold text-lg">{pack.price.toFixed(2)} TND</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Étape 3 */}
            <section className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 text-sm font-black flex items-center justify-center">
                  3
                </span>
                <h2 className="text-lg font-bold text-white">Paiement &amp; Capture du reçu</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {(["D17", "Flouci", "Recharge"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-3 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      paymentMethod === method
                        ? "bg-amber-400/15 border-amber-400 text-amber-300"
                        : "bg-[#060B17] border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {method === "Recharge" ? <Smartphone className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    {method}
                  </button>
                ))}
              </div>

              <div className="bg-[#060B17] border border-amber-500/20 rounded-xl p-4 mb-5 text-sm text-slate-300">
                {paymentMethod === "D17" && (
                  <p>
                    Envoyez <strong className="text-amber-300">{selectedPack.price.toFixed(2)} TND</strong> via{" "}
                    <strong className="text-white">D17</strong> au numéro : <strong className="text-amber-300">XX XXX XXX</strong> puis ajoutez la capture.
                  </p>
                )}
                {paymentMethod === "Flouci" && (
                  <p>
                    Transférez <strong className="text-amber-300">{selectedPack.price.toFixed(2)} TND</strong> via{" "}
                    <strong className="text-white">Flouci</strong> au numéro : <strong className="text-amber-300">XX XXX XXX</strong> puis ajoutez la capture.
                  </p>
                )}
                {paymentMethod === "Recharge" && (
                  <p>
                    Envoyez une photo claire du ticket de recharge (TT / Ooredoo / Orange) de{" "}
                    <strong className="text-amber-300">{Math.ceil(selectedPack.price)} TND</strong>.
                  </p>
                )}
              </div>

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-xl p-6 cursor-pointer transition bg-[#060B17]/60">
                <Upload className="w-8 h-8 text-amber-400 mb-2" />
                <span className="text-sm font-medium text-slate-200">
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
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 text-slate-950 font-black py-4 rounded-xl text-lg shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
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