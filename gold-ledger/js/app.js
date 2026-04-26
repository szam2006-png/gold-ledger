/**
 * app.js — نقطة الدخول الرئيسية
 *  - تهيئة قاعدة البيانات
 *  - التوجيه (hash-based)
 *  - السايدبار
 *  - تسجيل Service Worker
 */

/* بُمب الإصدار في كل الـ imports لإجبار جلب جديد عند كل إصدار */
import { initDb, storageStats } from "./db.js?v=12";
import { $, $$, formatDateLong, todayISO } from "./utils.js?v=12";
import { renderHome } from "./pages/home.js?v=12";
import { renderDaily } from "./pages/daily.js?v=12";
import { renderSuppliers } from "./pages/suppliers.js?v=12";
import { renderCustomers } from "./pages/customers.js?v=12";
import { renderBankCash } from "./pages/bank-cash.js?v=12";
import { renderExpenses } from "./pages/expenses.js?v=12";
import { renderAdvances } from "./pages/advances.js?v=12";
import { renderConsignments } from "./pages/consignments.js?v=12";
import { renderInventory } from "./pages/inventory.js?v=12";
import { renderReports } from "./pages/reports.js?v=12";
import { renderSettings } from "./pages/settings.js?v=12";

/* ===== Routes ===== */
const routes = {
  "/":            { title: "الرئيسية",            render: renderHome },
  "/daily":       { title: "دفتر اليومية",        render: renderDaily },
  "/suppliers":   { title: "دفتر الموردين",        render: renderSuppliers },
  "/customers":   { title: "دفتر العملاء",         render: renderCustomers },
  "/bank-cash":   { title: "دفتر البنك والصندوق",  render: renderBankCash },
  "/expenses":    { title: "دفتر المصاريف",        render: renderExpenses },
  "/advances":    { title: "دفتر السلف",           render: renderAdvances },
  "/consignments":{ title: "دفتر العهد",            render: renderConsignments },
  "/inventory":   { title: "دفتر المخزون",         render: renderInventory },
  "/reports":     { title: "التقارير",             render: renderReports },
  "/settings":    { title: "الإعدادات",            render: renderSettings },
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
  $$("#sidebarNav a").forEach(a => {
    a.classList.toggle("active", a.getAttribute("data-route") === path);
  });
  if (window.innerWidth < 961) closeSidebar();
  route.render(view);
  window.scrollTo({ top: 0, behavior: "instant" });
}

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

function renderHeaderDate() {
  const node = $("#headerDate");
  if (node) node.textContent = formatDateLong(todayISO());
}

function renderStorageInfo() {
  const stats = storageStats();
  const el = $("#storageInfo");
  if (el) el.textContent = `التخزين المحلي: ${stats.kb} كيلوبايت`;
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const proto = location.protocol;
  if (proto !== "https:" && location.hostname !== "localhost" && proto !== "file:") return;
  if (proto === "file:") return;
  navigator.serviceWorker
    .register("sw.js")
    .catch(err => console.warn("SW registration failed:", err));
}

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
