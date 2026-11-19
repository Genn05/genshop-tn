"use client";

import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  Check,
  X,
  Copy,
  ExternalLink,
  LogOut,
  KeyRound,
  MessageCircle,
  Eye,
  Trash2,
  Search,
  Wallet,
  Clock,
  CheckCircle2,
} from "lucide-react";

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
  const formattedPhone = digitsOnly.startsWith("216")
    ? digitsOnly
    : digitsOnly.length === 8
    ? `216${digitsOnly}`
    : digitsOnly;

  const message =
    order.game === "eFootball"
      ? `Bonjour, c'est GEN SHOP pour ta commande ${order.orderNumber} (${order.packTitle}). Je lance la connexion à ton compte eFootball : envoie-moi dès que possible le code de vérification reçu.`
      : `Bonjour, c'est GEN SHOP pour ta commande ${order.orderNumber} (${order.packTitle}). Ton paiement est en cours de vérification.`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [gameFilter, setGameFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

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

  const handleDelete = async (orderId: string, orderNumber: string) => {
    const confirmed = window.confirm(`Supprimer définitivement la commande ${orderNumber} ?`);
    if (!confirmed) return;
    await deleteDoc(doc(db, "orders", orderId));
  };

  const stats = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status !== "livree" && o.status !== "rejetee").length;
    const deliveredOrders = orders.filter((o) => o.status === "livree");
    const revenueTND = deliveredOrders.reduce((acc, o) => acc + (Number(o.priceTND) || 0), 0);
    return {
      total: orders.length,
      pendingCount,
      deliveredCount: deliveredOrders.length,
      revenueTND,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesGame = gameFilter === "ALL" || order.game === gameFilter;
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.orderNumber?.toLowerCase().includes(q) ||
        order.whatsapp?.toLowerCase().includes(q) ||
        order.playerId?.toLowerCase().includes(q) ||
        order.accountEmail?.toLowerCase().includes(q);
      return matchesGame && matchesStatus && matchesSearch;
    });
  }, [orders, gameFilter, statusFilter, searchTerm]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060B17] text-white flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-[#0D162B] border border-amber-500/25 p-8 rounded-2xl w-full max-w-md space-y-4 shadow-xl"
        >
          <img
            src="/logo.jpg"
            alt="GEN SHOP"
            className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 mx-auto"
          />
          <h1 className="text-2xl font-extrabold text-center text-amber-300">Admin — GEN SHOP</h1>
          <input
            type="email"
            placeholder="E-mail admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-400"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-400"
            required
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 py-3 rounded-xl font-black transition"
          >
            Se connecter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B17] text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6 border-b border-amber-500/20 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="GEN SHOP"
              className="w-10 h-10 rounded-full object-cover border-2 border-amber-400"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-amber-300">Tableau de bord — GEN SHOP</h1>
              <p className="text-xs text-slate-400">Gestion des commandes, reçus et codes OTP en direct</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 transition"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>

        {/* Cartes statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-1">Total commandes</div>
            <div className="text-2xl font-black text-white">{stats.total}</div>
          </div>
          <div className="bg-[#0D162B] border border-amber-500/25 rounded-2xl p-4">
            <div className="text-xs text-amber-300 flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5" /> En cours / OTP
            </div>
            <div className="text-2xl font-black text-amber-300">{stats.pendingCount}</div>
          </div>
          <div className="bg-[#0D162B] border border-emerald-500/25 rounded-2xl p-4">
            <div className="text-xs text-emerald-400 flex items-center gap-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Livrées
            </div>
            <div className="text-2xl font-black text-emerald-400">{stats.deliveredCount}</div>
          </div>
          <div className="bg-[#0D162B] border border-amber-500/25 rounded-2xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Wallet className="w-3.5 h-3.5 text-amber-400" /> Total livré
            </div>
            <div className="text-2xl font-black text-amber-300">{stats.revenueTND.toFixed(2)} TND</div>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#060B17] border border-slate-700 rounded-xl px-3">
            <Search className="w-4 h-4 text-amber-400" />
            <input
              type="text"
              placeholder="Rechercher GEN-XXXX, WhatsApp, ID ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="bg-[#060B17] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Tous les jeux</option>
            <option value="Free Fire">Free Fire</option>
            <option value="eFootball">eFootball</option>
            <option value="Netflix">Netflix</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#060B17] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="en_attente">en_attente</option>
            <option value="en_attente_connexion">en_attente_connexion</option>
            <option value="attente_code_client">attente_code_client</option>
            <option value="code_recu">code_recu</option>
            <option value="livree">livree</option>
            <option value="rejetee">rejetee</option>
          </select>
        </div>

        {/* Liste des commandes */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              Aucune commande trouvée avec ces filtres.
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#0D162B] border border-slate-800 hover:border-amber-500/25 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-amber-300">{order.orderNumber}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200">{order.game}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        order.status === "livree"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : order.status === "rejetee"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="font-bold text-lg text-white">
                    {order.packTitle} — <span className="text-amber-300">{Number(order.priceTND).toFixed(2)} TND</span>{" "}
                    <span className="text-sm font-semibold text-slate-400">({order.paymentMethod})</span>
                  </div>

                  {order.game === "Free Fire" ? (
                    <div className="text-sm text-slate-300 flex items-center gap-2 flex-wrap">
                      <span>
                        ID : <strong className="text-white">{order.playerId}</strong>
                      </span>
                      {order.playerId && (
                        <button
                          onClick={() => handleCopy(order.playerId!, `id-${order.id}`)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> {copiedKey === `id-${order.id}` ? "Copié !" : "Copier ID"}
                        </button>
                      )}
                      <span className="text-slate-400">• WhatsApp : {order.whatsapp}</span>
                    </div>
                  ) : (
                    <div className="bg-[#060B17] border border-slate-800 rounded-xl p-3 text-sm space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400">Compte :</span>
                        <strong className="text-white">{order.accountEmail}</strong>
                        {order.accountEmail && (
                          <button
                            onClick={() => handleCopy(order.accountEmail!, `mail-${order.id}`)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> {copiedKey === `mail-${order.id}` ? "Copié !" : "Copier"}
                          </button>
                        )}
                      </div>
                      {order.accountPassword && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-400">Mot de passe :</span>
                          <strong className="font-mono text-amber-300">{order.accountPassword}</strong>
                          <button
                            onClick={() => handleCopy(order.accountPassword!, `pass-${order.id}`)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> {copiedKey === `pass-${order.id}` ? "Copié !" : "Copier"}
                          </button>
                        </div>
                      )}
                      {order.game === "eFootball" && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <KeyRound className="w-4 h-4 text-amber-400" />
                          <span className="text-slate-400">Code vérif client :</span>
                          {order.verificationCode ? (
                            <strong className="font-mono text-base text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded">
                              {order.verificationCode}
                            </strong>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Pas encore envoyé</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 pt-0.5">WhatsApp : {order.whatsapp}</div>
                    </div>
                  )}
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center gap-2 flex-wrap">
                  {order.game === "eFootball" && order.status !== "livree" && (
                    <button
                      onClick={() => updateStatus(order.id, "attente_code_client")}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm transition"
                    >
                      Demander code
                    </button>
                  )}

                  <a
                    href={buildWhatsAppUrl(order.whatsapp, order)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-700/80 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>

                  {order.receiptUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewOrder(order)}
                      className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-300 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-4 h-4" /> Aperçu reçu
                    </button>
                  )}

                  <button
                    onClick={() => updateStatus(order.id, "livree")}
                    className="bg-emerald-600 hover:bg-emerald-500 p-2.5 rounded-xl transition"
                    title="Marquer comme livrée"
                  >
                    <Check className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => updateStatus(order.id, "rejetee")}
                    className="bg-red-600 hover:bg-red-500 p-2.5 rounded-xl transition"
                    title="Rejeter"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleDelete(order.id, order.orderNumber)}
                    className="bg-slate-800 hover:bg-red-900/70 text-slate-300 hover:text-red-300 p-2.5 rounded-xl transition"
                    title="Supprimer la commande"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de consultation du reçu */}
      {previewOrder && (
        <div
          onClick={() => setPreviewOrder(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0D162B] border border-amber-400/35 rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-amber-300">
                  Capture du reçu — {previewOrder.orderNumber}
                </h2>
                <p className="text-xs text-slate-400">
                  {previewOrder.paymentMethod} • {Number(previewOrder.priceTND).toFixed(2)} TND • WhatsApp :{" "}
                  {previewOrder.whatsapp}
                </p>
              </div>
              <button
                onClick={() => setPreviewOrder(null)}
                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#060B17] border border-slate-800 rounded-xl p-3 flex items-center justify-center max-h-[65vh] overflow-auto">
              <img
                src={previewOrder.receiptUrl}
                alt={`Reçu ${previewOrder.orderNumber}`}
                className="max-h-[58vh] w-auto rounded-lg object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <a
                href={previewOrder.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs sm:text-sm text-amber-300 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" /> Ouvrir l&apos;image dans un nouvel onglet
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    updateStatus(previewOrder.id, "livree");
                    setPreviewOrder(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl"
                >
                  Valider &amp; Livrer
                </button>
                <button
                  onClick={() => setPreviewOrder(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}