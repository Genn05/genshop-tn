"use client";

import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
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
  Package,
  Settings,
  ShoppingBag,
  Plus,
  Save,
  BarChart3,
  Gift,
  TrendingUp,
  Download,
  RotateCcw,
} from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  game: string;
  packTitle: string;
  priceTND: number;
  promoCode?: string;
  playerId?: string;
  accountEmail?: string;
  accountPassword?: string;
  verificationCode?: string;
  whatsapp: string;
  paymentMethod: string;
  receiptUrl: string;
  status: string;
  createdAt?: Timestamp | { seconds?: number };
}

interface PackDoc {
  id: string;
  game: string;
  title: string;
  price: number;
  badge?: string;
  active?: boolean;
}

interface PaymentSettings {
  d17Phone: string;
  flouciPhone: string;
  rechargeNote: string;
  deliveryTime: string;
  whatsappSupport: string;
  shopPaused?: boolean;
  pauseMessage?: string;
}

interface PromoCodeItem {
  id: string;
  code: string;
  discountTND: number;
  discountPercent: number;
  active?: boolean;
  game?: string;
  singleUse?: boolean;
  used?: boolean;
  usedBy?: string;
  allowedUser?: string;
}

interface RewardClaimItem {
  id: string;
  prize: string;
  contact: string;
}

const SEED_PACKS = [
  { game: "Free Fire", title: "100 + 10 Diamants", price: 4.5, badge: "Populaire", active: true },
  { game: "Free Fire", title: "310 + 31 Diamants", price: 13.0, badge: "", active: true },
  { game: "Free Fire", title: "520 + 52 Diamants", price: 21.5, badge: "Meilleur choix", active: true },
  { game: "eFootball", title: "1040 Coins", price: 34.0, badge: "Populaire", active: true },
  { game: "eFootball", title: "2130 Coins", price: 65.0, badge: "", active: true },
  { game: "Netflix", title: "1 Mois UHD (Profil Privé)", price: 14.0, badge: "Top vente", active: true },
  { game: "Netflix", title: "3 Mois UHD (Profil Privé)", price: 39.0, badge: "", active: true },
];

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

const toLocalDayKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDayKey = (dayKey: string): Date => {
  const parts = dayKey.split("-").map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(2026, 0, 1, 0, 0, 0, 0);
};

