"use client";

import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  hasSupabaseConfig,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
} from "../lib/supabase";

import MarketModal from "@/components/markets/MarketModal";
import ExcelMarketGrid from "@/components/markets/ExcelMarketGrid";
import EditDebtModal from "@/components/debts/EditDebtModal";

const today = new Date().toISOString().slice(0, 10);

const initialExpenses = [];
const initialInventory = [];
const initialUsage = [];
const initialSales = [];
const initialDebts = [];
const initialMarkets = [];

const navItems = [
  { key: "dashboard", label: "Dashboard", sub: "Maamulka Maanta", icon: "grid" },
  { key: "expenses", label: "Kharash", sub: "Diiwaanka Kharashka", icon: "credit-card" },
  { key: "inventory", label: "Kayd", sub: "Alaabta & Raashinka", icon: "box" },
  { key: "debts", label: "Dayn & Suuqyo", sub: "Bakhaarrada & Daymaha", icon: "store" },
  { key: "reports", label: "Warbixinno", sub: "Profit & Loss Dashboard", icon: "pie-chart" },
];

function money(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatQuantity(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(num);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStored(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function exportDebtsToCSV(debts, todayStr = today) {
  const safeDebts = Array.isArray(debts) ? debts : [];
  if (safeDebts.length === 0) {
    alert("Weli ma jiraan xog dayno ah oo la soo dejin karo.");
    return;
  }

  const headers = [
    "Market Name",
    "Supplier Phone",
    "Products Purchased",
    "Total Amount ($)",
    "Paid Amount ($)",
    "Remaining Balance ($)",
    "Date",
    "Status",
    "Notes",
  ];
  const rows = safeDebts.map((d) => {
    if (!d) return [];
    const total = Number(d.totalAmount) || 0;
    const paid = Number(d.paidAmount) || 0;
    const pending = Math.max(total - paid, 0);
    return [
      `"${String(d.marketName || "").replace(/"/g, '""')}"`,
      `"${String(d.supplierPhone || "").replace(/"/g, '""')}"`,
      `"${String(d.itemDescription || "").replace(/"/g, '""')}"`,
      total.toFixed(2),
      paid.toFixed(2),
      pending.toFixed(2),
      `"${d.debtDate || ""}"`,
      `"${d.status || ""}"`,
      `"${String(d.notes || "").replace(/"/g, '""')}"`,
    ];
  });

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Dheeman_Market_Debts_Report_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [reportDate, setReportDate] = useState(today);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [inventory, setInventory] = useState(initialInventory);
  const [usage, setUsage] = useState(initialUsage);
  const [sales, setSales] = useState(initialSales);
  const [debts, setDebts] = useState(initialDebts);
  const [markets, setMarkets] = useState(initialMarkets);
  const [hydrated, setHydrated] = useState(false);

  // UI Interactive States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); // 'expense' | 'stock' | 'useStock' | 'sale' | 'debt'
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [debtStatusFilter, setDebtStatusFilter] = useState("all"); // 'all' | 'pending' | 'paid'
  const [selectedMarketName, setSelectedMarketName] = useState(null);
  const [marketForm, setMarketForm] = useState({ id: null, name: "", productName: "", phone: "", purchaseAmount: "", notes: "" });
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  // Edit Debt Modal State
  const [editDebtModal, setEditDebtModal] = useState({ open: false, debt: null });
  const [editDebtForm, setEditDebtForm] = useState({
    id: "",
    marketName: "",
    supplierPhone: "",
    itemDescription: "",
    totalAmount: "",
    paidAmount: "",
    debtDate: today,
    notes: "",
  });

  // Pay Debt Modal State
  const [payDebtModal, setPayDebtModal] = useState({
    open: false,
    debtId: null,
    amount: "",
    marketName: "",
  });

  // Auth State (Supabase + Local Fallback)
  const [userSession, setUserSession] = useState(null);
  const [localSession, setLocalSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("signin");

  const isLoggedIn = Boolean(userSession || localSession);

  useEffect(() => {
    try {
      const savedLocal = localStorage.getItem("dheeman-local-auth");
      if (savedLocal) {
        setLocalSession(JSON.parse(savedLocal));
      }
    } catch (e) {
      console.error(e);
    }

    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!hasSupabaseConfig) {
      const mockSession = { user: { email: authEmail || "admin@dheeman.com" } };
      localStorage.setItem("dheeman-local-auth", JSON.stringify(mockSession));
      setLocalSession(mockSession);
      return;
    }

    const { error } = await signInWithEmail(authEmail, authPassword);
    if (error) setAuthError(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!hasSupabaseConfig) {
      const mockSession = { user: { email: authEmail || "admin@dheeman.com" } };
      localStorage.setItem("dheeman-local-auth", JSON.stringify(mockSession));
      setLocalSession(mockSession);
      return;
    }

    const { error } = await signUpWithEmail(authEmail, authPassword);
    if (error) setAuthError(error.message);
    else alert("Fadlan eeg email-kaaga si aad u xaqijiso akownka.");
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    if (!hasSupabaseConfig) {
      const mockSession = { user: { email: "google-manager@dheeman.com" } };
      localStorage.setItem("dheeman-local-auth", JSON.stringify(mockSession));
      setLocalSession(mockSession);
      return;
    }
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error.message);
  };

  const handleSignOut = async () => {
    if (supabase && userSession) {
      await signOutUser();
    }
    setUserSession(null);
    setLocalSession(null);
    try {
      localStorage.removeItem("dheeman-local-auth");
    } catch (e) {
      console.error(e);
    }
  };

  // Load live data from Supabase tables on login
  useEffect(() => {
    async function loadSupabaseData() {
      if (!supabase || !userSession?.user) return;

      try {
        const [expRes, invRes, useRes, saleRes, debtRes] = await Promise.all([
          supabase.from("expenses").select("*").order("created_at", { ascending: false }),
          supabase.from("inventory_items").select("*").order("created_at", { ascending: false }),
          supabase.from("inventory_usage").select("*").order("created_at", { ascending: false }),
          supabase.from("sales").select("*").order("created_at", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
        ]);

        if (expRes.data) {
          setExpenses(
            expRes.data.map((e) => ({
              id: e.id,
              type: e.type,
              item: e.item,
              amount: Number(e.amount),
              date: e.expense_date,
              note: e.note || "",
            }))
          );
        }

        if (invRes.data) {
          setInventory(
            invRes.data.map((i) => ({
              id: i.id,
              item: i.item,
              unit: i.unit,
              stocked: Number(i.stocked),
              used: Number(i.used),
              unitCost: Number(i.unit_cost),
              stockedDate: i.stocked_date,
              finishedDate: i.finished_date || "",
            }))
          );
        }

        if (useRes.data) {
          setUsage(
            useRes.data.map((u) => ({
              id: u.id,
              item: u.item,
              quantity: Number(u.quantity),
              unit: u.unit,
              cost: Number(u.cost),
              date: u.usage_date,
            }))
          );
        }

        if (saleRes.data) {
          setSales(
            saleRes.data.map((s) => ({
              id: s.id,
              item: s.item,
              amount: Number(s.amount),
              date: s.sale_date,
            }))
          );
        }

        if (debtRes.data) {
          setDebts(
            debtRes.data.map((d) => ({
              id: d.id,
              marketName: d.market_name,
              supplierPhone: d.supplier_phone || "",
              itemDescription: d.item_description,
              totalAmount: Number(d.total_amount),
              paidAmount: Number(d.paid_amount),
              debtDate: d.debt_date,
              dueDate: d.due_date || "",
              status: d.status,
              notes: d.notes || "",
            }))
          );
        }
      } catch (err) {
        console.error("Error loading Supabase data:", err);
      }
    }

    loadSupabaseData();
  }, [userSession]);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    type: "cash",
    item: "",
    amount: "",
    date: today,
    note: "",
  });
  const [stockForm, setStockForm] = useState({
    item: "",
    unit: "kiish",
    stocked: "",
    unitCost: "",
    stockedDate: today,
  });
  const [usageForm, setUsageForm] = useState({
    stockId: "",
    quantity: "",
    date: today,
  });
  const [saleForm, setSaleForm] = useState({
    item: "",
    amount: "",
    date: today,
  });
  const [debtForm, setDebtForm] = useState({
    marketName: "",
    supplierPhone: "",
    itemDescription: "",
    totalAmount: "",
    paidAmount: "",
    debtDate: today,
    notes: "",
  });

  // Hydrate local state for offline/fallback storage
  useEffect(() => {
    setExpenses(readStored("dheeman-expenses", initialExpenses));
    setInventory(readStored("dheeman-inventory", initialInventory));
    setUsage(readStored("dheeman-usage", initialUsage));
    setSales(readStored("dheeman-sales", initialSales));
    setDebts(readStored("dheeman-debts", initialDebts));
    setMarkets(readStored("dheeman-markets", initialMarkets));
    setHydrated(true);
  }, []);

  // Save to LocalStorage when hydrated
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-expenses", JSON.stringify(expenses));
    } catch (e) {
      console.error(e);
    }
  }, [expenses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-inventory", JSON.stringify(inventory));
    } catch (e) {
      console.error(e);
    }
  }, [inventory, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-usage", JSON.stringify(usage));
    } catch (e) {
      console.error(e);
    }
  }, [usage, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-sales", JSON.stringify(sales));
    } catch (e) {
      console.error(e);
    }
  }, [sales, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-debts", JSON.stringify(debts));
    } catch (e) {
      console.error(e);
    }
  }, [debts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("dheeman-markets", JSON.stringify(markets));
    } catch (e) {
      console.error(e);
    }
  }, [markets, hydrated]);

  // Derived financial summary
  const summary = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const safeUsage = Array.isArray(usage) ? usage : [];

    const totalSales = safeSales.reduce((acc, entry) => acc + (Number(entry?.amount) || 0), 0);
    const cashExpenses = safeExpenses
      .filter((entry) => entry && entry.type === "cash")
      .reduce((acc, entry) => acc + (Number(entry?.amount) || 0), 0);
    const debtExpenses = safeExpenses
      .filter((entry) => entry && entry.type === "debt")
      .reduce((acc, entry) => acc + (Number(entry?.amount) || 0), 0);
    const totalExpenses = cashExpenses + debtExpenses;
    const inventoryCost = safeUsage.reduce((acc, entry) => acc + (Number(entry?.cost) || 0), 0);

    const grossProfit = totalSales - inventoryCost;
    const netProfit = totalSales - cashExpenses - inventoryCost;

    return {
      totalSales,
      cashExpenses,
      debtExpenses,
      totalExpenses,
      inventoryCost,
      grossProfit,
      netProfit,
    };
  }, [sales, expenses, usage]);

  const debtSummary = useMemo(() => {
    const safeDebts = Array.isArray(debts) ? debts : [];
    const safeMarkets = Array.isArray(markets) ? markets : [];
    let totalOriginalDebt = 0;
    let totalPaidDebt = 0;
    let totalPendingDebt = 0;
    const marketMap = {};

    safeMarkets.forEach((m) => {
      if (!m || !m.name) return;
      const mName = m.name.trim();
      const pAmt = Number(m.purchaseAmount) || Number(m.address) || 0;
      marketMap[mName] = {
        id: m.id,
        name: mName,
        phone: m.phone || "",
        purchaseAmount: pAmt,
        notes: m.notes || "",
        count: 0,
        pending: 0,
        total: 0,
        paid: 0,
      };
    });

    safeDebts.forEach((d) => {
      if (!d) return;
      const total = Number(d.totalAmount) || 0;
      const paid = Number(d.paidAmount) || 0;
      const pending = Math.max(total - paid, 0);

      totalOriginalDebt += total;
      totalPaidDebt += paid;
      totalPendingDebt += pending;

      const mName = d.marketName ? d.marketName.trim() : "Suuq Guud";
      if (!marketMap[mName]) {
        marketMap[mName] = {
          id: crypto.randomUUID(),
          name: mName,
          phone: d.supplierPhone || "",
          purchaseAmount: total,
          notes: "",
          count: 0,
          pending: 0,
          total: 0,
          paid: 0,
        };
      }
      marketMap[mName].count += 1;
      marketMap[mName].pending += pending;
      marketMap[mName].total += total;
      marketMap[mName].paid += paid;
      if (!marketMap[mName].phone && d.supplierPhone) {
        marketMap[mName].phone = d.supplierPhone;
      }
    });

    const marketsList = Object.values(marketMap);

    return {
      totalOriginalDebt,
      totalPaidDebt,
      totalPendingDebt,
      marketCount: marketsList.length,
      marketsList,
    };
  }, [debts, markets]);

  // Combined transactions stream for recent activity
  const recentActivities = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const list = [
      ...safeSales.filter(Boolean).map((s) => ({
        id: s?.id || crypto.randomUUID(),
        date: s?.date || today,
        detail: s?.item || "Sale Item",
        type: "Dakhli",
        typeCode: "revenue",
        amount: Number(s?.amount) || 0,
      })),
      ...safeExpenses.filter(Boolean).map((e) => ({
        id: e?.id || crypto.randomUUID(),
        date: e?.date || today,
        detail: `${e?.item || "Expense"} (${e?.type === "cash" ? "Cesh" : "Dayn"})`,
        type: "Kharash",
        typeCode: "expense",
        amount: Number(e?.amount) || 0,
      })),
    ];

    list.sort((a, b) => (b.date > a.date ? 1 : -1));
    return list.slice(0, 8);
  }, [sales, expenses]);

  function openModal(type) {
    setDrawerType(type);
    setDrawerOpen(true);
  }

  function closeModal() {
    setDrawerOpen(false);
    setDrawerType(null);
  }

  async function handleAddExpense(event) {
    event.preventDefault();
    if (!expenseForm.item || !expenseForm.amount) return;

    const newExpense = {
      id: crypto.randomUUID(),
      type: expenseForm.type,
      item: expenseForm.item,
      amount: numberValue(expenseForm.amount),
      date: expenseForm.date || today,
      note: expenseForm.note,
    };

    setExpenses((current) => [newExpense, ...current]);
    setExpenseForm({
      type: "cash",
      item: "",
      amount: "",
      date: today,
      note: "",
    });
    closeModal();

    if (supabase && userSession?.user) {
      await supabase.from("expenses").insert({
        id: newExpense.id,
        user_id: userSession.user.id,
        type: newExpense.type,
        item: newExpense.item,
        amount: newExpense.amount,
        note: newExpense.note,
        expense_date: newExpense.date,
      });
    }
  }

  async function handleAddStock(event) {
    event.preventDefault();
    if (!stockForm.item || !stockForm.stocked) return;

    const newStock = {
      id: crypto.randomUUID(),
      item: stockForm.item,
      unit: stockForm.unit || "kiish",
      stocked: numberValue(stockForm.stocked),
      used: 0,
      unitCost: numberValue(stockForm.unitCost),
      stockedDate: stockForm.stockedDate || today,
      finishedDate: "",
    };

    setInventory((current) => [newStock, ...current]);
    setStockForm({
      item: "",
      unit: "kiish",
      stocked: "",
      unitCost: "",
      stockedDate: today,
    });
    closeModal();

    if (supabase && userSession?.user) {
      await supabase.from("inventory_items").insert({
        id: newStock.id,
        user_id: userSession.user.id,
        item: newStock.item,
        unit: newStock.unit,
        stocked: newStock.stocked,
        used: 0,
        unit_cost: newStock.unitCost,
        stocked_date: newStock.stockedDate,
      });
    }
  }

  async function handleUseStock(event) {
    event.preventDefault();
    if (!usageForm.stockId || !usageForm.quantity) return;

    const selectedStock = inventory.find((i) => i.id === usageForm.stockId);
    if (!selectedStock) return;

    const usedQty = numberValue(usageForm.quantity);
    const addedUsed = selectedStock.used + usedQty;

    const updatedInventory = inventory.map((i) => {
      if (i.id === usageForm.stockId) {
        const isFinished = addedUsed >= i.stocked;
        return {
          ...i,
          used: addedUsed,
          finishedDate: isFinished ? usageForm.date || today : i.finishedDate,
        };
      }
      return i;
    });

    const newUsageRecord = {
      id: crypto.randomUUID(),
      item: selectedStock.item,
      quantity: usedQty,
      unit: selectedStock.unit,
      cost: usedQty * selectedStock.unitCost,
      date: usageForm.date || today,
    };

    setInventory(updatedInventory);
    setUsage((current) => [newUsageRecord, ...current]);
    setUsageForm({ stockId: "", quantity: "", date: today });
    closeModal();

    if (supabase && userSession?.user) {
      await Promise.all([
        supabase
          .from("inventory_items")
          .update({
            used: addedUsed,
            finished_date: addedUsed >= selectedStock.stocked ? usageForm.date || today : null,
          })
          .eq("id", selectedStock.id),
        supabase.from("inventory_usage").insert({
          id: newUsageRecord.id,
          user_id: userSession.user.id,
          inventory_item_id: selectedStock.id,
          item: newUsageRecord.item,
          quantity: newUsageRecord.quantity,
          unit: newUsageRecord.unit,
          cost: newUsageRecord.cost,
          usage_date: newUsageRecord.date,
        }),
      ]);
    }
  }

  async function handleAddSale(event) {
    event.preventDefault();
    if (!saleForm.item || !saleForm.amount) return;

    const newSale = {
      id: crypto.randomUUID(),
      item: saleForm.item,
      amount: numberValue(saleForm.amount),
      date: saleForm.date || today,
    };

    setSales((current) => [newSale, ...current]);
    setSaleForm({
      item: "",
      amount: "",
      date: today,
    });
    closeModal();

    if (supabase && userSession?.user) {
      await supabase.from("sales").insert({
        id: newSale.id,
        user_id: userSession.user.id,
        item: newSale.item,
        amount: newSale.amount,
        sale_date: newSale.date,
      });
    }
  }

  async function deleteExpense(id) {
    if (confirm("Ma ziadaa in aad masaxdo kharashkan?")) {
      setExpenses((current) => current.filter((entry) => entry.id !== id));
      if (supabase && userSession?.user) {
        await supabase.from("expenses").delete().eq("id", id);
      }
    }
  }

  async function deleteSale(id) {
    if (confirm("Ma ziadaa in aad masaxdo iibkan?")) {
      setSales((current) => current.filter((entry) => entry.id !== id));
      if (supabase && userSession?.user) {
        await supabase.from("sales").delete().eq("id", id);
      }
    }
  }

  async function deleteStock(id) {
    if (confirm("Ma ziadaa in aad masaxdo alaabtan kaydka ah?")) {
      const selected = inventory.find((item) => item.id === id);
      setInventory((current) => current.filter((item) => item.id !== id));
      if (selected) {
        setUsage((current) => current.filter((entry) => entry.item !== selected.item));
      }
      setUsageForm((current) => ({ ...current, stockId: "" }));

      if (supabase && userSession?.user) {
        await supabase.from("inventory_items").delete().eq("id", id);
      }
    }
  }

  async function handleSaveDebt(event) {
    event.preventDefault();
    if (!debtForm.marketName || !debtForm.itemDescription || !debtForm.totalAmount) return;

    const total = numberValue(debtForm.totalAmount);
    const paid = numberValue(debtForm.paidAmount);
    let status = "pending";
    if (paid >= total && total > 0) {
      status = "paid";
    } else if (paid > 0) {
      status = "partial";
    }

    const newDebt = {
      id: crypto.randomUUID(),
      marketName: debtForm.marketName.trim(),
      supplierPhone: debtForm.supplierPhone || "",
      itemDescription: debtForm.itemDescription,
      totalAmount: total,
      paidAmount: paid,
      debtDate: debtForm.debtDate || today,
      status: status,
      notes: debtForm.notes || "",
    };

    setDebts((current) => [newDebt, ...current]);
    const trimmedMName = debtForm.marketName.trim();
    setMarkets((prev) => {
      if (!prev.some((m) => m.name.toLowerCase() === trimmedMName.toLowerCase())) {
        return [
          {
            id: crypto.randomUUID(),
            name: trimmedMName,
            phone: debtForm.supplierPhone || "",
            purchaseAmount: total,
            notes: "",
          },
          ...prev,
        ];
      }
      return prev;
    });

    setDebtForm({
      marketName: "",
      supplierPhone: "",
      itemDescription: "",
      totalAmount: "",
      paidAmount: "",
      debtDate: today,
      notes: "",
    });
    closeModal();

    if (supabase && userSession?.user) {
      await supabase.from("debts").insert({
        id: newDebt.id,
        user_id: userSession.user.id,
        market_name: newDebt.marketName,
        supplier_phone: newDebt.supplierPhone,
        item_description: newDebt.itemDescription,
        total_amount: newDebt.totalAmount,
        paid_amount: newDebt.paidAmount,
        debt_date: newDebt.debtDate,
        status: newDebt.status,
        notes: newDebt.notes,
      });
    }
  }

  async function handleAddMarketSubmit(event) {
    event.preventDefault();
    if (!marketForm.name) return;

    const trimmedName = marketForm.name.trim();
    const prodName = (marketForm.productName || marketForm.itemDescription || "").trim();
    const purchaseAmt = numberValue(marketForm.purchaseAmount || marketForm.address);
    const newMarket = {
      id: marketForm.id || crypto.randomUUID(),
      name: trimmedName,
      productName: prodName,
      phone: marketForm.phone || "",
      purchaseAmount: purchaseAmt,
      address: String(purchaseAmt),
      notes: marketForm.notes || "",
    };

    setMarkets((prev) => {
      const exists = prev.some((m) => m.name.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        return prev.map((m) => (m.name.toLowerCase() === trimmedName.toLowerCase() ? { ...m, ...newMarket } : m));
      }
      return [newMarket, ...prev];
    });

    if (purchaseAmt > 0 && prodName) {
      const newDebtRecord = {
        id: crypto.randomUUID(),
        marketName: trimmedName,
        supplierPhone: newMarket.phone,
        itemDescription: prodName,
        totalAmount: purchaseAmt,
        paidAmount: 0,
        debtDate: today,
        status: "pending",
        notes: marketForm.notes || "",
      };
      setDebts((prev) => [newDebtRecord, ...prev]);

      if (supabase && userSession?.user) {
        try {
          await supabase.from("debts").insert({
            id: newDebtRecord.id,
            user_id: userSession.user.id,
            market_name: newDebtRecord.marketName,
            supplier_phone: newDebtRecord.supplierPhone,
            item_description: newDebtRecord.itemDescription,
            total_amount: newDebtRecord.totalAmount,
            paid_amount: newDebtRecord.paidAmount,
            debt_date: newDebtRecord.debtDate,
            status: newDebtRecord.status,
            notes: newDebtRecord.notes,
          });
        } catch (err) {
          console.error("Supabase debt operation handled gracefully:", err);
        }
      }
    }

    setSelectedMarketName(trimmedName);
    setIsMarketModalOpen(false);
    setMarketForm({ id: null, name: "", productName: "", phone: "", purchaseAmount: "", notes: "" });

    if (supabase && userSession?.user) {
      try {
        await supabase.from("markets").upsert({
          id: newMarket.id,
          user_id: userSession.user.id,
          name: newMarket.name,
          phone: newMarket.phone,
          address: newMarket.address,
          notes: newMarket.notes,
        });
      } catch (err) {
        console.error("Supabase market operation handled gracefully:", err);
      }
    }
  }

  function handleEditMarketClick(market) {
    setMarketForm({
      id: market.id || crypto.randomUUID(),
      name: market.name || "",
      productName: market.productName || market.itemDescription || "",
      phone: market.phone || "",
      purchaseAmount: market.purchaseAmount ?? market.address ?? "",
      notes: market.notes || "",
    });
    setIsMarketModalOpen(true);
  }

  function deleteMarket(marketName) {
    if (confirm(`Ma dhab baa in aad masaxdo suuqa "${marketName}"?`)) {
      setMarkets((prev) => prev.filter((m) => m.name.toLowerCase() !== marketName.toLowerCase()));
      setDebts((prev) => prev.filter((d) => (d.marketName || "").trim().toLowerCase() !== marketName.toLowerCase()));
      if (selectedMarketName?.toLowerCase() === marketName.toLowerCase()) {
        setSelectedMarketName(null);
      }
    }
  }

  async function handlePayDebtSubmit(event) {
    event.preventDefault();
    if (!payDebtModal.debtId || !payDebtModal.amount) return;

    const addPay = numberValue(payDebtModal.amount);
    const targetDebt = debts.find((d) => d.id === payDebtModal.debtId);
    if (!targetDebt) return;

    const newPaid = targetDebt.paidAmount + addPay;
    let newStatus = "pending";
    if (newPaid >= targetDebt.totalAmount) {
      newStatus = "paid";
    } else if (newPaid > 0) {
      newStatus = "partial";
    }

    setDebts((current) =>
      current.map((d) =>
        d.id === payDebtModal.debtId
          ? { ...d, paidAmount: newPaid, status: newStatus }
          : d
      )
    );

    setPayDebtModal({ open: false, debtId: null, amount: "", marketName: "" });

    if (supabase && userSession?.user) {
      await supabase
        .from("debts")
        .update({
          paid_amount: newPaid,
          status: newStatus,
        })
        .eq("id", payDebtModal.debtId);
    }
  }

  async function handleEditDebtSubmit(event) {
    event.preventDefault();
    if (!editDebtForm.id || !editDebtForm.marketName || !editDebtForm.itemDescription) return;

    const total = numberValue(editDebtForm.totalAmount);
    const paid = numberValue(editDebtForm.paidAmount);
    let status = "pending";
    if (paid >= total && total > 0) {
      status = "paid";
    } else if (paid > 0) {
      status = "partial";
    }

    const updatedDebt = {
      id: editDebtForm.id,
      marketName: editDebtForm.marketName.trim(),
      supplierPhone: editDebtForm.supplierPhone || "",
      itemDescription: editDebtForm.itemDescription,
      totalAmount: total,
      paidAmount: paid,
      debtDate: editDebtForm.debtDate || today,
      status: status,
      notes: editDebtForm.notes || "",
    };

    setDebts((current) =>
      current.map((d) => (d.id === editDebtForm.id ? updatedDebt : d))
    );
    setEditDebtModal({ open: false, debt: null });

    if (supabase && userSession?.user) {
      await supabase
        .from("debts")
        .update({
          market_name: updatedDebt.marketName,
          supplier_phone: updatedDebt.supplierPhone,
          item_description: updatedDebt.itemDescription,
          total_amount: updatedDebt.totalAmount,
          paid_amount: updatedDebt.paidAmount,
          debt_date: updatedDebt.debtDate,
          status: updatedDebt.status,
          notes: updatedDebt.notes,
        })
        .eq("id", updatedDebt.id);
    }
  }

  function openEditDebtModal(debt) {
    setEditDebtForm({
      id: debt.id,
      marketName: debt.marketName || "",
      supplierPhone: debt.supplierPhone || "",
      itemDescription: debt.itemDescription || "",
      totalAmount: debt.totalAmount || "",
      paidAmount: debt.paidAmount || "",
      debtDate: debt.debtDate || today,
      notes: debt.notes || "",
    });
    setEditDebtModal({ open: true, debt });
  }

  async function deleteDebt(id) {
    if (confirm("Ma ziadaa in aad masaxdo dayntan?")) {
      setDebts((current) => current.filter((d) => d.id !== id));
      if (supabase && userSession?.user) {
        await supabase.from("debts").delete().eq("id", id);
      }
    }
  }

  const activeNav = navItems.find((item) => item.key === activeTab);

  // Authentication View
  if (!isLoggedIn && !authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/20">
              <CrownIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">Dheeman</h1>
              <p className="text-xs text-blue-600 font-bold tracking-widest uppercase mt-0.5">
                Restaurant Management System
              </p>
            </div>

            {/* CONNECTION STATUS BADGE */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border mx-auto">
              {hasSupabaseConfig ? (
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Supabase Cloud Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Local Manager Mode
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Soo gal si aad u maamusho dakhliga, kharashka, alaabta kaydka, iyo daymaha suuqyada.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
              {authError}
            </div>
          )}

          <form onSubmit={authMode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="manager@dheeman.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20"
            >
              {authMode === "signin" ? "Soo Gal (Sign In)" : "Sameyso Akown (Sign Up)"}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase">ama</span>
          </div>

          <button
            onClick={handleGoogleSignIn}
            type="button"
            className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>Ku Soo Gal Google (Google Sign-In)</span>
          </button>

          <div className="text-center text-xs text-slate-500 pt-2">
            {authMode === "signin" ? (
              <p>
                Weli akown ma lehid?{" "}
                <button
                  onClick={() => setAuthMode("signup")}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Rajiistar halkan
                </button>
              </p>
            ) : (
              <p>
                Ma leedahay akown?{" "}
                <button
                  onClick={() => setAuthMode("signin")}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Soo gal
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Application Shell
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row font-sans antialiased">
      {/* SIDEBAR NAVIGATION - DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen z-20">
        {/* LOGO AREA */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <CrownIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none uppercase">Dheeman</h2>
            <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase block mt-1">
              Management System
            </span>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key !== "debts") setSelectedMarketName(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition text-left ${isActive
                    ? "bg-blue-50 text-blue-700 font-extrabold border-r-4 border-blue-600 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                <span className={`p-1.5 rounded-lg ${isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <NavIcon name={item.icon} className="w-4 h-4" />
                </span>
                <div>
                  <div className="leading-tight">{item.label}</div>
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">{item.sub}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* USER PROFILE & LOGOUT */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              {(userSession?.user?.email || localSession?.user?.email || "M")[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-extrabold text-slate-900 truncate">
                {userSession?.user?.email || localSession?.user?.email || "Manager Admin"}
              </p>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Maamule Firfircoon
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-red-600 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Ka bax</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER BAR */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <CrownIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 uppercase leading-none">Dheeman</h1>
            <span className="text-[9px] text-blue-600 font-bold tracking-wider">MANAGEMENT</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE NAV MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col bg-white p-4 space-y-3 pt-20 animate-in fade-in duration-150">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key !== "debts") setSelectedMarketName(null);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold ${activeTab === item.key
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-700 bg-slate-50"
                  }`}
              >
                <NavIcon name={item.icon} className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-xs border border-red-200"
            >
              Ka bax
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        {/* TOP BAR */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-4 items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{activeNav?.label}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{activeNav?.sub}</p>
          </div>

          {/* STANDARDIZED BUTTON BAR */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal("sale")}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <PlusIcon className="w-4 h-4 text-emerald-600" />
              <span>+ Ku Soo Dar Dakhli</span>
            </button>

            <button
              onClick={() => openModal("expense")}
              className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <PlusIcon className="w-4 h-4 text-red-600" />
              <span>+ Ku Soo Dar Kharash</span>
            </button>

            <button
              onClick={() => openModal("debt")}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/10"
            >
              <PlusIcon className="w-4 h-4 text-white" />
              <span>+ Ku Soo Dar Dayn</span>
            </button>
          </div>
        </header>

        {/* CONTAINER VIEW */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* ==================================================== */}
          {/* TAB 1: DASHBOARD PAGE */}
          {/* ==================================================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* WELCOME HERO */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Kheyraadka Meheradda Dheeman
                  </span>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
                    Xogta Guud ee Maanta ({today})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    Maamusho dakhliga iibka, kharashaadka maalinlaha ah, baaqiga daymaha suuqyada, iyo alaabta kaydka ah.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("reports")}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-2"
                  >
                    <DocumentIcon className="w-4 h-4 text-slate-600" />
                    <span>Eeg Warbixinta Faa'iidada & Khasaaraha</span>
                  </button>
                </div>
              </div>

              {/* FINANCIAL STATS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* REVENUE */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Dakhliga Iibka</span>
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <DollarIcon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    {money(summary.totalSales)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Wadarta dakhliga ka soo maray iibka</div>
                </div>

                {/* CASH EXPENSES */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Kharashka Baxay</span>
                    <span className="p-2 rounded-xl bg-red-50 text-red-600">
                      <CreditCardIcon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-red-600">
                    {money(summary.cashExpenses)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Wadarta kharashaadka guud ee la bixiyay</div>
                </div>

                {/* NET PROFIT */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Faa'iidada Net-ka ah</span>
                    <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <TrendingUpIcon className="w-4 h-4" />
                    </span>
                  </div>
                  <div
                    className={`text-2xl font-extrabold ${summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                  >
                    {money(summary.netProfit)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Dakhliga ka soo haray kharashka</div>
                </div>

                {/* OUTSTANDING DEBTS */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Baaqiga Daynta</span>
                    <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                      <AlertIcon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-rose-600">
                    {money(debtSummary.totalPendingDebt)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Wadarta daymaha lagu leeyahay suuqyada</div>
                </div>
              </div>

              {/* SECONDARY ROW: RECENT TRANSACTIONS STREAM */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Hawgalladii Ugu Dambeeyay</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Diiwaanka dakhliga iyo kharashka meheradda.</p>
                  </div>
                  <button
                    onClick={() => openModal("sale")}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition shadow-sm"
                  >
                    + Ku Soo Dar Dakhli
                  </button>
                </div>

                <ActivityTable activities={recentActivities} />
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: KHARASH (EXPENSES) PAGE */}
          {/* ==================================================== */}
          {activeTab === "expenses" && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Diiwaanka Kharashaadka</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Maamul oo diiwaangeli dhammaan kharashaadka maalinlaha ah.</p>
                </div>

                <button
                  onClick={() => openModal("expense")}
                  className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold transition shadow-sm flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4 text-red-600" />
                  <span>+ Ku Soo Dar Kharash</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase">Wadarta Kharashka</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">{money(summary.totalExpenses)}</p>
                </div>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase">Kharashka Cash-ka ah</p>
                  <p className="text-2xl font-extrabold text-red-600 mt-2">{money(summary.cashExpenses)}</p>
                </div>
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase">Kharashka Daynta ah</p>
                  <p className="text-2xl font-extrabold text-amber-600 mt-2">{money(summary.debtExpenses)}</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <ExpenseTable expenses={expenses} onDelete={deleteExpense} />
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: KAYD (INVENTORY) PAGE */}
          {/* ==================================================== */}
          {activeTab === "inventory" && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Maamulka Alaabta Kaydka</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Diiwaanka raashinka, badeecadaha, iyo isticmaalka maalinlaha ah.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => openModal("useStock")}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <span>- Ka Jar Kaydka</span>
                  </button>
                  <button
                    onClick={() => openModal("stock")}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/10 flex items-center gap-1.5"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>+ Soo Dhig Kayd Cusub</span>
                  </button>
                </div>
              </div>

              <InventoryTable inventory={inventory} onDelete={deleteStock} onUseStock={openModal} />
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: DAYN & SUUQYO (DEBTS & MARKETS) PAGE */}
          {/* ==================================================== */}
          {activeTab === "debts" && (
            <div className="space-y-6">
              {/* DEDICATED MARKET VIEW IF A MARKET IS SELECTED */}
              {selectedMarketName ? (
                (() => {
                  const currentMarketDetails = debtSummary.marketsList.find(
                    (m) => m.name.toLowerCase() === selectedMarketName.toLowerCase()
                  ) || {
                    id: crypto.randomUUID(),
                    name: selectedMarketName,
                    phone: "",
                    purchaseAmount: 0,
                    notes: "",
                    pending: 0,
                    total: 0,
                    paid: 0,
                    count: 0,
                  };
                  const currentMarketDebts = debts.filter(
                    (d) => (d.marketName || "").trim().toLowerCase() === selectedMarketName.toLowerCase()
                  );

                  return (
                    <div className="space-y-6">
                      {/* TOP NAVIGATION BAR FOR DEDICATED MARKET PAGE */}
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                        <button
                          onClick={() => setSelectedMarketName(null)}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2"
                        >
                          <span>← Ku Noqo Dhammaan Suuqyada</span>
                        </button>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => exportDebtsToCSV(currentMarketDebts, `${selectedMarketName}_${today}`)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-2 shadow-sm"
                          >
                            <DocumentIcon className="w-4 h-4 text-emerald-600" />
                            <span>📊 Export Excel CSV</span>
                          </button>
                          <button
                            onClick={() => {
                              setDebtForm({ ...debtForm, marketName: selectedMarketName });
                              openModal("debt");
                            }}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md flex items-center gap-2"
                          >
                            <PlusIcon className="w-4 h-4" />
                            <span>+ Ku Dar Iib Suuqa {selectedMarketName}</span>
                          </button>
                        </div>
                      </div>

                      {/* HERO MARKET CARD */}
                      <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                          <div className="space-y-1">
                            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                              <StoreIcon className="w-3.5 h-3.5" />
                              Dedicated Market Profile Card
                            </span>
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{selectedMarketName}</h2>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                              {currentMarketDetails.phone && (
                                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                                  📞 Tel: <a href={`tel:${currentMarketDetails.phone}`} className="hover:underline">{currentMarketDetails.phone}</a>
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-slate-600">
                                💵 Qiimaha Alaabta Laga Iibsaday (Purchase Amount): <strong className="text-slate-900 font-extrabold">{money(currentMarketDetails.purchaseAmount || currentMarketDetails.total)}</strong>
                              </span>
                              <span className="flex items-center gap-1 text-slate-600">
                                📦 Wadarta Diiwaangelinta: <strong className="text-slate-900">{currentMarketDetails.count} xogta</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditMarketClick(currentMarketDetails)}
                              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <span>Wax ka Beddel Suuqa</span>
                            </button>
                            <button
                              onClick={() => deleteMarket(selectedMarketName)}
                              className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <TrashIcon className="w-4 h-4" />
                              <span>Tirtir Suuqa</span>
                            </button>
                          </div>
                        </div>

                        {/* STATS COUNTERS INSIDE CARD */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qiimaha Guud ee Iibka</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-2">{money(currentMarketDetails.total)}</p>
                          </div>

                          <div className="p-5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Lacagta La Bixiyay</p>
                            <p className="text-2xl font-extrabold text-emerald-600 mt-2">{money(currentMarketDetails.paid)}</p>
                          </div>

                          <div className="p-5 rounded-xl bg-red-50/50 border border-red-200">
                            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Baaqiga Daynta Dhiman</p>
                            <p className="text-3xl font-extrabold text-red-600 mt-2">{money(currentMarketDetails.pending)}</p>
                          </div>

                          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tirada Orodka / Iibka</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-2">{currentMarketDetails.count}</p>
                          </div>
                        </div>

                        {currentMarketDetails.notes && (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                            <span className="font-bold text-blue-600">💡 Note/Xusuusin:</span> {currentMarketDetails.notes}
                          </div>
                        )}
                      </div>

                      {/* EXCEL SPREADSHEET GRID FOR THIS MARKET */}
                      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <span>📊 Xogta Suuqa Qaabka Excel-ka (Excel Data Grid Spreadsheet)</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Xogta rasmiga ah ee suuqa {selectedMarketName}.</p>
                          </div>
                        </div>

                        <ExcelMarketGrid
                          debts={currentMarketDebts}
                          onPay={(debt) => setPayDebtModal({ open: true, debtId: debt.id, amount: "", marketName: debt.marketName })}
                          onDelete={deleteDebt}
                          onEdit={openEditDebtModal}
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* OVERVIEW VIEW FOR ALL MARKETS */
                <div className="space-y-6">
                  {/* HEADER BANNER */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                        <StoreIcon className="w-3.5 h-3.5" />
                        <span>Suuqyada & Daymaha (Markets & Debts)</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Maamulka Daymaha & Bakhaarrada Alaabta
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        Diiwaanka lacagaha raashinka iyo alaabta lagu soo qaatay daynta, suuqyada gaarka ah, iyo Excel data analysis.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <button
                        onClick={() => {
                          setMarketForm({ id: null, name: "", productName: "", phone: "", purchaseAmount: "", notes: "" });
                          setIsMarketModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>+ Ku Soo Dar Suuq Cusub</span>
                      </button>
                      <button
                        onClick={() => exportDebtsToCSV(debts, today)}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <DocumentIcon className="w-4 h-4 text-emerald-600" />
                        <span>📥 Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* METRICS CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                        <span>Jumlada Daynta Guud</span>
                        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                          <CreditCardIcon className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-extrabold text-slate-900">
                        {money(debtSummary.totalOriginalDebt)}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">Wadarta iibka suuqyada guud</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-rose-600 font-bold">
                        <span>Baaqiga Daynta</span>
                        <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                          <AlertIcon className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-extrabold text-rose-600">
                        {money(debtSummary.totalPendingDebt)}
                      </div>
                      <div className="mt-1 text-[11px] text-rose-500 font-medium">Daynta dhiman oo laga rabo</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                        <span>Lacagta La Bixiyay</span>
                        <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                          <DollarIcon className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-extrabold text-emerald-600">
                        {money(debtSummary.totalPaidDebt)}
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-600 font-medium">Wadarta lacagta daynta ka bixideeda</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                        <span>Suuqyada & Bakhaarrada</span>
                        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                          <StoreIcon className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-extrabold text-slate-900">
                        {debtSummary.marketCount} <span className="text-xs font-medium text-slate-500">Suuq/Bakhaar</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">Tirada suuqyada diiwaangashan</div>
                    </div>
                  </div>

                  {/* MARKETS CARDS LIST GRID */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <StoreIcon className="w-4 h-4 text-blue-600" />
                        <span>Suuqyada Diiwaangashan (Riix si aad u furto Profile-ka Suuqa)</span>
                      </h4>
                      <button
                        onClick={() => {
                          setMarketForm({ id: null, name: "", productName: "", phone: "", purchaseAmount: "", notes: "" });
                          setIsMarketModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>+ Ku Soo Dar Suuq Cusub</span>
                      </button>
                    </div>

                    {debtSummary.marketsList.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                        <StoreIcon className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                        <p className="text-xs text-slate-500 font-medium">Weli ma jiro suuq diiwaangashan. Riix '+ Ku Soo Dar Suuq Cusub'.</p>
                        <button
                          onClick={() => {
                            setMarketForm({ id: null, name: "", productName: "", phone: "", purchaseAmount: "", notes: "" });
                            setIsMarketModalOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/10"
                        >
                          + Ku Soo Dar Suuq Cusub
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {debtSummary.marketsList.map((m, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedMarketName(m.name)}
                            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 transition shadow-sm hover:shadow-md cursor-pointer group flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-2">
                                  <StoreIcon className="w-4 h-4 text-blue-600" />
                                  {m.name}
                                </span>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {m.count} xogta
                                </span>
                              </div>
                              {m.phone && (
                                <p className="text-xs text-slate-500">
                                  📞 Tel: <span className="text-blue-600 font-semibold">{m.phone}</span>
                                </p>
                              )}
                              <p className="text-xs text-slate-600">
                                💵 Qiimaha Alaabta: <span className="text-slate-900 font-extrabold">{money(m.purchaseAmount || m.total)}</span>
                              </p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-medium">Baaqiga Daynta:</span>
                                  <span className={`font-extrabold text-sm ${m.pending > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                    {money(m.pending)}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-400 text-[10px] block font-medium">Wadarta Guud:</span>
                                  <span className="font-bold text-slate-900">{money(m.total)}</span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMarketName(m.name);
                                }}
                                className="w-full py-2 rounded-xl bg-slate-50 group-hover:bg-blue-600 text-slate-700 group-hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-200 group-hover:border-blue-600"
                              >
                                <span>Fura Page-ka Suuqa</span>
                                <span>→</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FILTERS & SEARCH & ALL DEBTS TABLE */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Filter:</span>
                        <button
                          onClick={() => setDebtStatusFilter("all")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${debtStatusFilter === "all"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Dhammaan ({debts.length})
                        </button>
                        <button
                          onClick={() => setDebtStatusFilter("pending")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${debtStatusFilter === "pending"
                              ? "bg-rose-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Dayn Dhiman ({debts.filter((d) => d && d.status !== "paid").length})
                        </button>
                        <button
                          onClick={() => setDebtStatusFilter("paid")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${debtStatusFilter === "paid"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          La Bixiyay ({debts.filter((d) => d && d.status === "paid").length})
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative w-full sm:w-64">
                          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Raadi suuq ama alaab..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => exportDebtsToCSV(debts, today)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition shrink-0"
                          title="Download Excel CSV"
                        >
                          📊 Export CSV
                        </button>
                      </div>
                    </div>

                    {/* DEBTS TABLE */}
                    <DebtTable
                      debts={debts}
                      filter={debtStatusFilter}
                      search={searchQuery}
                      onPay={(debt) => setPayDebtModal({ open: true, debtId: debt.id, amount: "", marketName: debt.marketName })}
                      onDelete={deleteDebt}
                      onEdit={openEditDebtModal}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: WARBIXINNO (REPORTS - P&L DASHBOARD) PAGE */}
          {/* ==================================================== */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              {/* CONTROLS BAR */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Executive Profit & Loss Dashboard</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Warbixin maaliyadeed oo rasmi ah oo ku saleysan taariikhda la doortay.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 no-print">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-900 outline-none border-none"
                    />
                  </div>

                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/10"
                  >
                    <PrinterIcon className="w-4 h-4 text-white" />
                    <span>Print Statement</span>
                  </button>
                </div>
              </div>

              {/* OVERHAULED EXECUTIVE FINANCIAL DASHBOARD REPORT */}
              <ProfitLossDashboard summary={summary} reportDate={reportDate} />
            </div>
          )}
        </div>
      </main>

      {/* ==================================================== */}
      {/* MODAL DIALOGS & DRAWERS */}
      {/* ==================================================== */}

      {/* 1. MARKET MODAL */}
      <MarketModal
        isOpen={isMarketModalOpen}
        onClose={() => setIsMarketModalOpen(false)}
        onSubmit={handleAddMarketSubmit}
        form={marketForm}
        setForm={setMarketForm}
        isEditing={Boolean(marketForm.id)}
      />

      {/* 2. EDIT DEBT MODAL */}
      <EditDebtModal
        isOpen={editDebtModal.open}
        onClose={() => setEditDebtModal({ open: false, debt: null })}
        onSubmit={handleEditDebtSubmit}
        form={editDebtForm}
        setForm={setEditDebtForm}
      />

      {/* 3. PAY DEBT MODAL */}
      {payDebtModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setPayDebtModal({ open: false, debtId: null, amount: "", marketName: "" })}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <DollarIcon className="w-5 h-5 text-emerald-600" />
                <span>Bixi Daynta Suuqa</span>
              </h3>
              <button
                onClick={() => setPayDebtModal({ open: false, debtId: null, amount: "", marketName: "" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <PayDebtForm
              modal={payDebtModal}
              setModal={setPayDebtModal}
              onSubmit={handlePayDebtSubmit}
              onCancel={() => setPayDebtModal({ open: false, debtId: null, amount: "", marketName: "" })}
            />
          </div>
        </div>
      )}

      {/* 4. SLIDE-OVER MODAL DRAWER FOR OTHER FORMS */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={closeModal}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CrownIcon className="w-5 h-5 text-blue-600" />
                <span>
                  {drawerType === "expense"
                    ? "Kharash Cusub Bixi"
                    : drawerType === "stock"
                      ? "Soo Dhig Kayd Cusub"
                      : drawerType === "useStock"
                        ? "Ka Jar Kaydka (Isticmaal)"
                        : drawerType === "debt"
                          ? "Ku Soo Dar Dayn Cusub (Suuq)"
                          : "Add Income / Sale"}
                </span>
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {drawerType === "expense" && (
                <ExpenseForm
                  form={expenseForm}
                  setForm={setExpenseForm}
                  onSubmit={handleAddExpense}
                  onCancel={closeModal}
                />
              )}

              {drawerType === "stock" && (
                <StockForm
                  form={stockForm}
                  setForm={setStockForm}
                  onSubmit={handleAddStock}
                  onCancel={closeModal}
                />
              )}

              {drawerType === "useStock" && (
                <UseStockForm
                  form={usageForm}
                  inventory={inventory}
                  setForm={setUsageForm}
                  onSubmit={handleUseStock}
                  onCancel={closeModal}
                />
              )}

              {drawerType === "sale" && (
                <SaleForm
                  form={saleForm}
                  setForm={setSaleForm}
                  onSubmit={handleAddSale}
                  onCancel={closeModal}
                />
              )}

              {drawerType === "debt" && (
                <DebtForm
                  form={debtForm}
                  setForm={setDebtForm}
                  onSubmit={handleSaveDebt}
                  onCancel={closeModal}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

{/* SUB-COMPONENTS */ }

function ActivityTable({ activities = [] }) {
  if (activities.length === 0) {
    return <EmptyState text="Weli ma jiraan hawgallo la diiwaan geliyay." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
          <tr>
            <th className="py-3.5 px-4">Taariikhda</th>
            <th className="py-3.5 px-4">Qaybta</th>
            <th className="py-3.5 px-4">Faahfaahinta</th>
            <th className="py-3.5 px-4 text-right">Lacagta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
          {activities.map((act) => (
            <tr key={act.id} className="hover:bg-slate-50 transition">
              <td className="py-3.5 px-4 text-slate-500 font-medium">{act.date}</td>
              <td className="py-3.5 px-4 font-bold">
                {act.typeCode === "revenue" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    + Dakhli
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                    - Kharash
                  </span>
                )}
              </td>
              <td className="py-3.5 px-4 font-semibold text-slate-900">{act.detail}</td>
              <td
                className={`py-3.5 px-4 text-right font-extrabold ${act.typeCode === "revenue" ? "text-emerald-600" : "text-red-600"
                  }`}
              >
                {act.typeCode === "revenue" ? `+${money(act.amount)}` : `-${money(act.amount)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseTable({ expenses = [], onDelete }) {
  if (expenses.length === 0) {
    return <EmptyState text="Weli ma jiraan kharashaad la diiwaan geliyay." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
          <tr>
            <th className="py-3.5 px-4">Taariikhda</th>
            <th className="py-3.5 px-4">Nooca</th>
            <th className="py-3.5 px-4">Kharashka</th>
            <th className="py-3.5 px-4">Qiimaha</th>
            <th className="py-3.5 px-4">Xusuusin</th>
            <th className="py-3.5 px-4 text-right">Tirtir</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
          {expenses.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50 transition">
              <td className="py-3.5 px-4 text-slate-500 font-medium">{e.date}</td>
              <td className="py-3.5 px-4">
                {e.type === "cash" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Cesh (Cash)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Dayn (Debt)
                  </span>
                )}
              </td>
              <td className="py-3.5 px-4 font-bold text-slate-900">{e.item}</td>
              <td className="py-3.5 px-4 font-extrabold text-red-600">{money(e.amount)}</td>
              <td className="py-3.5 px-4 text-slate-500">{e.note || "—"}</td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onDelete(e.id)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Tirtir"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

{/* REDESIGNED INVENTORY TABLE WITH HIGH VISUAL HIERARCHY & BADGES */ }
function InventoryTable({ inventory = [], onDelete, onUseStock }) {
  if (inventory.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
        <BoxIcon className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
        <p className="text-xs text-slate-500 font-medium">Weli ma jiro alaab kayd ah oo la diiwaan geliyay.</p>
        <button
          onClick={() => onUseStock("stock")}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/10"
        >
          + Soo Dhig Kayd Cusub
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
          <tr>
            <th className="py-4 px-4">Alaabta (Product Item)</th>
            <th className="py-4 px-4">Wadarta Kaydka (Total Stock)</th>
            <th className="py-4 px-4">La Isticmaalay (Used Stock)</th>
            <th className="py-4 px-4">Baaqiga Dhiman (Remaining)</th>
            <th className="py-4 px-4">Qiimaha halkii Unit ($ Cost)</th>
            <th className="py-4 px-4 text-center">Xaaladda (Status)</th>
            <th className="py-4 px-4 text-right">Hawgallada (Actions)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
          {inventory.map((item) => {
            const remaining = Math.max((Number(item.stocked) || 0) - (Number(item.used) || 0), 0);
            const isFinished = remaining <= 0;
            const isLow = remaining > 0 && remaining <= 5;

            return (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="py-3.5 px-4 font-extrabold text-slate-900 text-sm">
                  {item.item}
                </td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {formatQuantity(item.stocked)} {item.unit}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {formatQuantity(item.used)} {item.unit}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold border ${isFinished
                        ? "bg-red-50 text-red-700 border-red-200"
                        : isLow
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                  >
                    {formatQuantity(remaining)} {item.unit}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-bold text-slate-900">{money(item.unitCost)}</td>
                <td className="py-3.5 px-4 text-center">
                  {isFinished ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 border border-red-300">
                      Dhamaaday
                    </span>
                  ) : isLow ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                      Woo Yaraaday
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Woo Hayaa
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Tirtir"
                    >
                      <TrashIcon className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

{/* OVERHAULED EXECUTIVE FINANCIAL DASHBOARD REPORT FOR WARBIXIN PAGE */ }
function ProfitLossDashboard({ summary = {}, reportDate = "" }) {
  const isNetProfitPositive = summary.netProfit > 0;
  const isNetProfitNegative = summary.netProfit < 0;

  return (
    <div className="print-area space-y-6">
      {/* HEADER CARD */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center space-y-1">
        <h2 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight">Dheeman Restaurant</h2>
        <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">
          Executive Profit & Loss Financial Statement
        </p>
        <p className="text-xs text-slate-400 font-medium">Taariikhda Warbixinta: {reportDate}</p>
      </div>

      {/* MULTI-CARD GRID LAYOUT (DESKTOP 2x2, MOBILE VERTICAL STACK) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: DAKHLIGA (REVENUE) - GREEN */}
        <div className="p-6 rounded-2xl bg-emerald-50/60 border-2 border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
            <h3 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              🟢 DAKHLIGA (REVENUE)
            </h3>
            <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Sales Revenue
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-700">Wadarta Iibka (Total Sales Revenue)</p>
            <p className="text-3xl font-extrabold text-emerald-600">{money(summary.totalSales)}</p>
            <p className="text-[11px] text-emerald-600/80">Total income collected from restaurant sales</p>
          </div>
        </div>

        {/* CARD 2: KHARASHKA ALAABTA (COST OF GOODS / INVENTORY) - BLUE */}
        <div className="p-6 rounded-2xl bg-blue-50/60 border-2 border-blue-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-blue-200/80 pb-3">
            <h3 className="text-sm font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              🔵 KHARASHKA ALAABTA (COST OF GOODS)
            </h3>
            <span className="text-[11px] font-extrabold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
              Inventory Cost
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-700">Alaabta Kharashkeeda (Inventory Usage Cost)</p>
            <p className="text-3xl font-extrabold text-blue-600">{money(summary.inventoryCost)}</p>
            <p className="text-[11px] text-blue-600/80">Cost of stock & ingredients consumed in sales</p>
          </div>
        </div>

        {/* CARD 3: FAA'IIDADA GUUD (GROSS PROFIT) - DARK NAVY */}
        <div className="p-6 rounded-2xl bg-white border-2 border-slate-300 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-900"></span>
              🔹 FAA'IIDADA GUUD (GROSS PROFIT)
            </h3>
            <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Revenue − COGS
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600">Ma'iidada Hore (Gross Profit)</p>
            <p className="text-3xl font-extrabold text-slate-900">{money(summary.grossProfit)}</p>
            <p className="text-[11px] text-slate-500">Sales revenue minus raw inventory cost</p>
          </div>
        </div>

        {/* CARD 4: KHARASHAADKA KALE (OPERATING EXPENSES) - RED */}
        <div className="p-6 rounded-2xl bg-red-50/60 border-2 border-red-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-red-200/80 pb-3">
            <h3 className="text-sm font-extrabold text-red-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              🔴 KHARASHKA KALE (OPERATING EXPENSES)
            </h3>
            <span className="text-[11px] font-extrabold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
              Operating Outflow
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-red-100 pb-2">
              <span>Kharashka Cesh-ka ah (Direct Cash Expenses)</span>
              <span className="font-extrabold text-red-600">{money(summary.cashExpenses)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-red-100 pb-2">
              <span>Kharashka Daynta ah (Debt Expenses)</span>
              <span className="font-extrabold text-amber-600">{money(summary.debtExpenses)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-extrabold text-red-800 pt-1">
              <span>Wadarta Kharashka (Total Operating Expenses)</span>
              <span className="text-base font-extrabold text-red-600">{money(summary.totalExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO NET PROFIT SUMMARY CARD */}
      <div
        className={`p-8 rounded-2xl border-2 shadow-md space-y-3 text-center transition ${isNetProfitPositive
            ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20"
            : isNetProfitNegative
              ? "bg-red-500 text-white border-red-600 shadow-red-500/20"
              : "bg-slate-900 text-white border-slate-900"
          }`}
      >
        <span className="px-3.5 py-1 rounded-full bg-white/20 text-white text-xs font-extrabold uppercase tracking-widest inline-block">
          {isNetProfitPositive ? "🟢 Maa'ida Wanaagsan" : isNetProfitNegative ? "🔴 Khasaarad" : "⚪ Baaqi Net"}
        </span>

        <p className="text-sm font-bold uppercase tracking-wider text-white/90">
          Ma'iidada Rasmiga ah (Net Income / Profit)
        </p>

        <p className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          {money(summary.netProfit)}
        </p>

        <p className="text-xs text-white/80 max-w-lg mx-auto">
          {isNetProfitPositive
            ? "Meheraddu waxay ku jirtaa faa'iido nadiif ah."
            : isNetProfitNegative
              ? "Fadlan eeg kharashaadka maadaama kharashku ka badan yahay dakhliga."
              : "Dakhliga iyo kharashku waa is leeyihiin."}
        </p>
      </div>
    </div>
  );
}

function ExpenseForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Nooca Kharashka (Payment Type)</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="cash">Cesh (Direct Cash)</option>
          <option value="debt">Dayn (Debt)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Kharashka oo Magaciisa ah (Item) *</label>
        <input
          type="text"
          placeholder="Tusaale: Koronto, Biyaha, Mishaha Shaqaalaha..."
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Qiimaha ($ Amount) *</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Taariikhda</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Xusuusin (Notes)</label>
        <textarea
          placeholder="Faahfaahin dheeraad ah..."
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-md shadow-red-500/10"
        >
          Kaydi Kharashka
        </button>
      </div>
    </form>
  );
}

function StockForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Magaca Alaabta (Item Name) *</label>
        <input
          type="text"
          placeholder="Tusaale: Bariis, Saliid, Qawa..."
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Tirada (Quantity) *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.stocked}
            onChange={(e) => setForm({ ...form, stocked: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Unit (Qeybta)</label>
          <input
            type="text"
            placeholder="kiish, bareel, kartoon..."
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Qiimaha halkii Unit ($ Cost)</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.unitCost}
          onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Taariikhda Soo Dhigista</label>
        <input
          type="date"
          value={form.stockedDate}
          onChange={(e) => setForm({ ...form, stockedDate: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/10"
        >
          Kaydi Alaabta
        </button>
      </div>
    </form>
  );
}

function UseStockForm({ form, inventory, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Dooro Alaabta (Select Stock) *</label>
        <select
          value={form.stockId}
          onChange={(e) => setForm({ ...form, stockId: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">-- Dooro Alaab --</option>
          {inventory.map((item) => {
            const rem = Math.max(item.stocked - item.used, 0);
            return (
              <option key={item.id} value={item.id}>
                {item.item} ({rem} {item.unit} dhiman)
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Tirada la Isticmaalay (Quantity Used) *</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Taariikhda Isticmaalka</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
        >
          <span>- Ka Jar Kaydka</span>
        </button>
      </div>
    </form>
  );
}

function SaleForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Alaabta / Adeegga la iibiyay (Sale Item) *</label>
        <input
          type="text"
          placeholder="Tusaale: Iibka Qadada, Cashada, Sharaabka..."
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Lacagta Soogashay ($ Amount) *</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Taariikhda Iibka</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-500/10"
        >
          Kaydi Dakhliga
        </button>
      </div>
    </form>
  );
}

function DebtForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Magaca Suuqa / Bakhaarka *</label>
        <input
          type="text"
          placeholder="Tusaale: Bakhaarka Xamdi, Suuqa Bakaaraha..."
          value={form.marketName}
          onChange={(e) => setForm({ ...form, marketName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Telefanka / Nambarka Xiriirka</label>
        <input
          type="tel"
          placeholder="Tusaale: 061XXXXXXX"
          value={form.supplierPhone}
          onChange={(e) => setForm({ ...form, supplierPhone: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Alaabta la soo iibsaday *</label>
        <input
          type="text"
          placeholder="Tusaale: 5 Kiish Bariis ah, 2 Bareel Saliid ah..."
          value={form.itemDescription}
          onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Qiimaha Guud ($) *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Lacagta La Bixiyay ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.paidAmount}
            onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Taariikhda Daynta</label>
        <input
          type="date"
          value={form.debtDate}
          onChange={(e) => setForm({ ...form, debtDate: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Xusuusin / Faahfaahin</label>
        <textarea
          placeholder="Faahfaahin ku saabsan bixinta..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/10"
        >
          Kaydi Daynta
        </button>
      </div>
    </form>
  );
}

function PayDebtForm({ modal, setModal, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
        Bixinta Daynta Suuqa: <strong className="text-slate-900">{modal.marketName}</strong>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Lacagta la bixinayo ($) *</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={modal.amount}
          onChange={(e) => setModal({ ...modal, amount: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          autoFocus
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          Jooji
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-500/10"
        >
          Bixi Lacagta
        </button>
      </div>
    </form>
  );
}

function DebtTable({ debts, filter, search, onPay, onDelete, onEdit }) {
  const filtered = useMemo(() => {
    return debts.filter((d) => {
      if (filter === "pending" && d.status === "paid") return false;
      if (filter === "paid" && d.status !== "paid") return false;

      if (search) {
        const q = search.toLowerCase();
        const m = (d.marketName || "").toLowerCase();
        const i = (d.itemDescription || "").toLowerCase();
        const p = (d.supplierPhone || "").toLowerCase();
        return m.includes(q) || i.includes(q) || p.includes(q);
      }

      return true;
    });
  }, [debts, filter, search]);

  if (filtered.length === 0) {
    return <EmptyState text="Weli ma jiraan daymo laga diiwaan geliyay suuqyada." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
          <tr>
            <th className="py-3.5 px-4">Suuqa / Bakhaarka</th>
            <th className="py-3.5 px-4">Alaabta / Raashinka</th>
            <th className="py-3.5 px-4">Taariikhda</th>
            <th className="py-3.5 px-4 text-right">Qiimaha Guud</th>
            <th className="py-3.5 px-4 text-right">La Bixiyay</th>
            <th className="py-3.5 px-4 text-right">Baaqiga Daynta</th>
            <th className="py-3.5 px-4 text-center">Xaaladda</th>
            <th className="py-3.5 px-4 text-right">Hawgallada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
          {filtered.map((d) => {
            const pending = Math.max(d.totalAmount - d.paidAmount, 0);
            return (
              <tr key={d.id} className="hover:bg-slate-50 transition">
                <td className="py-3.5 px-4 font-bold text-slate-900">
                  <div>{d.marketName}</div>
                  {d.supplierPhone && (
                    <span className="text-[10px] text-slate-400 font-normal">📞 {d.supplierPhone}</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-slate-800 font-semibold">{d.itemDescription}</td>
                <td className="py-3.5 px-4 text-slate-500">{d.debtDate}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{money(d.totalAmount)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-emerald-600">{money(d.paidAmount)}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">{money(pending)}</td>
                <td className="py-3.5 px-4 text-center">
                  {d.status === "paid" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ La Bixiyay
                    </span>
                  ) : d.status === "partial" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Qayb Bixis
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Dayn Dhiman
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {d.status !== "paid" && (
                      <button
                        onClick={() => onPay(d)}
                        className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition"
                      >
                        Bixi Dayn
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(d)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition"
                      >
                        Beddel
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(d.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Tirtir"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
      <p className="text-xs text-slate-500 font-medium">{text}</p>
    </div>
  );
}

function CrownIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l4 6 3-4 3 4 4-6v14H5V3z" />
    </svg>
  );
}

function NavIcon({ name, className }) {
  if (name === "grid") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  }
  if (name === "credit-card") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  if (name === "store") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3V3zm2 4v12a2 2 0 002 2h10a2 2 0 002-2V7M9 11h6m-6 4h4" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    </svg>
  );
}

function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function TrendingUpIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function CreditCardIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function DollarIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m0 0c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SparklesIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function BoxIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PrinterIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function StoreIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3V3zm2 4v12a2 2 0 002 2h10a2 2 0 002-2V7M9 11h6m-6 4h4" />
    </svg>
  );
}

function DocumentIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
