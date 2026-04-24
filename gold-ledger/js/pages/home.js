/**
 * pages/home.js — الصفحة الرئيسية (Dashboard)
 */

import { daily, exportAll, importAll, storageStats } from "../db.js";
import { el, money, num, todayISO, formatDateLong, toast, $ } from "../utils.js";

export function renderHome(container) {
  container.innerHTML = "";

  container.appendChild(el("div", { class: "page-head" }, [
    el("span", { class: "page-kicker" }, "نظرة عامة"),
    el("h1", { class: "page-title" }, "لوحة التحكم"),
    el("p", { class: "page-subtitle" }, formatDateLong(todayISO())),
  ]));

  container.appendChild(buildKPIs());
  container.appendChild(buildLedgerTiles());
  container.appendChild(buildBackupCard());
}

/* ---------- KPIs ---------- */
function buildKPIs() {
  const today = todayISO();
  const sum = daily.summaryForDate(today);
  const overall = daily.overall();

  // Gold totals across karats+forms (weight)
  let goldIn = 0, goldOut = 0;
  for (const k of ["18", "21", "22", "24"]) {
    for (const f of ["worked", "broken", "pure"]) {
      goldIn  += sum.gold[k][f].in_w;
      goldOut += sum.gold[k][f].out_w;
    }
  }
  // Silver totals
  let silverIn = 0, silverOut = 0;
  for (const k of ["925", "999"]) {
    for (const f of ["worked", "broken", "pure"]) {
      silverIn  += sum.silver[k][f].in_w;
      silverOut += sum.silver[k][f].out_w;
    }
  }
  const cashNet = sum.cash.in - sum.cash.out;

  const wrap = el("div", { class: "kpi-row" });
  wrap.append(
    kpi("قيود اليوم", overall.todayEntries, "قيد"),
    kpi("ذهب اليوم (صافي)", (goldIn - goldOut >= 0 ? "+" : "") + num(goldIn - goldOut), "جرام"),
    kpi("فضة اليوم (صافي)", (silverIn - silverOut >= 0 ? "+" : "") + num(silverIn - silverOut), "جرام"),
    kpiMoney("صافي نقد اليوم", cashNet),
  );
  return wrap;
}

function kpi(label, value, hint) {
  return el("div", { class: "kpi" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value" }, String(value)),
    hint ? el("div", { class: "kpi-hint" }, hint) : null,
  ]);
}
function kpiMoney(label, value) {
  const cls = value > 0 ? "val-pos" : value < 0 ? "val-neg" : "";
  return el("div", { class: "kpi" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + cls },
      (value >= 0 ? "+" : "") + money(value)),
  ]);
}

/* ---------- Ledger Tiles ---------- */
function buildLedgerTiles() {
  const section = el("div", { class: "card", style: "margin-top:28px" });
  section.appendChild(el("h3", {
    style: "margin:0 0 14px;font-family:var(--font-display);font-size:20px",
  }, "الدفاتر"));

  const grid = el("div", { class: "dash-grid" });

  const tiles = [
    { href: "#/daily",     icon: "📓", title: "دفتر اليومية",          desc: "حركات الذهب والفضة والنقد اليومية", ready: true },
    { href: "#/suppliers", icon: "👥", title: "دفتر الموردين",        desc: "حسابات الموردين ومشترياتهم",       ready: false },
    { href: "#/bank-cash", icon: "🏦", title: "دفتر البنك والصندوق",  desc: "حركات البنك والصندوق النقدي",     ready: false },
    { href: "#/expenses",  icon: "🧾", title: "دفتر المصاريف",        desc: "مصاريف تشغيلية وإدارية",         ready: false },
    { href: "#/advances",  icon: "💰", title: "دفتر السلف",           desc: "سلف الموظفين والعملاء",          ready: false },
    { href: "#/inventory", icon: "📦", title: "دفتر المخزون",          desc: "جرد الذهب والفضة الحالي",       ready: false },
  ];

  for (const t of tiles) {
    const a = el("a", {
      href: t.ready ? t.href : "#",
      class: "tile" + (t.ready ? "" : " soon"),
    }, [
      !t.ready ? el("span", { class: "tile-badge" }, "قريباً") : null,
      el("div", { class: "tile-ico" }, t.icon),
      el("div", { class: "tile-title" }, t.title),
      el("p", { class: "tile-desc" }, t.desc),
    ]);
    grid.appendChild(a);
  }

  section.appendChild(grid);
  return section;
}

/* ---------- Backup card ---------- */
function buildBackupCard() {
  const stats = storageStats();
  const card = el("div", { class: "card", style: "margin-top:28px" });

  card.appendChild(el("div", { class: "between mb-12" }, [
    el("h3", {
      style: "margin:0;font-family:var(--font-display);font-size:20px",
    }, "النسخ الاحتياطي"),
    el("span", { class: "text-mute", style: "font-size:13px" },
      `الاستخدام الحالي: ${stats.kb} كيلوبايت`),
  ]));

  card.appendChild(el("p", { class: "text-mute", style: "margin:0 0 16px;font-size:14px" },
    "جميع البيانات محفوظة محلياً على هذا الجهاز فقط. يُنصح بتصدير نسخة احتياطية بانتظام."));

  const row = el("div", { class: "row gap-12" });

  row.appendChild(el("button", {
    class: "btn btn-primary",
    onclick: exportBackup,
  }, "⬇  تصدير نسخة احتياطية"));

  const importBtn = el("button", {
    class: "btn",
    onclick: () => $("#importFile").click(),
  }, "⬆  استيراد نسخة");
  row.appendChild(importBtn);

  const importFile = el("input", {
    id: "importFile",
    type: "file",
    accept: ".json",
    style: "display:none",
    onchange: handleImport,
  });
  row.appendChild(importFile);

  card.appendChild(row);
  return card;
}

function exportBackup() {
  const data = exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gold-ledger-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("تم تصدير النسخة الاحتياطية");
}

function handleImport(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm("سيتم استبدال بيانات الجهاز الحالية. هل تريد المتابعة؟")) return;
      importAll(data);
      toast("تم استيراد البيانات");
      location.reload();
    } catch (e) {
      toast("ملف غير صالح");
    }
  };
  reader.readAsText(file);
  ev.target.value = "";
}
