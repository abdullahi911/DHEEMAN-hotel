"use client";

import React from "react";

export default function MarketModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  isEditing = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 z-10 space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? "Wax ka Beddel Suuqa" : "Ku Soo Dar Suuq Cusub"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Geli macluumaadka suuqa ama bakhaarka aad daynta ka soo qaadato.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 1. Magaca Suuqa / Bakhaarka */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Magaca Suuqa / Bakhaarka <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Tusaale: Bakhaarka Xamdi, Suuqa Bakaaraha..."
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50/50 focus:bg-white"
              required
              autoFocus
            />
          </div>

          {/* 2. Magaca Shayga (Product Name) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Magaca Shayga <span className="text-slate-400 font-normal">(Product Name)</span>
            </label>
            <input
              type="text"
              placeholder="Tusaale: Bariis, Sonkor, Bur, Saliid..."
              value={form.productName ?? form.itemDescription ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  productName: e.target.value,
                  itemDescription: e.target.value,
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* 3. Telefanka / Nambarka Xiriirka */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefanka / Nambarka Xiriirka <span className="text-slate-400 font-normal">(Supplier Phone)</span>
            </label>
            <input
              type="tel"
              placeholder="Tusaale: 061XXXXXXX"
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* 4. Qiimaha Alaabta Lagu Iibsaday */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Qiimaha Alaabta Lagu Iibsaday <span className="text-slate-400 font-normal">(Purchase Amount)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.purchaseAmount ?? form.address ?? ""}
                onChange={(e) => setForm({ ...form, purchaseAmount: e.target.value, address: e.target.value })}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50/50 focus:bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Wadarta lacagta alaabta ama raashinka loogu soo iibsaday suuqa ama bakhaarkan.
            </p>
          </div>

          {/* 5. Xusuusin / Faahfaahin */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Xusuusin / Faahfaahin <span className="text-slate-400 font-normal">(Notes)</span>
            </label>
            <textarea
              placeholder="Faahfaahin dheeraad ah oo ku saabsan suuqa ama maamulaha..."
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition h-20 bg-slate-50/50 focus:bg-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Jooji
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm active:scale-[0.98]"
            >
              {isEditing ? "Kaydi Beddelka" : "Ku Soo Dar Suuq"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
