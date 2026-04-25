/**
 * app.js — نقطة الدخول الرئيسية
 *  - تهيئة قاعدة البيانات
 *  - التوجيه (hash-based)
 *  - السايدبار
 *  - تسجيل Service Worker
 */

import { initDb, storageStats } from "./db.js";
import { $, $$, formatDateLong, todayISO } from "./utils.js";
import { renderHome } from "./pages/home.js";
import { renderDaily } from "./pages/daily.js";
import { renderSuppliers } from "./pages/suppliers.js";
import { renderBankCash } from "./pages/bank-cash.js";
import { renderExpenses } from "./pages/expenses.js";
import { renderAdvances } from "./pages/advances.js";
import { renderConsignments } from "./pages/consignments.js";
import { renderInventory } from "./pages/inventory.js";
import { renderReports } from "./pages/reports.js";
import { renderSettings } from "./pages/settings.js";

/* ===== Routes ===== */
const routes = {
  "/":          { title: "الرئيسية",            render: renderHome },
  "/daily":     { title: "دفتر اليومية",        render: renderDaily },
  "/suppliers": { title: "دفتر الموردين",        render: renderSuppliers },
  "/bank-cash": { title: "دفتر البنك والصندوق",  render: renderBankCash },
  "/expenses":  { title: "دفتر المصاريف",        render: renderExpenses },
  "/advances":    { title: "دفتر السلف",           render: renderAdvances },
  "/consignments":{ title: "دفتر العهد",            render: renderConsignments },
  "/inventory":   { title: "دفتر المخزون",         render: renderInventory },
  "/reports":   { title: "التقارير",             render: renderReports },
  "/settings":  { title: "الإعدادات",            render: renderSettings },
};

function parseRoute() {
  let hash = location.hash.replace(/^#/, "") || "/";
  if (!routes[hash]) hash = "/";
  return hash;
}

function navigate() {
  const path = parseRoute();
  const route = routes[path];
  const view = $("#view");
  document.title = route.title + " · دفتر مدير الفرع";

  // Update active nav link
  $$("#sidebarNav a").forEach(a => {
    a.classList.toggle("active", a.getAttribute("data-route") === path);
  });

  // Close sidebar on mobile
  if (window.innerWidth < 961) closeSidebar();

  // Render
  route.render(view);
  // Scroll top
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ===== Sidebar (mobile) ===== */
function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#sidebarBackdrop").classList.add("show");
  $("#sidebar").setAttribute("aria-hidden", "false");
}
function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").classList.remove("show");
  $("#sidebar").setAttribute("aria-hidden", "true");
}

/* ===== Header date ===== */
function renderHeaderDate() {
  const node = $("#headerDate");
  if (node) node.textContent = formatDateLong(todayISO());
}

/* ===== Storage info in sidebar ===== */
function renderStorageInfo() {
  const stats = storageStats();
  const el = $("#storageInfo");
  if (el) el.textContent = `التخزين المحلي: ${stats.kb} كيلوبايت`;
}

/* ===== Service Worker ===== */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const proto = location.protocol;
  if (proto !== "https:" && location.hostname !== "localhost" && proto !== "file:") return;
  if (proto === "file:") return;
  navigator.serviceWorker
    .register("sw.js")
    .catch(err => console.warn("SW registration failed:", err));
}

/* ===== Init ===== */
function boot() {
  initDb();
  renderHeaderDate();
  renderStorageInfo();

  $("#menuBtn")?.addEventListener("click", openSidebar);
  $("#closeSidebar")?.addEventListener("click", closeSidebar);
  $("#sidebarBackdrop")?.addEventListener("click", closeSidebar);

  window.addEventListener("hashchange", navigate);
  navigate();

  setInterval(renderStorageInfo, 15000);
  registerSW();
}

document.addEventListener("DOMContentLoaded", boot);