const getOrderDate = (createdAt: Order["createdAt"]): Date | null => {
  if (!createdAt) return null;
  if (typeof (createdAt as Timestamp).toDate === "function") {
    return (createdAt as Timestamp).toDate();
  }
  if (typeof (createdAt as { seconds?: number }).seconds === "number") {
    return new Date((createdAt as { seconds: number }).seconds * 1000);
  }
  return null;
};

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"orders" | "stats" | "packs" | "offers" | "settings">("orders");
  const [clientTodayKey, setClientTodayKey] = useState<string>("2026-01-01");

  // Commandes
  const [orders, setOrders] = useState<Order[]>([]);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [gameFilter, setGameFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Packs
  const [packs, setPacks] = useState<PackDoc[]>([]);
  const [newGame, setNewGame] = useState("Free Fire");
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newBadge, setNewBadge] = useState("");
  const [addingPack, setAddingPack] = useState(false);

  // Codes promo & Cadeau gratuit
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoDiscountTND, setPromoDiscountTND] = useState("2");
  const [promoDiscountPercent, setPromoDiscountPercent] = useState("0");
  const [promoGame, setPromoGame] = useState("ALL");
  const [promoAllowedUser, setPromoAllowedUser] = useState("");
  const [promoSingleUse, setPromoSingleUse] = useState(true);

  const [giveawayEnabled, setGiveawayEnabled] = useState(true);
  const [giveawayTitle, setGiveawayTitle] = useState("Cadeau Gratuit GEN SHOP");
  const [giveawaySubtitle, setGiveawaySubtitle] = useState(
    "Tente ta chance et débloque une récompense ou un avantage exclusif !"
  );
  const [giveawayPrizesText, setGiveawayPrizesText] = useState(
    "Code Promo -2 TND (GEN2)\nBonus Diamants / Coins offert\nLivraison Ultra-Prioritaire\nRéduction -10% sur prochain pack"
  );
  const [rewardClaims, setRewardClaims] = useState<RewardClaimItem[]>([]);

  // Paramètres paiement & boutique
  const [d17Phone, setD17Phone] = useState("");
  const [flouciPhone, setFlouciPhone] = useState("");
  const [rechargeNote, setRechargeNote] = useState(
    "Envoyez une photo claire du ticket de recharge (TT / Ooredoo / Orange) correspondant au montant exact."
  );
  const [deliveryTime, setDeliveryTime] = useState("Livraison 5-15 min");
  const [shopPaused, setShopPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState(
    "La livraison peut prendre un peu plus de temps actuellement. Vos commandes restent enregistrées."
  );
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setClientTodayKey(toLocalDayKey(new Date()));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      setOrders(list);
    });

    const qPacks = query(collection(db, "packs"), orderBy("price", "asc"));
    const unsubPacks = onSnapshot(qPacks, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PackDoc));
      setPacks(list);
    });

    const unsubPromos = onSnapshot(collection(db, "promos"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCodeItem));
      setPromos(list);
    });

    const unsubGiveaway = onSnapshot(doc(db, "settings", "giveaway"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.enabled === "boolean") setGiveawayEnabled(data.enabled);
        if (data.title) setGiveawayTitle(data.title);
        if (data.subtitle) setGiveawaySubtitle(data.subtitle);
        if (Array.isArray(data.prizes)) setGiveawayPrizesText(data.prizes.join("\n"));
      }
    });

    const qClaims = query(collection(db, "reward_claims"), orderBy("createdAt", "desc"));
    const unsubClaims = onSnapshot(qClaims, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RewardClaimItem));
      setRewardClaims(list);
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "payment"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<PaymentSettings>;
        if (data.d17Phone !== undefined) setD17Phone(data.d17Phone);
        if (data.flouciPhone !== undefined) setFlouciPhone(data.flouciPhone);
        if (data.rechargeNote !== undefined) setRechargeNote(data.rechargeNote);
        if (data.deliveryTime !== undefined) setDeliveryTime(data.deliveryTime);
        if (typeof data.shopPaused === "boolean") setShopPaused(data.shopPaused);
        if (data.pauseMessage) setPauseMessage(data.pauseMessage);
      }
    });

    return () => {
      unsubOrders();
      unsubPacks();
      unsubPromos();
      unsubGiveaway();
      unsubClaims();
      unsubSettings();
    };
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
    const payload: Record<string, string> = { status: newStatus };
    if (newStatus === "livree" || newStatus === "rejetee") {
      payload.accountPassword = "";
      payload.verificationCode = "";
    }
    await updateDoc(doc(db, "orders", orderId), payload);
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Supprimer définitivement la commande ${orderNumber} ?`)) return;
    await deleteDoc(doc(db, "orders", orderId));
  };

  const handleExportCsv = () => {
    const exportDate = toLocalDayKey(new Date());
    const headers = ["Numéro", "Catégorie", "Offre", "Prix (TND)", "Promo", "Paiement", "WhatsApp", "Statut"];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.game,
      o.packTitle,
      Number(o.priceTND || 0).toFixed(2),
      o.promoCode || "",
      o.paymentMethod,
      o.whatsapp,
      o.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `genshop-commandes-${exportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddPack = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(newPrice.replace(",", "."));
    if (!newTitle.trim() || isNaN(numericPrice) || numericPrice <= 0) {
      alert("Renseignez un titre et un prix valide en TND.");
      return;
    }
    setAddingPack(true);
    try {
      await addDoc(collection(db, "packs"), {
        game: newGame.trim(),
        title: newTitle.trim(),
        price: numericPrice,
        badge: newBadge.trim(),
        active: true,
      });
      setNewTitle("");
      setNewPrice("");
      setNewBadge("");
    } finally {
      setAddingPack(false);
    }
  };

  const handleSeedDefaultPacks = async () => {
    for (const p of SEED_PACKS) {
      await addDoc(collection(db, "packs"), p);
    }
    alert("Packs par défaut ajoutés !");
  };

  const handleUpdatePackPrice = async (packId: string, priceStr: string) => {
    const val = parseFloat(priceStr.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    await updateDoc(doc(db, "packs", packId), { price: val });
  };

  const handleTogglePackActive = async (pack: PackDoc) => {
    await updateDoc(doc(db, "packs", pack.id), { active: pack.active === false ? true : false });
  };

  const handleDeletePack = async (packId: string) => {
    if (!window.confirm("Supprimer ce pack ?")) return;
    await deleteDoc(doc(db, "packs", packId));
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) return;
    await addDoc(collection(db, "promos"), {
      code: cleanCode,
      discountTND: parseFloat(promoDiscountTND) || 0,
      discountPercent: parseFloat(promoDiscountPercent) || 0,
      game: promoGame,
      allowedUser: promoAllowedUser.trim(),
      singleUse: promoSingleUse,
      used: false,
      usedBy: "",
      active: true,
    });
    setPromoCodeInput("");
    setPromoAllowedUser("");
  };

  const handleTogglePromo = async (promo: PromoCodeItem) => {
    await updateDoc(doc(db, "promos", promo.id), { active: promo.active === false ? true : false });
  };

  const handleResetPromoUsage = async (promo: PromoCodeItem) => {
    await updateDoc(doc(db, "promos", promo.id), {
      used: false,
      usedBy: "",
      active: true,
    });
  };

  const handleDeletePromo = async (promoId: string) => {
    await deleteDoc(doc(db, "promos", promoId));
  };

  const handleSaveGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    const prizesList = giveawayPrizesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    await setDoc(
      doc(db, "settings", "giveaway"),
      {
        enabled: giveawayEnabled,
        title: giveawayTitle.trim(),
        subtitle: giveawaySubtitle.trim(),
        prizes: prizesList.length > 0 ? prizesList : ["Code Promo -2 TND (GEN2)"],
      },
      { merge: true }
    );
    alert("Configuration du cadeau gratuit enregistrée !");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, "settings", "payment"),
        {
          d17Phone: d17Phone.trim(),
          flouciPhone: flouciPhone.trim(),
          rechargeNote: rechargeNote.trim(),
          deliveryTime: deliveryTime.trim(),
          shopPaused,
          pauseMessage: pauseMessage.trim(),
        },
        { merge: true }
      );
      alert("Paramètres enregistrés en temps réel !");
    } finally {
      setSavingSettings(false);
    }
  };

  const stats = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status !== "livree" && o.status !== "rejetee").length;
    const deliveredOrders = orders.filter((o) => o.status === "livree");
    const revenueTND = deliveredOrders.reduce((acc, o) => acc + (Number(o.priceTND) || 0), 0);

    const baseDate = parseLocalDayKey(clientTodayKey);
    const todayKey = toLocalDayKey(baseDate);
    let todayOrdersCount = 0;
    let todayDeliveredTND = 0;

    const days: { key: string; label: string; ordersCount: number; revenueTND: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
      const key = toLocalDayKey(d);
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      days.push({ key, label, ordersCount: 0, revenueTND: 0 });
    }
    const dayMap = Object.fromEntries(days.map((item) => [item.key, item]));

    for (const o of orders) {
      const dt = getOrderDate(o.createdAt);
      if (dt && !Number.isNaN(dt.getTime())) {
        const k = toLocalDayKey(dt);
        if (k === todayKey) {
          todayOrdersCount += 1;
          if (o.status === "livree") {
            todayDeliveredTND += Number(o.priceTND) || 0;
          }
        }
        if (dayMap[k]) {
          dayMap[k].ordersCount += 1;
          if (o.status === "livree") {
            dayMap[k].revenueTND += Number(o.priceTND) || 0;
          }
        }
      }
    }

    const packMap: Record<string, { title: string; game: string; count: number; totalTND: number }> = {};
    for (const o of orders) {
      const key = `${o.game} — ${o.packTitle}`;
      if (!packMap[key]) {
        packMap[key] = { title: o.packTitle, game: o.game, count: 0, totalTND: 0 };
      }
      packMap[key].count += 1;
      packMap[key].totalTND += Number(o.priceTND) || 0;
    }
    const topPacks = Object.values(packMap).sort((a, b) => b.count - a.count);

    const paymentCounts: Record<string, number> = {};
    for (const o of orders) {
      const m = o.paymentMethod || "Autre";
      paymentCounts[m] = (paymentCounts[m] || 0) + 1;
    }

    return {
      total: orders.length,
      pendingCount,
      deliveredCount: deliveredOrders.length,
      revenueTND,
      todayOrdersCount,
      todayDeliveredTND,
      sevenDaysSeries: days,
      topPacks,
      paymentCounts,
    };
  }, [orders, clientTodayKey]);

  const chartData = useMemo(() => {
    const width = 560;
    const height = 180;
    const padLeft = 28;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 28;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxRevenue = Math.max(10, ...stats.sevenDaysSeries.map((d) => d.revenueTND));
    const maxOrders = Math.max(1, ...stats.sevenDaysSeries.map((d) => d.ordersCount));

    const revenuePoints = stats.sevenDaysSeries.map((d, idx) => {
      const x =
        stats.sevenDaysSeries.length === 1
          ? padLeft + plotW / 2
          : padLeft + (idx / (stats.sevenDaysSeries.length - 1)) * plotW;
      const y = padTop + plotH - (d.revenueTND / maxRevenue) * plotH;
      return { x, y, ...d };
    });

    const ordersPoints = stats.sevenDaysSeries.map((d, idx) => {
      const x =
        stats.sevenDaysSeries.length === 1
          ? padLeft + plotW / 2
          : padLeft + (idx / (stats.sevenDaysSeries.length - 1)) * plotW;
      const y = padTop + plotH - (d.ordersCount / maxOrders) * plotH;
      return { x, y, ...d };
    });

    const revenueLine = revenuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const ordersLine = ordersPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    return { width, height, padTop, plotH, maxRevenue, revenuePoints, ordersPoints, revenueLine, ordersLine };
  }, [stats.sevenDaysSeries]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-amber-500/20 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="GEN SHOP"
              className="w-10 h-10 rounded-full object-cover border-2 border-amber-400"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-amber-300">Tableau de bord — GEN SHOP</h1>
              <p className="text-xs text-slate-400">Commandes, courbes statistiques, top offres, promos &amp; cadeaux</p>
            </div>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 transition self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition ${
              activeTab === "orders"
                ? "bg-amber-400 text-slate-950 border-amber-300"
                : "bg-[#0D162B] text-slate-300 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Commandes ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition ${
              activeTab === "stats"
                ? "bg-amber-400 text-slate-950 border-amber-300"
                : "bg-[#0D162B] text-slate-300 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Statistiques &amp; Top Offres
          </button>
          <button
            onClick={() => setActiveTab("packs")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition ${
              activeTab === "packs"
                ? "bg-amber-400 text-slate-950 border-amber-300"
                : "bg-[#0D162B] text-slate-300 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <Package className="w-4 h-4" /> Packs &amp; Prix ({packs.length})
          </button>
          <button
            onClick={() => setActiveTab("offers")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition ${
              activeTab === "offers"
                ? "bg-amber-400 text-slate-950 border-amber-300"
                : "bg-[#0D162B] text-slate-300 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <Gift className="w-4 h-4" /> Promos &amp; Cadeaux
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition ${
              activeTab === "settings"
                ? "bg-amber-400 text-slate-950 border-amber-300"
                : "bg-[#0D162B] text-slate-300 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <Settings className="w-4 h-4" /> Paiement &amp; Infos
          </button>
        </div>

        {/* ONGLET 1 : COMMANDES */}
        {activeTab === "orders" && (
          <>
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
                <option value="ALL">Toutes les catégories</option>
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

              <button
                type="button"
                onClick={handleExportCsv}
                className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>

            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                  Aucune commande trouvée.
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
                        {order.promoCode && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            Promo: {order.promoCode}
                          </span>
                        )}
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
                        onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
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
          </>
        )}

        {/* ONGLET 2 : STATISTIQUES & TOP OFFRES */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-4">
                <div className="text-xs text-slate-400 mb-1">Commandes aujourd&apos;hui</div>
                <div className="text-2xl font-black text-white">{stats.todayOrdersCount}</div>
              </div>
              <div className="bg-[#0D162B] border border-emerald-500/25 rounded-2xl p-4">
                <div className="text-xs text-emerald-400 mb-1">CA livré aujourd&apos;hui</div>
                <div className="text-2xl font-black text-emerald-400">{stats.todayDeliveredTND.toFixed(2)} TND</div>
              </div>
              <div className="bg-[#0D162B] border border-amber-500/25 rounded-2xl p-4">
                <div className="text-xs text-amber-300 mb-1">CA livré total</div>
                <div className="text-2xl font-black text-amber-300">{stats.revenueTND.toFixed(2)} TND</div>
              </div>
            </div>

            <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Courbe d&apos;évolution (7 derniers jours)
                </h2>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-3 h-1 rounded-full bg-amber-400 inline-block" /> CA livré (TND)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-1 rounded-full bg-emerald-400 inline-block" /> Commandes
                  </span>
                </div>
              </div>

              <div className="bg-[#060B17] border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                  className="w-full min-w-[420px] h-48"
                >
                  {[0, 0.5, 1].map((ratio) => {
                    const y = chartData.padTop + chartData.plotH * (1 - ratio);
                    return (
                      <g key={ratio}>
                        <line
                          x1={28}
                          y1={y}
                          x2={chartData.width - 20}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text x={2} y={y + 4} fill="#64748b" fontSize="9">
                          {(chartData.maxRevenue * ratio).toFixed(0)}
                        </text>
                      </g>
                    );
                  })}

                  <path
                    d={chartData.revenueLine}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d={chartData.ordersLine}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />

                  {chartData.revenuePoints.map((pt) => (
                    <g key={pt.key}>
                      <circle cx={pt.x} cy={pt.y} r="4" fill="#fbbf24" />
                      <text
                        x={pt.x}
                        y={chartData.height - 8}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="10"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}

                  {chartData.ordersPoints.map((pt) => (
                    <circle key={`ord-${pt.key}`} cx={pt.x} cy={pt.y} r="3.5" fill="#34d399" />
                  ))}
                </svg>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-lg">
                  <TrendingUp className="w-5 h-5" /> Offres les plus achetées
                </div>

                {stats.topPacks.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune commande enregistrée pour l&apos;instant.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topPacks.map((p, idx) => (
                      <div
                        key={`${p.game}-${p.title}`}
                        className="bg-[#060B17] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs text-amber-300 font-bold">
                            #{idx + 1} • {p.game}
                          </div>
                          <div className="font-bold text-white text-sm sm:text-base">{p.title}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-300 text-sm sm:text-base">{p.count} achat(s)</div>
                          <div className="text-xs text-emerald-400">{p.totalTND.toFixed(2)} TND</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-bold text-amber-300">Modes de paiement utilisés</h2>
                  {Object.keys(stats.paymentCounts).length === 0 ? (
                    <p className="text-sm text-slate-400">Aucune donnée disponible.</p>
                  ) : (
                    Object.entries(stats.paymentCounts).map(([method, count]) => (
                      <div
                        key={method}
                        className="bg-[#060B17] border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-sm"
                      >
                        <span className="font-bold text-white">{method}</span>
                        <span className="font-extrabold text-amber-300">{count} commande(s)</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-bold text-amber-300">
                    Récompenses gratuites réclamées ({rewardClaims.length})
                  </h2>
                  {rewardClaims.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucun cadeau réclamé pour l&apos;instant.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {rewardClaims.slice(0, 15).map((c) => (
                        <div
                          key={c.id}
                          className="bg-[#060B17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-2"
                        >
                          <span className="text-emerald-400 font-bold">{c.prize}</span>
                          <span className="text-slate-400">{c.contact}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET 3 : PACKS & PRIX */}
        {activeTab === "packs" && (
          <div className="space-y-6">
            <form onSubmit={handleAddPack} className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-amber-300">Ajouter un pack dynamique</h2>
                {packs.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedDefaultPacks}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 px-3 py-1.5 rounded-lg font-bold"
                  >
                    Initialiser les packs par défaut
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Catégorie (ex: Free Fire)"
                  value={newGame}
                  onChange={(e) => setNewGame(e.target.value)}
                  className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Titre (ex: 520 + 52 Diamants)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Prix TND (ex: 21.5)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Badge optionnel (ex: Populaire)"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={addingPack}
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {addingPack ? "Ajout..." : "Ajouter le pack"}
              </button>
            </form>

            <div className="space-y-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-[#0D162B] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300">
                        {pack.game}
                      </span>
                      {pack.badge && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {pack.badge}
                        </span>
                      )}
                      {pack.active === false && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                          Masqué
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-base text-white mt-1">{pack.title}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={pack.price}
                      onBlur={(e) => handleUpdatePackPrice(pack.id, e.target.value)}
                      className="w-28 bg-[#060B17] border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      title="Modifier le prix puis cliquer ailleurs"
                    />
                    <span className="text-xs text-slate-400">TND</span>

                    <button
                      type="button"
                      onClick={() => handleTogglePackActive(pack)}
                      className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      {pack.active === false ? "Activer" : "Masquer"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePack(pack.id)}
                      className="bg-slate-800 hover:bg-red-900/70 text-red-300 p-2 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ONGLET 4 : PROMOS & CADEAUX GRATUITS */}
        {activeTab === "offers" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-amber-300">Codes Promo Dynamiques</h2>

              <form onSubmit={handleCreatePromo} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Code (ex: GEN2)"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-amber-400"
                    required
                  />
                  <select
                    value={promoGame}
                    onChange={(e) => setPromoGame(e.target.value)}
                    className="bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">Toutes catégories</option>
                    <option value="Free Fire">Free Fire</option>
                    <option value="eFootball">eFootball</option>
                    <option value="Netflix">Netflix</option>
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Réduction fixe (TND)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={promoDiscountTND}
                      onChange={(e) => setPromoDiscountTND(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Réduction (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={promoDiscountPercent}
                      onChange={(e) => setPromoDiscountPercent(e.target.value)}
                      className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Utilisateur autorisé (WhatsApp / ID / e-mail, optionnel)"
                  value={promoAllowedUser}
                  onChange={(e) => setPromoAllowedUser(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoSingleUse}
                    onChange={(e) => setPromoSingleUse(e.target.checked)}
                    className="rounded border-slate-700"
                  />
                  Code à usage unique (désactivé automatiquement après 1 commande)
                </label>

                <button
                  type="submit"
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Créer le code promo
                </button>
              </form>

              <div className="space-y-2.5 pt-2">
                {promos.map((pr) => (
                  <div
                    key={pr.id}
                    className="bg-[#060B17] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <strong className="font-mono text-amber-300">{pr.code}</strong>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {pr.game || "ALL"} • -{Number(pr.discountTND || 0).toFixed(2)} TND / -
                        {Number(pr.discountPercent || 0)}%
                        {pr.allowedUser && ` • Pour : ${pr.allowedUser}`}
                        {pr.singleUse &&
                          (pr.used
                            ? ` • Utilisé (${pr.usedBy || "oui"})`
                            : " • Usage unique (disponible)")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pr.used && (
                        <button
                          type="button"
                          onClick={() => handleResetPromoUsage(pr)}
                          className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
                          title="Réinitialiser l'usage"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(pr)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg font-bold"
                      >
                        {pr.active === false ? "Activer" : "Désactiver"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(pr.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveGiveaway} className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-amber-300">Module Gain Gratuit</h2>

              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={giveawayEnabled}
                  onChange={(e) => setGiveawayEnabled(e.target.checked)}
                  className="rounded border-slate-700"
                />
                Activer le module Gain Gratuit sur la boutique
              </label>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Titre</label>
                <input
                  type="text"
                  value={giveawayTitle}
                  onChange={(e) => setGiveawayTitle(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Sous-titre</label>
                <input
                  type="text"
                  value={giveawaySubtitle}
                  onChange={(e) => setGiveawaySubtitle(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Récompenses possibles (une par ligne)</label>
                <textarea
                  rows={4}
                  value={giveawayPrizesText}
                  onChange={(e) => setGiveawayPrizesText(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Enregistrer les cadeaux
              </button>
            </form>
          </div>
        )}

        {/* ONGLET 5 : PAIEMENT & INFOS */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="bg-[#0D162B] border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h2 className="text-lg font-bold text-amber-300">Paramètres dynamiques de la boutique</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Numéro D17</label>
                <input
                  type="text"
                  value={d17Phone}
                  onChange={(e) => setD17Phone(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Numéro / ID Flouci</label>
                <input
                  type="text"
                  value={flouciPhone}
                  onChange={(e) => setFlouciPhone(e.target.value)}
                  className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Badge délai affiché en haut</label>
              <input
                type="text"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={shopPaused}
                onChange={(e) => setShopPaused(e.target.checked)}
                className="rounded border-slate-700"
              />
              Afficher un bandeau d&apos;alerte / livraison ralentie sur la boutique
            </label>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Message d&apos;alerte boutique</label>
              <input
                type="text"
                value={pauseMessage}
                onChange={(e) => setPauseMessage(e.target.value)}
                className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Consigne de paiement par recharge</label>
              <textarea
                rows={3}
                value={rechargeNote}
                onChange={(e) => setRechargeNote(e.target.value)}
                className="w-full bg-[#060B17] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {savingSettings ? "Enregistrement..." : "Enregistrer les paramètres"}
            </button>
          </form>
        )}
      </div>

      {/* Modal aperçu reçu */}
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
                <ExternalLink className="w-4 h-4" /> Ouvrir dans un nouvel onglet
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