/**
 * pages/settings.js — إعدادات المحل + إنشاء فاتورة جديدة
 */
import { settings, invoices, customers } from "../db.js";
import {
  el, money, todayISO, toast, openModal, field,
  emptyState, pageHead,
} from "../utils.js";

export function renderSettings(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الإعدادات", "إعدادات المحل والفواتير",
    "بيانات المحل المستخدمة في الطباعة، وعدّاد أرقام الفواتير، وإصدار فواتير جديدة."));

  const s = settings.get();
  const f = { ...s };
  const card = el("div", { class: "card", style: "max-width:720px" }, [
    el("h3", { style: "margin-top:0" }, "بيانات المحل"),
    field("اسم المحل", el("input", {
      class: "input", value: f.shop_name || "",
      oninput: (e) => f.shop_name = e.target.value,
    })),
    field("اسم الفرع", el("input", {
      class: "input", value: f.branch || "",
      oninput: (e) => f.branch = e.target.value,
    })),
    field("العنوان", el("input", {
      class: "input", value: f.address || "",
      oninput: (e) => f.address = e.target.value,
    })),
    el("div", { class: "grid-2" }, [
      field("الجوال", el("input", {
        class: "input", value: f.phone || "",
        oninput: (e) => f.phone = e.target.value,
      })),
      field("الرقم الضريبي", el("input", {
        class: "input", value: f.tax_no || "",
        oninput: (e) => f.tax_no = e.target.value,
      })),
    ]),
    el("div", { class: "grid-2" }, [
      field("العملة", el("input", {
        class: "input", value: f.currency || "ر.س",
        oninput: (e) => f.currency = e.target.value,
      })),
      field("رقم الفاتورة الحالي", el("input", {
        class: "input", type: "number", value: f.invoice_seq || 1000,
        oninput: (e) => f.invoice_seq = Number(e.target.value),
      }), "آخر رقم تم إصداره. الفاتورة التالية ستكون رقم +1."),
    ]),
    el("div", { style: "text-align:end;margin-top:12px" }, el("button", {
      class: "btn btn-primary",
      onclick: () => {
        settings.update(f);
        toast("تم حفظ الإعدادات");
      },
    }, "حفظ الإعدادات")),
  ]);
  container.appendChild(card);

  // Invoices section
  container.appendChild(el("h2", { style: "margin-top:32px" }, "الفواتير"));
  const tools = el("div", { class: "daily-toolbar" }, [
    el("button", { class: "btn btn-primary",
      onclick: () => openInvoiceForm(renderInvoices) }, "+ فاتورة جديدة"),
    el("div", { class: "spacer" }),
  ]);
  container.appendChild(tools);

  const invBody = el("div", { id: "invList" });
  container.appendChild(invBody);

  function renderInvoices() {
    invBody.innerHTML = "";
    const list = invoices.all().slice().sort((a,b) => (b.no || 0) - (a.no || 0));
    if (!list.length) {
      invBody.appendChild(emptyState("🧾", "لا توجد فواتير بعد."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "رقم"), el("th", {}, "التاريخ"),
      el("th", {}, "العميل"),
      el("th", { class: "num" }, "الإجمالي"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const inv of list) {
      tb.appendChild(el("tr", {}, [
        el("td", {}, "#" + inv.no),
        el("td", {}, inv.date),
        el("td", {}, inv.customer_name || "—"),
        el("td", { class: "num" }, money(inv.total)),
        el("td", {}, [
          el("button", { class: "btn btn-sm btn-primary", style: "margin-inline-end:4px",
            onclick: () => printInvoice(inv) }, "طباعة"),
          el("button", { class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirm("حذف الفاتورة #" + inv.no + "؟")) {
                invoices.remove(inv.id); renderInvoices(); toast("تم الحذف");
              }
            } }, "حذف"),
        ]),
      ]));
    }
    table.appendChild(tb);
    wrap.appendChild(table);
    invBody.appendChild(wrap);
  }
  renderInvoices();
}

