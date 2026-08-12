"use client";

import React from "react";

function money(val) {
  const num = Number(val) || 0;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExcelMarketGrid({ debts = [], onPay, onDelete, onEdit }) {
  if (!Array.isArray(debts) || debts.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
        <p className="text-xs text-slate-500 font-medium">
          Wax xog ah lama helin maalintan.
        </p>
        <p className="text-[11px] text-slate-400">
          Isticmaal foomka sare si aad ugu soo darto iib ama dayn cusub.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
          <tr>
            <th className="py-3 px-4 w-10">#</th>
            <th className="py-3 px-4">Magaca Shayga / Faahfaahinta</th>
            <th className="py-3 px-4">Taariikhda</th>
            <th className="py-3 px-4 text-right">Qiimaha Guud</th>
            <th className="py-3 px-4 text-right">La Bixiyay</th>
            <th className="py-3 px-4 text-right">Baaqiga Daynta</th>
            <th className="py-3 px-4 text-center">Xaaladda</th>
            <th className="py-3 px-4 text-right">Hawgallada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
          {debts.map((d, index) => {
            const total = Number(d.totalAmount) || 0;
            const paid = Number(d.paidAmount) || 0;
            const pending = Math.max(total - paid, 0);

            return (
              <tr key={d.id || index} className="hover:bg-slate-50/80 transition">
                <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                <td className="py-3 px-4 font-semibold text-slate-900">
                  <div>{d.itemDescription}</div>
                  {d.notes && <div className="text-[11px] text-slate-400 font-normal">{d.notes}</div>}
                </td>
                <td className="py-3 px-4 text-slate-500">{d.debtDate || "—"}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{money(total)}</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">{money(paid)}</td>
                <td className="py-3 px-4 text-right font-extrabold text-rose-600">
                  {money(pending)}
                </td>
                <td className="py-3 px-4 text-center">
                  {d.status === "paid" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ La Bixiyay
                    </span>
                  ) : d.status === "partial" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Qayb Bixis
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Dayn Dhiman
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {d.status !== "paid" && onPay && (
                      <button
                        onClick={() => onPay(d)}
                        className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition"
                      >
                        Bixi Dayn
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(d)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition"
                      >
                        Beddel
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(d.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition"
                        title="Tirtir"
                      >
                        Tirtir
                      </button>
                    )}
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
