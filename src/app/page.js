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

const today = new Date().toISOString().slice(0, 10);

const initialExpenses = [];
const initialInventory = [];
const initialUsage = [];
const initialSales = [];

const navItems = [
  { key: "dashboard", label: "Dashboard", sub: "Maamulka Maanta", icon: "grid" },
  { key: "expenses", label: "Kharash", sub: "Diiwaanka Kharashka", icon: "credit-card" },
  { key: "inventory", label: "Kayd", sub: "Alaabta & Raashinka", icon: "box" },
  { key: "reports", label: "Warbixinno", sub: "Profit & Loss", icon: "pie-chart" },
];

function money(value) {
  const num = value || 0;
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

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [reportDate, setReportDate] = useState(today);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [inventory, setInventory] = useState(initialInventory);
  const [usage, setUsage] = useState(initialUsage);
  const [sales, setSales] = useState(initialSales);
  const [hydrated, setHydrated] = useState(false);

  // UI Interactive States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); // 'expense' | 'stock' | 'useStock' | 'sale'
  const [searchQuery, setSearchQuery] = useState("");
  const [chartPeriod, setChartPeriod] = useState("7d");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");

  // Supabase Auth State
  const [userSession, setUserSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("signin");

  useEffect(() => {
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

  // Load live data from Supabase tables on login
  useEffect(() => {
    async function loadSupabaseData() {
      if (!supabase || !userSession?.user) return;

      try {
        const [expRes, invRes, useRes, saleRes] = await Promise.all([
          supabase.from("expenses").select("*").order("created_at", { ascending: false }),
          supabase.from("inventory_items").select("*").order("created_at", { ascending: false }),
          supabase.from("inventory_usage").select("*").order("created_at", { ascending: false }),
          supabase.from("sales").select("*").order("created_at", { ascending: false }),
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

  useEffect(() => {
    if (window.localStorage.getItem("dheeman-data-version") !== "2") {
      ["expenses", "inventory", "usage", "sales"].forEach((key) => {
        window.localStorage.removeItem(`dheeman-${key}`);
      });
      window.localStorage.setItem("dheeman-data-version", "2");
    }

    setExpenses(readStored("dheeman-expenses", initialExpenses));
    setInventory(readStored("dheeman-inventory", initialInventory));
    setUsage(readStored("dheeman-usage", initialUsage));
    setSales(readStored("dheeman-sales", initialSales));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("dheeman-expenses", JSON.stringify(expenses));
    }
  }, [expenses, hydrated]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("dheeman-inventory", JSON.stringify(inventory));
    }
  }, [hydrated, inventory]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("dheeman-usage", JSON.stringify(usage));
    }
  }, [hydrated, usage]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("dheeman-sales", JSON.stringify(sales));
    }
  }, [hydrated, sales]);

  const summary = useMemo(() => {
    const dailyExpenses = expenses.filter((entry) => entry.date === reportDate);
    const dailyUsage = usage.filter((entry) => entry.date === reportDate);
    const dailySales = sales.filter((entry) => entry.date === reportDate);
    const revenue = dailySales.reduce((sum, entry) => sum + entry.amount, 0);
    const cashSpent = dailyExpenses
      .filter((entry) => entry.type === "cash")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const debt = dailyExpenses
      .filter((entry) => entry.type === "debt")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const usedStockCost = dailyUsage.reduce((sum, entry) => sum + entry.cost, 0);
    const profit = revenue - cashSpent - debt - usedStockCost;

    return {
      revenue,
      cashSpent,
      debt,
      usedStockCost,
      profit,
      dailyExpenses,
      dailyUsage,
      dailySales,
    };
  }, [expenses, reportDate, sales, usage]);

  const inventoryTotals = useMemo(() => {
    return inventory.reduce(
      (totals, item) => {
        const remaining = Math.max(item.stocked - item.used, 0);
        totals.remaining += remaining;
        totals.value += remaining * item.unitCost;
        totals.usedCost += item.used * item.unitCost;
        if (remaining === 0) totals.outOfStock += 1;
        else if (remaining <= 3) totals.lowStock += 1;
        return totals;
      },
      { remaining: 0, value: 0, usedCost: 0, lowStock: 0, outOfStock: 0 }
    );
  }, [inventory]);

  // Combined transactions stream for recent activity
  const recentActivities = useMemo(() => {
    const list = [
      ...sales.map((s) => ({
        id: s.id,
        date: s.date,
        detail: s.item,
        type: "Dakhli",
        typeCode: "revenue",
        amount: s.amount,
        status: "La xaqiijiyay",
      })),
      ...expenses.map((e) => ({
        id: e.id,
        date: e.date,
        detail: e.item,
        type: e.type === "debt" ? "Dayn" : "Kharash",
        typeCode: e.type,
        amount: -e.amount,
        status: e.type === "debt" ? "Baqi ku ah" : "La bixiyay",
      })),
    ];
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    return searchQuery
      ? list.filter((item) => item.detail.toLowerCase().includes(searchQuery.toLowerCase()))
      : list;
  }, [sales, expenses, searchQuery]);

  // Real Financial Chart Data aggregated per actual date in period
  const chartData = useMemo(() => {
    const somaliDays = ["Axad", "Isniin", "Talaado", "Arbaco", "Khamiis", "Jimce", "Sabti"];
    const result = [];
    const baseDate = new Date(reportDate);

    if (chartPeriod === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const dayName = somaliDays[d.getDay()];

        const rev = sales.filter((s) => s.date === dStr).reduce((sum, s) => sum + s.amount, 0);
        const exp = expenses.filter((e) => e.date === dStr).reduce((sum, e) => sum + e.amount, 0);

        result.push({
          date: dStr,
          day: dayName,
          rev,
          exp,
        });
      }
    } else if (chartPeriod === "30d") {
      for (let i = 29; i >= 0; i -= 4) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);

        const rev = sales.filter((s) => s.date === dStr).reduce((sum, s) => sum + s.amount, 0);
        const exp = expenses.filter((e) => e.date === dStr).reduce((sum, e) => sum + e.amount, 0);

        result.push({
          date: dStr,
          day: dStr.slice(5),
          rev,
          exp,
        });
      }
    } else if (chartPeriod === "3m") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i * 7);
        const dStr = d.toISOString().slice(0, 10);

        const rev = sales.filter((s) => s.date === dStr).reduce((sum, s) => sum + s.amount, 0);
        const exp = expenses.filter((e) => e.date === dStr).reduce((sum, e) => sum + e.amount, 0);

        result.push({
          date: dStr,
          day: `W${12 - i}`,
          rev,
          exp,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toISOString().slice(0, 7);

        const rev = sales.filter((s) => s.date.startsWith(monthStr)).reduce((sum, s) => sum + s.amount, 0);
        const exp = expenses.filter((e) => e.date.startsWith(monthStr)).reduce((sum, e) => sum + e.amount, 0);

        result.push({
          date: monthStr,
          day: d.toLocaleString("default", { month: "short" }),
          rev,
          exp,
        });
      }
    }

    return result;
  }, [sales, expenses, reportDate, chartPeriod]);

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
      note: expenseForm.note || "",
    };

    setExpenses((current) => [newExpense, ...current]);
    setExpenseForm({ type: "cash", item: "", amount: "", date: today, note: "" });
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
    if (!stockForm.item || !stockForm.stocked || !stockForm.unitCost) return;

    const nextStock = {
      id: crypto.randomUUID(),
      item: stockForm.item,
      unit: stockForm.unit || "kiish",
      stocked: numberValue(stockForm.stocked),
      used: 0,
      unitCost: numberValue(stockForm.unitCost),
      stockedDate: stockForm.stockedDate || today,
      finishedDate: "",
    };

    setInventory((current) => [nextStock, ...current]);
    setUsageForm((current) => ({ ...current, stockId: nextStock.id }));
    setStockForm({ item: "", unit: "kiish", stocked: "", unitCost: "", stockedDate: today });
    closeModal();

    if (supabase && userSession?.user) {
      await supabase.from("inventory_items").insert({
        id: nextStock.id,
        user_id: userSession.user.id,
        item: nextStock.item,
        unit: nextStock.unit,
        stocked: nextStock.stocked,
        used: 0,
        unit_cost: nextStock.unitCost,
        stocked_date: nextStock.stockedDate,
      });
    }
  }

  async function handleUseStock(event) {
    event.preventDefault();
    const selected = inventory.find((item) => item.id === usageForm.stockId);
    const quantity = numberValue(usageForm.quantity);

    if (!selected || quantity <= 0) return;

    const remaining = Math.max(selected.stocked - selected.used, 0);
    const safeQuantity = Math.min(quantity, remaining);
    if (safeQuantity <= 0) return;

    const nextUsed = selected.used + safeQuantity;
    const finDate = nextUsed >= selected.stocked ? (usageForm.date || today) : selected.finishedDate;

    setInventory((current) =>
      current.map((item) => {
        if (item.id !== selected.id) return item;
        return {
          ...item,
          used: nextUsed,
          finishedDate: finDate,
        };
      })
    );

    const newUsage = {
      id: crypto.randomUUID(),
      item: selected.item,
      quantity: safeQuantity,
      unit: selected.unit,
      cost: safeQuantity * selected.unitCost,
      date: usageForm.date || today,
    };

    setUsage((current) => [newUsage, ...current]);
    setUsageForm((current) => ({ ...current, quantity: "" }));
    closeModal();

    if (supabase && userSession?.user) {
      await Promise.all([
        supabase
          .from("inventory_items")
          .update({
            used: nextUsed,
            finished_date: finDate,
          })
          .eq("id", selected.id),
        supabase.from("inventory_usage").insert({
          id: newUsage.id,
          user_id: userSession.user.id,
          inventory_item_id: selected.id,
          item: newUsage.item,
          quantity: newUsage.quantity,
          unit: newUsage.unit,
          cost: newUsage.cost,
          usage_date: newUsage.date,
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
    setSaleForm({ item: "", amount: "", date: today });
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
    setExpenses((current) => current.filter((entry) => entry.id !== id));
    if (supabase && userSession?.user) {
      await supabase.from("expenses").delete().eq("id", id);
    }
  }

  async function deleteSale(id) {
    setSales((current) => current.filter((entry) => entry.id !== id));
    if (supabase && userSession?.user) {
      await supabase.from("sales").delete().eq("id", id);
    }
  }

  async function deleteStock(id) {
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

  function clearAllData() {
    if (confirm("Ma ziada in aad masaxdo dhammaan xogta?")) {
      setExpenses([]);
      setInventory([]);
      setUsage([]);
      setSales([]);
      setUsageForm((current) => ({ ...current, stockId: "" }));
    }
  }

  const activeNav = navItems.find((item) => item.key === activeTab);

  if (hasSupabaseConfig && !userSession && !authLoading) {
    return (
      <div className="min-h-screen bg-[#111315] text-[#F4EFE6] flex items-center justify-center p-4 selection:bg-[#C9A45C] selection:text-[#111315]">
        <div className="w-full max-w-md bg-[#171A1D] border border-[#2A2E33] rounded-xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#22262A] to-[#111315] border border-[#C9A45C]/50 flex items-center justify-center text-[#C9A45C] mx-auto shadow-lg shadow-[#C9A45C]/10">
              <CrownIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#F4EFE6] tracking-tight uppercase">Dheeman</h1>
              <p className="text-xs text-[#C9A45C] font-bold tracking-widest uppercase mt-0.5">
                Restaurant Management
              </p>
            </div>
            <p className="text-xs text-[#8E9297] pt-1">
              Fadlan soo gal si aad u gasho maamulka meheraddaada.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-md bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold text-center">
              {authError}
            </div>
          )}

          {/* GOOGLE / GMAIL OAUTH BUTTON */}
          <button
            type="button"
            onClick={async () => {
              setAuthError("");
              const res = await signInWithGoogle();
              if (res?.error) setAuthError(res.error.message);
            }}
            className="w-full py-3 px-4 rounded-lg bg-[#22262A] hover:bg-[#2A2E33] border border-[#2A2E33] hover:border-[#C9A45C]/50 text-[#F4EFE6] font-bold text-xs flex items-center justify-center gap-3 transition shadow-sm"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>Gmail / Google Ku Soo Gal</span>
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="w-full border-t border-[#2A2E33]" />
            <span className="bg-[#171A1D] px-3 text-[10px] text-[#8E9297] uppercase font-bold absolute">
              Ama Email
            </span>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError("");
              if (!authEmail || !authPassword) return;
              const res =
                authMode === "signin"
                  ? await signInWithEmail(authEmail, authPassword)
                  : await signUpWithEmail(authEmail, authPassword);
              if (res?.error) setAuthError(res.error.message);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-[#8E9297] mb-1">Gmail / Email Address</label>
              <input
                type="email"
                placeholder="magacaa@gmail.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E9297] mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] font-extrabold text-xs transition shadow-md"
            >
              {authMode === "signin" ? "Soo Gal (Sign In)" : "Sameyso Account (Sign Up)"}
            </button>
          </form>

          <div className="text-center text-xs text-[#8E9297]">
            {authMode === "signin" ? (
              <p>
                Account ma lehid?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className="text-[#C9A45C] font-bold hover:underline"
                >
                  Sameyso mid cusub
                </button>
              </p>
            ) : (
              <p>
                Account ma leedahay?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError("");
                  }}
                  className="text-[#C9A45C] font-bold hover:underline"
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

  return (
    <div className="min-h-screen bg-[#111315] text-[#F4EFE6] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#111315]">
      {/* MOBILE HEADER BAR */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#171A1D] border-b border-[#2A2E33] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-[#22262A] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C]">
            <CrownIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-[#F4EFE6] uppercase">Dheeman</h1>
            <p className="text-[10px] text-[#C9A45C] font-semibold tracking-widest uppercase">POS Software</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] hover:text-[#C9A45C]"
          aria-label="Toggle Navigation"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* NAVIGATION SIDEBAR (Desktop Fixed, Mobile Slide-over) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#171A1D] border-r border-[#2A2E33] flex flex-col justify-between transition-transform duration-300 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div>
            {/* BRAND HEADER */}
            <div className="p-6 border-b border-[#2A2E33] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#22262A] to-[#111315] border border-[#C9A45C]/50 flex items-center justify-center text-[#C9A45C] shadow-lg shadow-[#C9A45C]/10">
                  <CrownIcon className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold tracking-wide text-[#F4EFE6] uppercase">Dheeman</h1>
                  <p className="text-[10px] text-[#8E9297] font-medium tracking-widest uppercase mt-0.5">
                    Restaurant Software
                  </p>
                </div>
              </div>
            </div>

            {/* QUICK STAT HIGHLIGHT IN SIDEBAR */}
            <div className="mx-4 mt-5 p-4 rounded-lg bg-[#22262A] border border-[#2A2E33]">
              <div className="flex items-center justify-between text-xs text-[#8E9297] font-medium">
                <span>Faa'iidada Maanta</span>
                <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
              </div>
              <p className={`mt-1.5 text-xl font-bold tracking-tight ${summary.profit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {money(summary.profit)}
              </p>
              <div className="mt-2 text-[11px] text-[#8E9297]">
                Revenue: <span className="text-[#C9A45C] font-semibold">{money(summary.revenue)}</span>
              </div>
            </div>

            {/* NAV LINKS */}
            <nav className="mt-6 px-3 space-y-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all duration-150 relative group ${
                      isActive
                        ? "bg-[#22262A] text-[#F4EFE6] shadow-sm border border-[#2A2E33]"
                        : "text-[#8E9297] hover:bg-[#22262A]/60 hover:text-[#F4EFE6]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#C9A45C] rounded-r-full" />
                    )}
                    <NavIcon name={item.icon} className={`w-5 h-5 ${isActive ? "text-[#C9A45C]" : "text-[#8E9297] group-hover:text-[#F4EFE6]"}`} />
                    <div className="text-left">
                      <div className="leading-none">{item.label}</div>
                      <div className="text-[10px] text-[#8E9297] font-normal mt-1">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* SIDEBAR FOOTER */}
          <div className="p-4 border-t border-[#2A2E33] space-y-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-[#22262A]/50 border border-[#2A2E33]/60">
              {userSession?.user?.user_metadata?.avatar_url ? (
                <img
                  src={userSession.user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full border border-[#C9A45C]/40"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#C9A45C]/20 border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] text-xs font-bold">
                  {userSession?.user?.email?.slice(0, 2).toUpperCase() || "DR"}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-[#F4EFE6] truncate">
                  {userSession?.user?.user_metadata?.full_name || userSession?.user?.email || "Manager Profile"}
                </p>
                <p className="text-[10px] text-[#8E9297] truncate">
                  {userSession?.user?.email || "Dheeman Main Branch"}
                </p>
              </div>
            </div>

            {userSession && (
              <button
                onClick={() => signOutUser()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#2A2E33] text-[#F4EFE6] text-xs font-bold transition"
              >
                <span>Ka Bax (Sign Out)</span>
              </button>
            )}

            <button
              onClick={clearAllData}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/20 transition"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>Nadiifi Xogta</span>
            </button>
          </div>
        </aside>

        {/* MOBILE OVERLAY */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* MAIN APPLICATION CONTAINER */}
        <main className="flex-1 lg:pl-64 flex flex-col min-w-0">
          {/* HEADER BAR */}
          <header className="sticky top-0 z-20 bg-[#171A1D]/90 backdrop-blur-md border-b border-[#2A2E33] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#8E9297]">
                <span>Dheeman System</span>
                <span>/</span>
                <span className="text-[#C9A45C] font-semibold">{activeNav?.label}</span>
              </div>
              <h2 className="text-xl font-bold text-[#F4EFE6] tracking-tight mt-0.5">{activeNav?.sub}</h2>
            </div>

            {/* HEADER ACTIONS */}
            <div className="flex items-center flex-wrap gap-3">
              {/* SEARCH INPUT */}
              <div className="relative hidden md:block">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9297]" />
                <input
                  type="text"
                  placeholder="Raadi xog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] placeholder-[#8E9297] focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] outline-none transition w-48 lg:w-64"
                />
              </div>

              {/* DATE SELECTOR */}
              <div className="flex items-center gap-2 bg-[#22262A] border border-[#2A2E33] px-3 py-1.5 rounded-md">
                <CalendarIcon className="w-4 h-4 text-[#C9A45C]" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#F4EFE6] outline-none border-none cursor-pointer"
                />
              </div>

              {/* QUICK ACTION BUTTON */}
              <button
                onClick={() => openModal("expense")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-bold transition shadow-sm"
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Kharash Cusub</span>
              </button>

              <button
                onClick={() => openModal("stock")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#A98245]/40 text-[#F4EFE6] text-xs font-bold transition"
              >
                <PlusIcon className="w-4 h-4 text-[#C9A45C]" />
                <span>+ Kayd Cusub</span>
              </button>
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* ==================================================== */}
            {/* TAB 1: DASHBOARD OVERVIEW */}
            {/* ==================================================== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* HERO EXECUTIVE INTRO BANNER */}
                <div className="p-6 rounded-xl bg-gradient-to-r from-[#171A1D] via-[#22262A] to-[#171A1D] border border-[#2A2E33] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#C9A45C]/5 to-transparent pointer-events-none" />
                  <div className="space-y-2 relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#C9A45C]/10 border border-[#C9A45C]/30 text-[#C9A45C] text-xs font-bold uppercase tracking-wider">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      <span>Maamulka Maanta</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-[#F4EFE6] tracking-tight">
                      Si fudud ula soco dakhliga, kharashka, kaydka iyo faa'iidada.
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8E9297] leading-relaxed">
                      Warbixinta tooska ah ee restaurant-ka Dheeman. Taariikhda la doortay: <strong className="text-[#F4EFE6]">{reportDate}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 relative z-10 w-full md:w-auto">
                    <button
                      onClick={() => openModal("sale")}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-md bg-[#22C55E] hover:bg-[#16A34A] text-[#111315] text-xs font-extrabold transition shadow-md flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>+ Dakhli Cusub</span>
                    </button>
                    <button
                      onClick={() => openModal("useStock")}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#2A2E33] text-[#F4EFE6] text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      <BoxIcon className="w-4 h-4 text-[#C9A45C]" />
                      <span>Isticmaal Kayd</span>
                    </button>
                  </div>
                </div>

                {/* 4 CORE FINANCIAL SUMMARY METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* METRIC 1: DAKHLIGA */}
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33] hover:border-[#C9A45C]/40 transition group">
                    <div className="flex items-center justify-between text-xs text-[#8E9297] font-semibold">
                      <span>Dakhliga Maanta</span>
                      <span className="p-1.5 rounded-md bg-[#C9A45C]/10 text-[#C9A45C]">
                        <TrendingUpIcon className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-extrabold text-[#F4EFE6] tracking-tight">
                      {money(summary.revenue)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-[#22C55E] font-semibold flex items-center gap-1">
                        ✓ {summary.dailySales.length} iib maanta
                      </span>
                      <span className="text-[#8E9297]">Live income</span>
                    </div>
                  </div>

                  {/* METRIC 2: KHARASHKA CASH */}
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33] hover:border-[#C9A45C]/40 transition group">
                    <div className="flex items-center justify-between text-xs text-[#8E9297] font-semibold">
                      <span>Kharashka Cash</span>
                      <span className="p-1.5 rounded-md bg-[#A98245]/10 text-[#A98245]">
                        <CreditCardIcon className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-extrabold text-[#F4EFE6] tracking-tight">
                      {money(summary.cashSpent)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-[#8E9297] font-medium">
                        {summary.dailyExpenses.filter((e) => e.type === "cash").length} bixintee cash
                      </span>
                      <span className="text-[#A98245]">Outflow</span>
                    </div>
                  </div>

                  {/* METRIC 3: DAYNTA MAANTA */}
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33] hover:border-[#EF4444]/40 transition group">
                    <div className="flex items-center justify-between text-xs text-[#8E9297] font-semibold">
                      <span>Daynta Maanta</span>
                      <span className="p-1.5 rounded-md bg-[#EF4444]/10 text-[#EF4444]">
                        <AlertIcon className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-extrabold text-[#EF4444] tracking-tight">
                      {money(summary.debt)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-[#EF4444]/80 font-medium">Payable debts</span>
                      <span className="text-[#8E9297]">Kharash dayn</span>
                    </div>
                  </div>

                  {/* METRIC 4: FAA'IIDADA MAANTA */}
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33] hover:border-[#22C55E]/40 transition group">
                    <div className="flex items-center justify-between text-xs text-[#8E9297] font-semibold">
                      <span>{summary.profit >= 0 ? "Faa'iidada Maanta" : "Khasaaraha Maanta"}</span>
                      <span className={`p-1.5 rounded-md ${summary.profit >= 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                        <DollarIcon className="w-4 h-4" />
                      </span>
                    </div>
                    <div className={`mt-3 text-2xl font-extrabold tracking-tight ${summary.profit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                      {money(summary.profit)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-[#8E9297]">Net Profit Result</span>
                      <span className={`font-semibold ${summary.profit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                        {summary.profit >= 0 ? "Positive" : "Negative"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MAIN ANALYTICS CHART & RECENT TRANSACTIONS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* FINANCIAL ANALYTICS CHART (2 COLS) */}
                  <div className="lg:col-span-2 p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] flex flex-col justify-between space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-base font-extrabold text-[#F4EFE6] tracking-tight">
                          Guudmarka Maaliyadda
                        </h4>
                        <p className="text-xs text-[#8E9297] mt-0.5">
                          Dakhliga, kharashka iyo faa'iidada muddada la doortay.
                        </p>
                      </div>

                      {/* FILTER TIMEFRAME BUTTONS */}
                      <div className="flex items-center gap-1 bg-[#22262A] p-1 rounded-lg border border-[#2A2E33]">
                        {["7d", "30d", "3m", "12m"].map((period) => (
                          <button
                            key={period}
                            onClick={() => setChartPeriod(period)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                              chartPeriod === period
                                ? "bg-[#C9A45C] text-[#111315] font-bold shadow-sm"
                                : "text-[#8E9297] hover:text-[#F4EFE6]"
                            }`}
                          >
                            {period === "7d" ? "7 Maalmood" : period === "30d" ? "30 Maalmood" : period === "3m" ? "3 Bilood" : "12 Bilood"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* CHART VISUALIZER */}
                    <div className="pt-4 pb-2 border-t border-b border-[#2A2E33]/60 relative">
                      <div className="h-56 w-full flex items-end justify-between gap-2 px-2 pt-6">
                        {(() => {
                          const maxVal = Math.max(...chartData.map((d) => Math.max(d.rev, d.exp)), 1);

                          return chartData.map((data, index) => {
                            const revPct = data.rev > 0 ? Math.min((data.rev / maxVal) * 100, 100) : 0;
                            const expPct = data.exp > 0 ? Math.min((data.exp / maxVal) * 100, 100) : 0;

                            return (
                              <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                                <div className="w-full flex items-end justify-center gap-1.5 h-44">
                                  {/* REVENUE BAR */}
                                  <div
                                    style={{ height: `${revPct}%` }}
                                    className={`w-3.5 rounded-t-sm bg-[#C9A45C] group-hover:bg-[#D8B46B] transition-all duration-300 relative ${
                                      revPct === 0 ? "min-h-[2px] opacity-20" : ""
                                    }`}
                                  >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#22262A] text-[#F4EFE6] text-[10px] px-1.5 py-0.5 rounded border border-[#2A2E33] pointer-events-none whitespace-nowrap z-20 shadow-md">
                                      Dakhli: {money(data.rev)}
                                    </div>
                                  </div>

                                  {/* EXPENSE BAR */}
                                  <div
                                    style={{ height: `${expPct}%` }}
                                    className={`w-3.5 rounded-t-sm bg-[#EF4444]/80 group-hover:bg-[#EF4444] transition-all duration-300 relative ${
                                      expPct === 0 ? "min-h-[2px] opacity-20" : ""
                                    }`}
                                  >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#22262A] text-[#F4EFE6] text-[10px] px-1.5 py-0.5 rounded border border-[#2A2E33] pointer-events-none whitespace-nowrap z-20 shadow-md">
                                      Kharash: {money(data.exp)}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-[#8E9297] font-semibold">{data.day}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* CHART LEGEND */}
                    <div className="flex items-center justify-between text-xs text-[#8E9297]">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm bg-[#C9A45C]" />
                          <span>Dakhli: <strong className="text-[#C9A45C]">{money(chartData.reduce((s, d) => s + d.rev, 0))}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm bg-[#EF4444]" />
                          <span>Kharash: <strong className="text-[#EF4444]">{money(chartData.reduce((s, d) => s + d.exp, 0))}</strong></span>
                        </div>
                      </div>
                      <span className="text-[#C9A45C] font-semibold">
                        Net: {money(chartData.reduce((s, d) => s + d.rev - d.exp, 0))}
                      </span>
                    </div>
                  </div>

                  {/* INVENTORY ALERTS & QUICK WIDGET (1 COL) */}
                  <div className="p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between border-b border-[#2A2E33] pb-3">
                        <h4 className="text-base font-extrabold text-[#F4EFE6] tracking-tight flex items-center gap-2">
                          <BoxIcon className="w-4 h-4 text-[#C9A45C]" />
                          <span>Xaaladda Kaydka</span>
                        </h4>
                        <button
                          onClick={() => setActiveTab("inventory")}
                          className="text-xs text-[#C9A45C] hover:underline font-semibold"
                        >
                          Eeg dhammaan
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#22262A] border border-[#2A2E33]">
                          <span className="text-xs text-[#8E9297]">Qiimaha Kaydka Guud:</span>
                          <span className="text-sm font-extrabold text-[#C9A45C]">{money(inventoryTotals.value)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#22262A] border border-[#2A2E33]">
                          <span className="text-xs text-[#8E9297]">Alaabta Harsan:</span>
                          <span className="text-sm font-bold text-[#F4EFE6]">{inventoryTotals.remaining} items</span>
                        </div>

                        {/* LOW STOCK ALERTS LIST */}
                        <div className="space-y-2 mt-4">
                          <p className="text-xs font-bold text-[#8E9297] uppercase tracking-wider">Calaamadaha Kaydka</p>
                          {inventory.length === 0 ? (
                            <p className="text-xs text-[#8E9297] italic py-2">Fadlan kayd cusub geli.</p>
                          ) : (
                            inventory.slice(0, 3).map((item) => {
                              const remaining = Math.max(item.stocked - item.used, 0);
                              const isLow = remaining <= 3;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-2.5 rounded-md bg-[#22262A]/60 border border-[#2A2E33] text-xs"
                                >
                                  <span className="font-semibold text-[#F4EFE6] truncate max-w-[110px]">{item.item}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                      remaining === 0
                                        ? "bg-[#EF4444]/20 text-[#EF4444]"
                                        : isLow
                                        ? "bg-[#C9A45C]/20 text-[#C9A45C]"
                                        : "bg-[#22C55E]/20 text-[#22C55E]"
                                    }`}
                                  >
                                    {remaining} {item.unit}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => openModal("stock")}
                      className="w-full py-2.5 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#C9A45C]/40 text-[#C9A45C] text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>+ Soo Dhig Kayd Cusub</span>
                    </button>
                  </div>
                </div>

                {/* RECENT ACTIVITY TABLE */}
                <div className="p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="text-base font-extrabold text-[#F4EFE6] tracking-tight">
                        Dhaqdhaqaaqyadii Ugu Dambeeyay
                      </h4>
                      <p className="text-xs text-[#8E9297] mt-0.5">Dakhliga iyo kharashaadkii dhowaan la diiwaan geliyay.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openModal("expense")}
                        className="px-3 py-1.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-xs text-[#F4EFE6] hover:text-[#C9A45C] font-semibold transition"
                      >
                        + Add Expense
                      </button>
                      <button
                        onClick={() => openModal("sale")}
                        className="px-3 py-1.5 rounded-md bg-[#C9A45C] text-xs text-[#111315] font-bold hover:bg-[#D8B46B] transition"
                      >
                        + Add Income
                      </button>
                    </div>
                  </div>

                  {/* TRANSACTIONS TABLE */}
                  <ActivityTable activities={recentActivities} />
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* TAB 2: KHARASH (EXPENSES) PAGE */}
            {/* ==================================================== */}
            {activeTab === "expenses" && (
              <div className="space-y-6">
                {/* TOP SUMMARY STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Kharashka Cash Maanta</p>
                    <p className="text-2xl font-extrabold text-[#F4EFE6] mt-2">{money(summary.cashSpent)}</p>
                    <p className="text-[11px] text-[#C9A45C] mt-1">Direct cash payments</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Daynta Maanta</p>
                    <p className="text-2xl font-extrabold text-[#EF4444] mt-2">{money(summary.debt)}</p>
                    <p className="text-[11px] text-[#EF4444]/80 mt-1">Pending debt entries</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Guud Ahaan Kharashka</p>
                    <p className="text-2xl font-extrabold text-[#F4EFE6] mt-2">{money(summary.cashSpent + summary.debt)}</p>
                    <p className="text-[11px] text-[#8E9297] mt-1">{expenses.length} total recorded entries</p>
                  </div>
                </div>

                {/* EXPENSE TOOLBAR & TABLE */}
                <div className="p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2A2E33] pb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-[#F4EFE6]">Diiwaanka Kharashka</h3>
                      <p className="text-xs text-[#8E9297]">Maamul dhammaan cash-ka iyo daynta meheradda ka baxday.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* CATEGORY FILTER */}
                      <select
                        value={expenseCategoryFilter}
                        onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                        className="px-3 py-2 text-xs rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] outline-none"
                      >
                        <option value="all">Dhammaan Noocyada</option>
                        <option value="cash">Lacag Cash Ah</option>
                        <option value="debt">Dayn</option>
                      </select>

                      <button
                        onClick={() => openModal("expense")}
                        className="px-4 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-extrabold transition flex items-center gap-2 shadow-sm"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>+ Bixi Kharash Cusub</span>
                      </button>
                    </div>
                  </div>

                  {/* EXPENSES TABLE */}
                  <ExpenseTable
                    expenses={expenses.filter((e) =>
                      expenseCategoryFilter === "all" ? true : e.type === expenseCategoryFilter
                    )}
                    onDelete={deleteExpense}
                  />
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* TAB 3: KAYD (INVENTORY) PAGE */}
            {/* ==================================================== */}
            {activeTab === "inventory" && (
              <div className="space-y-6">
                {/* SUMMARY METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Alaabta Oo Dhan</p>
                    <p className="text-2xl font-extrabold text-[#F4EFE6] mt-2">{inventory.length} items</p>
                    <p className="text-[11px] text-[#8E9297] mt-1">Total registered stock</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Qiimaha Kaydka</p>
                    <p className="text-2xl font-extrabold text-[#C9A45C] mt-2">{money(inventoryTotals.value)}</p>
                    <p className="text-[11px] text-[#C9A45C] mt-1">Current total value</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Kayd Yar (Low)</p>
                    <p className="text-2xl font-extrabold text-[#C9A45C] mt-2">{inventoryTotals.lowStock}</p>
                    <p className="text-[11px] text-[#C9A45C] mt-1">Needs reordering</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#171A1D] border border-[#2A2E33]">
                    <p className="text-xs text-[#8E9297] font-semibold uppercase tracking-wider">Dhammaaday (Out)</p>
                    <p className="text-2xl font-extrabold text-[#EF4444] mt-2">{inventoryTotals.outOfStock}</p>
                    <p className="text-[11px] text-[#EF4444] mt-1">0 items remaining</p>
                  </div>
                </div>

                {/* INVENTORY TABLE & ACTIONS */}
                <div className="p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2A2E33] pb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-[#F4EFE6]">Kaydka Restaurant-ka</h3>
                      <p className="text-xs text-[#8E9297]">Kala soco raashinka, cabitaanka iyo agabka yaalla meheradda.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => openModal("useStock")}
                        className="px-4 py-2 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#2A2E33] text-[#F4EFE6] text-xs font-bold transition flex items-center gap-2"
                      >
                        <BoxIcon className="w-4 h-4 text-[#C9A45C]" />
                        <span>Isticmaal Kayd</span>
                      </button>

                      <button
                        onClick={() => openModal("stock")}
                        className="px-4 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-extrabold transition flex items-center gap-2 shadow-sm"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>+ Soo Dhig Kayd</span>
                      </button>
                    </div>
                  </div>

                  {/* INVENTORY POS TABLE */}
                  <InventoryTable inventory={inventory} onDelete={deleteStock} onUseStock={openModal} />
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* TAB 4: WARBIXINNO (REPORTS - P&L) PAGE */}
            {/* ==================================================== */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                {/* CONTROLS BAR */}
                <div className="p-6 rounded-xl bg-[#171A1D] border border-[#2A2E33] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#F4EFE6]">Profit & Loss Statement</h3>
                    <p className="text-xs text-[#8E9297]">Warbixin maaliyadeed oo rasmi ah oo ku saleysan taariikhda la doortay.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 no-print">
                    <div className="flex items-center gap-2 bg-[#22262A] border border-[#2A2E33] px-3 py-1.5 rounded-md">
                      <CalendarIcon className="w-4 h-4 text-[#C9A45C]" />
                      <input
                        type="date"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-[#F4EFE6] outline-none border-none"
                      />
                    </div>

                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 rounded-md bg-[#22262A] hover:bg-[#2A2E33] border border-[#2A2E33] text-[#F4EFE6] text-xs font-bold transition flex items-center gap-2"
                    >
                      <PrinterIcon className="w-4 h-4 text-[#C9A45C]" />
                      <span>Print Statement</span>
                    </button>
                  </div>
                </div>

                {/* P&L STATEMENT REPORT CARD */}
                <ProfitLossStatement summary={summary} reportDate={reportDate} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ==================================================== */}
      {/* SLIDE-OVER SIDE DRAWER / MODAL FOR FORMS */}
      {/* ==================================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={closeModal}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-[#171A1D] border border-[#2A2E33] rounded-xl shadow-2xl overflow-hidden z-10">
            {/* MODAL HEADER */}
            <div className="p-5 border-b border-[#2A2E33] flex items-center justify-between bg-[#22262A]/50">
              <h3 className="text-base font-extrabold text-[#F4EFE6] flex items-center gap-2">
                <CrownIcon className="w-5 h-5 text-[#C9A45C]" />
                <span>
                  {drawerType === "expense"
                    ? "Kharash Cusub Bixi"
                    : drawerType === "stock"
                    ? "Soo Dhig Kayd Cusub"
                    : drawerType === "useStock"
                    ? "Ka Jar Kaydka (Isticmaal)"
                    : "Add Income / Sale"}
                </span>
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-md text-[#8E9297] hover:text-[#F4EFE6] hover:bg-[#22262A]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================== */
/* COMPONENT HELPER FUNCTIONS & TABLES */
/* ==================================================== */

function ActivityTable({ activities }) {
  if (activities.length === 0) {
    return <EmptyState text="Wax dhaqdhaqaaq ah weli ma ka dhicin meheradda." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2A2E33]">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#22262A] text-[#8E9297] font-semibold border-b border-[#2A2E33]">
          <tr>
            <th className="px-4 py-3">Taariikh</th>
            <th className="px-4 py-3">Faahfaahin</th>
            <th className="px-4 py-3">Nooca</th>
            <th className="px-4 py-3">Lacagta</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2E33]/60 bg-[#171A1D]">
          {activities.map((item) => {
            const isIncome = item.amount > 0;
            return (
              <tr key={item.id} className="hover:bg-[#22262A]/40 transition">
                <td className="px-4 py-3.5 text-[#8E9297] font-medium">{item.date}</td>
                <td className="px-4 py-3.5 text-[#F4EFE6] font-bold">{item.detail}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isIncome
                        ? "bg-[#C9A45C]/15 text-[#C9A45C]"
                        : item.typeCode === "debt"
                        ? "bg-[#EF4444]/15 text-[#EF4444]"
                        : "bg-[#A98245]/15 text-[#A98245]"
                    }`}
                  >
                    {item.type}
                  </span>
                </td>
                <td className={`px-4 py-3.5 font-extrabold ${isIncome ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                  {isIncome ? `+${money(item.amount)}` : money(item.amount)}
                </td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded bg-[#22262A] text-[#8E9297] border border-[#2A2E33] text-[10px] font-semibold">
                    {item.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseTable({ expenses, onDelete }) {
  if (expenses.length === 0) {
    return <EmptyState text="Kharash weli la ma gelin. Riix '+ Bixi Kharash' si aad ugu darto." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2A2E33]">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#22262A] text-[#8E9297] font-semibold border-b border-[#2A2E33]">
          <tr>
            <th className="px-4 py-3">Nooc</th>
            <th className="px-4 py-3">Waxa la bixiyay</th>
            <th className="px-4 py-3">Lacagta</th>
            <th className="px-4 py-3">Taariikh</th>
            <th className="px-4 py-3">Xusuusin</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2E33]/60 bg-[#171A1D]">
          {expenses.map((expense) => (
            <tr key={expense.id} className="hover:bg-[#22262A]/40 transition">
              <td className="px-4 py-3.5">
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    expense.type === "debt"
                      ? "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30"
                      : "bg-[#A98245]/15 text-[#A98245] border border-[#A98245]/30"
                  }`}
                >
                  {expense.type === "debt" ? "Dayn Payable" : "Cash Paid"}
                </span>
              </td>
              <td className="px-4 py-3.5 font-bold text-[#F4EFE6]">{expense.item}</td>
              <td className="px-4 py-3.5 font-extrabold text-[#EF4444]">{money(expense.amount)}</td>
              <td className="px-4 py-3.5 text-[#8E9297]">{expense.date}</td>
              <td className="px-4 py-3.5 text-[#8E9297] italic">{expense.note || "-"}</td>
              <td className="px-4 py-3.5 text-right">
                <button
                  onClick={() => onDelete(expense.id)}
                  className="p-1 rounded text-[#EF4444] hover:bg-[#EF4444]/10 transition font-bold"
                  title="Masax"
                >
                  Masax
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({ inventory, onDelete, onUseStock }) {
  if (inventory.length === 0) {
    return <EmptyState text="Kaydka meheraddu waa faali. Riix '+ Soo Dhig Kayd' si aad ugu darto." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2A2E33]">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#22262A] text-[#8E9297] font-semibold border-b border-[#2A2E33]">
          <tr>
            <th className="px-4 py-3">Magaca Sheyga</th>
            <th className="px-4 py-3">Soo Galay</th>
            <th className="px-4 py-3">La Isticmaalay</th>
            <th className="px-4 py-3">Harsan</th>
            <th className="px-4 py-3">Qiimaha Unit</th>
            <th className="px-4 py-3">Qiimaha Guud</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2E33]/60 bg-[#171A1D]">
          {inventory.map((item) => {
            const remaining = Math.max(item.stocked - item.used, 0);
            const totalVal = remaining * item.unitCost;
            const isOut = remaining === 0;
            const isLow = remaining <= 3 && !isOut;

            return (
              <tr key={item.id} className="hover:bg-[#22262A]/40 transition">
                <td className="px-4 py-3.5 font-bold text-[#F4EFE6]">{item.item}</td>
                <td className="px-4 py-3.5 text-[#8E9297]">
                  {formatQuantity(item.stocked)} {item.unit}
                </td>
                <td className="px-4 py-3.5 text-[#8E9297]">
                  {formatQuantity(item.used)} {item.unit}
                </td>
                <td className="px-4 py-3.5 font-bold text-[#F4EFE6]">
                  {formatQuantity(remaining)} {item.unit}
                </td>
                <td className="px-4 py-3.5 text-[#8E9297]">{money(item.unitCost)}</td>
                <td className="px-4 py-3.5 font-extrabold text-[#C9A45C]">{money(totalVal)}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      isOut
                        ? "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30"
                        : isLow
                        ? "bg-[#C9A45C]/15 text-[#C9A45C] border border-[#C9A45C]/30"
                        : "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30"
                    }`}
                  >
                    {isOut ? "Out of Stock" : isLow ? "Low Stock" : "Available"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right space-x-2">
                  <button
                    onClick={() => onUseStock("useStock")}
                    disabled={isOut}
                    className="px-2 py-1 rounded bg-[#22262A] text-[#C9A45C] border border-[#2A2E33] font-semibold hover:bg-[#2A2E33] disabled:opacity-40"
                  >
                    Isticmaal
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="px-2 py-1 rounded text-[#EF4444] hover:bg-[#EF4444]/10 transition font-bold"
                  >
                    Masax
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProfitLossStatement({ summary, reportDate }) {
  const totalExpenses = summary.cashSpent + summary.debt + summary.usedStockCost;
  const grossProfit = summary.revenue - summary.usedStockCost;

  return (
    <div className="max-w-4xl mx-auto rounded-xl bg-[#171A1D] border border-[#2A2E33] shadow-2xl overflow-hidden print-area">
      {/* HEADER STATEMENT BANNER */}
      <div className="p-8 bg-[#22262A] border-b border-[#2A2E33] text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A45C]/10 border border-[#C9A45C]/30 text-[#C9A45C] text-xs font-bold uppercase tracking-widest">
          Financial Report
        </div>
        <h2 className="text-3xl font-extrabold text-[#F4EFE6] tracking-tight">Dheeman Restaurant</h2>
        <p className="text-xs text-[#8E9297]">
          Profit & Loss Statement — Date: <span className="text-[#C9A45C] font-semibold">{reportDate}</span>
        </p>
      </div>

      {/* STATEMENT CONTENT */}
      <div className="p-6 space-y-6 text-sm">
        {/* REVENUE SECTION */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#C9A45C] border-b border-[#2A2E33] pb-1">
            1. Income / Revenue (Dakhliga Tooska Ah)
          </div>
          <StatementLine label="Lacagta Iibka Meheradda Soo Gashay" value={summary.revenue} />
          <StatementLine label="Total Operating Income" value={summary.revenue} isTotal />
        </div>

        {/* COGS SECTION */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#A98245] border-b border-[#2A2E33] pb-1">
            2. Cost of Goods Sold (Qiimaha Kaydka La Isticmaalay)
          </div>
          <StatementLine label="Qiimaha Raashinka/Kaydka La Isticmaalay" value={summary.usedStockCost} />
          <StatementLine label="Gross Profit (Faa'iidada Hordhaca Ah)" value={grossProfit} isTotal />
        </div>

        {/* OPERATING EXPENSES SECTION */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#EF4444] border-b border-[#2A2E33] pb-1">
            3. Operating Expenses (Kharashaadka Meheradda)
          </div>
          <StatementLine label="Kharash Cash Ah Oo La Bixiyay" value={summary.cashSpent} />
          <StatementLine label="Dayn Cusub Oo Meheradda Ku Soo Badatay" value={summary.debt} />
          <StatementLine label="Total Operating Expenses" value={totalExpenses} isTotal />
        </div>

        {/* NET PROFIT RESULT BANNER */}
        <div className="pt-4 border-t-2 border-[#2A2E33]">
          <div
            className={`p-5 rounded-lg border flex items-center justify-between text-lg font-extrabold ${
              summary.profit >= 0
                ? "bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]"
                : "bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]"
            }`}
          >
            <span>{summary.profit >= 0 ? "NET PROFIT (FAA'IIDO NADIIF AH)" : "NET LOSS (KHASAARE NADIIF AH)"}</span>
            <span className="text-2xl tracking-tight">{money(summary.profit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatementLine({ label, value, isTotal = false }) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded ${isTotal ? "bg-[#22262A] font-bold text-[#F4EFE6]" : "text-[#8E9297]"}`}>
      <span>{label}</span>
      <span className={isTotal ? "text-[#C9A45C]" : "text-[#F4EFE6]"}>{money(value)}</span>
    </div>
  );
}

/* ==================================================== */
/* MODAL FORMS */
/* ==================================================== */

function ExpenseForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Nooca Lacag Bixinta</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
        >
          <option value="cash">Lacag Cash Ah (Paid)</option>
          <option value="debt">Dayn (Payable Debt)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Waxa La Bixiyay (Sheyga/Adeegga)</label>
        <input
          type="text"
          placeholder="Tusaale: Bariis, Koronto, Mushaar shaqaale"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Lacagta ($)</label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Taariikhda</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Faahfaahin / Xusuusin (Optional)</label>
        <input
          type="text"
          placeholder="Qoraal gaaban..."
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2E33]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-[#22262A] text-[#8E9297] hover:text-[#F4EFE6] text-xs font-bold"
        >
          Kansal
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-extrabold transition shadow-md"
        >
          Kaydi Kharash
        </button>
      </div>
    </form>
  );
}

function StockForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Magaca Sheyga/Raashinka</label>
        <input
          type="text"
          placeholder="Tusaale: Bur, Saliid, Sugar"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Tirada Soo Gashay</label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="10.5"
            value={form.stocked}
            onChange={(e) => setForm({ ...form, stocked: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Unit (Qeexid)</label>
          <input
            type="text"
            placeholder="Kiish, Kartoon, Litir"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Qiimaha Halkii Unit ($)</label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="18.50"
            value={form.unitCost}
            onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Taariikhda</label>
          <input
            type="date"
            value={form.stockedDate}
            onChange={(e) => setForm({ ...form, stockedDate: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2E33]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-[#22262A] text-[#8E9297] hover:text-[#F4EFE6] text-xs font-bold"
        >
          Kansal
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-extrabold transition shadow-md"
        >
          Kaydi Stock
        </button>
      </div>
    </form>
  );
}

function UseStockForm({ form, inventory, setForm, onSubmit, onCancel }) {
  const availableInventory = inventory.filter((item) => item.stocked - item.used > 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Dooro Sheyga La Isticmaalayo</label>
        <select
          value={form.stockId}
          onChange={(e) => setForm({ ...form, stockId: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          required
        >
          <option value="">-- Dooro Shey --</option>
          {availableInventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.item} — {formatQuantity(item.stocked - item.used)} {item.unit} harsan
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Tirada La Isticmaalay</label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="1.5"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Taariikhda</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2E33]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-[#22262A] text-[#8E9297] hover:text-[#F4EFE6] text-xs font-bold"
        >
          Kansal
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-md bg-[#C9A45C] hover:bg-[#D8B46B] text-[#111315] text-xs font-extrabold transition shadow-md"
        >
          Ka Jar Kaydka
        </button>
      </div>
    </form>
  );
}

function SaleForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#8E9297] mb-1">Faahfaahinta Iibka</label>
        <input
          type="text"
          placeholder="Tusaale: Cunto ama Cabitaan iib maalinle ah"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Lacagta Soo Gashay ($)</label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="250.50"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8E9297] mb-1">Taariikhda</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md bg-[#22262A] border border-[#2A2E33] text-[#F4EFE6] text-xs outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2E33]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-[#22262A] text-[#8E9297] hover:text-[#F4EFE6] text-xs font-bold"
        >
          Kansal
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-md bg-[#22C55E] hover:bg-[#16A34A] text-[#111315] text-xs font-extrabold transition shadow-md"
        >
          Kaydi Dakhli
        </button>
      </div>
    </form>
  );
}

function EmptyState({ text }) {
  return (
    <div className="p-8 text-center bg-[#22262A]/40 rounded-lg border border-dashed border-[#2A2E33] space-y-2">
      <BoxIcon className="w-8 h-8 text-[#8E9297] mx-auto opacity-60" />
      <p className="text-xs font-semibold text-[#8E9297]">{text}</p>
    </div>
  );
}

/* ==================================================== */
/* INLINE SVG ICONS */
/* ==================================================== */

function CrownIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
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
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}

function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
