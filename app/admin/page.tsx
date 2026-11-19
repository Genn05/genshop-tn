"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Check, X, Copy, ExternalLink, LogOut, KeyRound, MessageCircle } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  game: string;
  packTitle: string;
  priceTND: number;
  playerId?: string;
  accountEmail?: string;
  accountPassword?: string;
  verificationCode?: string;
  whatsapp: string;
  paymentMethod: string;
  receiptUrl: string;
  status: string;
}

const buildWhatsAppUrl = (rawPhone: string, order: Order) => {
  const digitsOnly = rawPhone.replace(/\D/g, "");
  const formattedPhone =
    digitsOnly.startsWith("216")
      ? digitsOnly
      : digitsOnly.length === 8
      ? `216${digitsOnly}`
      : digitsOnly;

  const message =
    order.game === "eFootball"
      ? `Bonjour, c'est GenShop TN pour ta commande ${order.orderNumber} (${order.packTitle}). Je lance la connexion à ton compte eFootball : envoie-moi dès que possible le code de vérification reçu.`
      : `Bonjour, c'est GenShop TN pour ta commande ${order.orderNumber} (${order.packTitle}). Ton paiement est en cours de vérification.`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      setOrders(list);
    });
    return () => unsub();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      alert("Identifiants incorrects.");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#131B2E] border border-slate-800 p-8 rounded-2xl w-full max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-center">Admin — GenShop TN</h1>
          <input
            type="email"
            placeholder="E-mail admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-3"
            required
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold">
            Se connecter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Tableau de bord — GenShop TN</h1>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>

        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-[#131B2E] border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-cyan-400">{order.orderNumber}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800">{order.game}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      order.status === "livree"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : order.status === "rejetee"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="font-bold text-lg">
                  {order.packTitle} — <span className="text-emerald-400">{order.priceTND} TND</span> ({order.paymentMethod})
                </div>

                {order.game === "Free Fire" ? (
                  <div className="text-sm text-slate-300 flex items-center gap-2 flex-wrap">
                    <span>ID : <strong className="text-white">{order.playerId}</strong></span>
                    {order.playerId && (
                      <button
                        onClick={() => navigator.clipboard.writeText(order.playerId!)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copier ID
                      </button>
                    )}
                    <span className="text-slate-400">• WhatsApp : {order.whatsapp}</span>
                  </div>
                ) : (
                  <div className="bg-[#090D16] border border-slate-800 rounded-xl p-3 text-sm space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400">Login :</span>
                      <strong className="text-white">{order.accountEmail}</strong>
                      {order.accountEmail && (
                        <button
                          onClick={() => navigator.clipboard.writeText(order.accountEmail!)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copier
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400">Mot de passe :</span>
                      <strong className="font-mono text-amber-300">{order.accountPassword}</strong>
                      {order.accountPassword && (
                        <button
                          onClick={() => navigator.clipboard.writeText(order.accountPassword!)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copier
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span className="text-slate-400">Code vérif client :</span>
                      {order.verificationCode ? (
                        <strong className="font-mono text-base text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded">
                          {order.verificationCode}
                        </strong>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Pas encore envoyé</span>
                      )}
                      <span className="text-slate-400 ml-2">• WhatsApp : {order.whatsapp}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {order.game === "eFootball" && order.status !== "livree" && (
                  <button
                    onClick={() => updateStatus(order.id, "attente_code_client")}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-2 rounded-xl text-xs sm:text-sm"
                  >
                    Demander code
                  </button>
                )}
                <a
                  href={buildWhatsAppUrl(order.whatsapp, order)}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-700/80 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a
                  href={order.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" /> Reçu
                </a>
                <button
                  onClick={() => updateStatus(order.id, "livree")}
                  className="bg-emerald-600 hover:bg-emerald-500 p-2.5 rounded-xl"
                  title="Marquer comme livrée"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => updateStatus(order.id, "rejetee")}
                  className="bg-red-600 hover:bg-red-500 p-2.5 rounded-xl"
                  title="Rejeter"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}