function openInvoiceForm(onDone) {
  const cusList = customers.all();
  const f = {
    date: todayISO(),
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    items: [{ description: "", weight: "", unit_price: "", amount: "" }],
    note: "",
  };
  openModal("فاتورة جديدة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      const r1 = el("div", { class: "grid-2" });
      r1.appendChild(field("التاريخ", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));
      const cusSel = el("select", { class: "input",
        onchange: (e) => {
          f.customer_id = e.target.value;
          const c = customers.byId(f.customer_id);
          if (c) { f.customer_name = c.name; f.customer_phone = c.phone || ""; }
          renderForm();
        }});
      cusSel.appendChild(el("option", { value: "" }, "(عميل بدون حساب)"));
      for (const c of cusList) {
        const o = el("option", { value: c.id }, c.name);
        if (c.id === f.customer_id) o.selected = true;
        cusSel.appendChild(o);
      }
      r1.appendChild(field("العميل", cusSel));
      root.appendChild(r1);

      const r2 = el("div", { class: "grid-2" });
      r2.appendChild(field("اسم العميل", el("input", {
        class: "input", value: f.customer_name,
        oninput: (e) => f.customer_name = e.target.value,
      })));
      r2.appendChild(field("الجوال", el("input", {
        class: "input", value: f.customer_phone,
        oninput: (e) => f.customer_phone = e.target.value,
      })));
      root.appendChild(r2);

      // Items
      root.appendChild(el("h4", { style: "margin-top:16px" }, "بنود الفاتورة"));
      f.items.forEach((it, idx) => {
        const ir = el("div", { style: "display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px" }, [
          el("input", { class: "input", placeholder: "البيان", value: it.description,
            oninput: (e) => it.description = e.target.value }),
          el("input", { class: "input", type: "number", step: "0.001", placeholder: "الوزن", value: it.weight,
            oninput: (e) => { it.weight = e.target.value; recalcItem(it); refreshAmt(idx); } }),
          el("input", { class: "input", type: "number", step: "0.01", placeholder: "سعر الجرام", value: it.unit_price,
            oninput: (e) => { it.unit_price = e.target.value; recalcItem(it); refreshAmt(idx); } }),
          el("input", { class: "input amt-" + idx, type: "number", step: "0.01", placeholder: "المبلغ", value: it.amount,
            oninput: (e) => it.amount = e.target.value }),
          el("button", { class: "btn btn-sm btn-danger",
            onclick: () => { f.items.splice(idx, 1); renderForm(); }, title: "حذف" }, "✕"),
        ]);
        root.appendChild(ir);
      });
      root.appendChild(el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: () => { f.items.push({ description:"",weight:"",unit_price:"",amount:"" }); renderForm(); },
      }, "+ بند آخر"));

      const total = f.items.reduce((s,i) => s + (Number(i.amount) || 0), 0);
      root.appendChild(el("div", {
        style: "text-align:end;font-size:18px;font-weight:bold;margin-top:16px;padding-top:10px;border-top:1px solid var(--border)"
      }, "الإجمالي: " + money(total)));

      root.appendChild(field("ملاحظات", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    function refreshAmt(idx) {
      const inp = root.querySelector(".amt-" + idx);
      if (inp) inp.value = f.items[idx].amount;
    }
    renderForm();
  }, {
    onSave: () => {
      if (!f.customer_name.trim()) { toast("أدخل اسم العميل"); return false; }
      const total = f.items.reduce((s,i) => s + (Number(i.amount) || 0), 0);
      if (!total) { toast("أضف بنوداً وأكمل المبالغ"); return false; }
      const inv = invoices.add({
        date: f.date,
        customer_id: f.customer_id,
        customer_name: f.customer_name.trim(),
        customer_phone: f.customer_phone.trim(),
        items: f.items.filter(i => i.description || i.amount),
        total,
        note: f.note.trim(),
      });
      onDone();
      toast("تم إنشاء الفاتورة #" + inv.no);
      // Auto-open print
      setTimeout(() => printInvoice(inv), 200);
    }
  });
}
function recalcItem(it) {
  const w = Number(it.weight), p = Number(it.unit_price);
  if (w && p) it.amount = (w * p).toFixed(2);
}

function printInvoice(inv) {
  const s = settings.get();
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) { toast("اسمح للنوافذ المنبثقة لإتمام الطباعة"); return; }
  const itemsHtml = (inv.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.description || "")}</td>
      <td class="num">${it.weight ? Number(it.weight).toFixed(3) : "—"}</td>
      <td class="num">${it.unit_price ? Number(it.unit_price).toFixed(2) : "—"}</td>
      <td class="num">${money(it.amount)}</td>
    </tr>`).join("");

  win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head>
<meta charset="UTF-8">
<title>فاتورة #${inv.no}</title>
<style>
  body { font-family: 'Tajawal', Arial, sans-serif; padding: 24px; color: #111; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom: 2px solid #c9a961; margin-bottom:18px; }
  .shop-name { font-size:24px; font-weight:bold; color:#8b6914; }
  .meta { text-align:end; }
  .meta div { margin-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin-top:14px; }
  th, td { padding:10px 8px; border-bottom:1px solid #ddd; }
  th { background:#f7f3eb; text-align:start; }
  td.num { text-align:end; font-variant-numeric:tabular-nums; }
  .total-row td { font-weight:bold; background:#fcf8f0; font-size:16px; }
  .footer { margin-top:30px; padding-top:14px; border-top:1px solid #ddd; font-size:12px; color:#666; text-align:center; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="head">
  <div>
    <div class="shop-name">${escapeHtml(s.shop_name || "")}</div>
    <div>${escapeHtml(s.branch || "")}</div>
    <div>${escapeHtml(s.address || "")}</div>
    <div>${s.phone ? "📞 " + escapeHtml(s.phone) : ""}</div>
    ${s.tax_no ? `<div>الرقم الضريبي: ${escapeHtml(s.tax_no)}</div>` : ""}
  </div>
  <div class="meta">
    <div style="font-size:20px;font-weight:bold">فاتورة #${inv.no}</div>
    <div>التاريخ: ${inv.date}</div>
    <div>العميل: ${escapeHtml(inv.customer_name || "")}</div>
    ${inv.customer_phone ? `<div>الجوال: ${escapeHtml(inv.customer_phone)}</div>` : ""}
  </div>
</div>
<table>
  <thead>
    <tr><th>#</th><th>البيان</th><th class="num">الوزن (جم)</th><th class="num">سعر الجرام</th><th class="num">الإجمالي</th></tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
  <tfoot>
    <tr class="total-row"><td colspan="4">الإجمالي</td><td class="num">${money(inv.total)}</td></tr>
  </tfoot>
</table>
${inv.note ? `<div style="margin-top:18px"><strong>ملاحظات:</strong> ${escapeHtml(inv.note)}</div>` : ""}
<div class="footer">شكراً لتعاملكم معنا — الفاتورة من إصدار النظام في ${new Date().toLocaleDateString("ar-SA")}</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
  win.document.close();
}
function escapeHtml(s) { return String(s||"").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
