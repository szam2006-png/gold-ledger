# دليل النشر على GitHub Pages

تطبيق «دفتر مدير الفرع» جاهز للنشر. كل المسارات نسبية، وأُضيف ملف `.nojekyll` ليعمل على GitHub Pages بدون أي معالجة.

---

## الطريقة 1 — من واجهة الموقع (الأسهل، بدون أوامر)

1. افتح [github.com](https://github.com) وسجّل دخولك (أو أنشئ حساب جديد).
2. اضغط **New repository** ↗ أعلى اليمين.
3. اختر اسماً للمستودع، مثلاً: `gold-ledger`.
4. اجعل المستودع **Public** (مطلوب للحساب المجاني لكي يعمل GitHub Pages).
5. **لا تُفعّل** أي إضافة (README/license/.gitignore) — اتركها فارغة.
6. اضغط **Create repository**.
7. في الصفحة التالية اختر **uploading an existing file**.
8. اسحب **كل محتويات** مجلد `gold-ledger` (وليس المجلد نفسه) إلى المتصفح:
   - `index.html`
   - `manifest.webmanifest`
   - `sw.js`
   - `.nojekyll`
   - مجلد `css/`
   - مجلد `js/`
   - مجلد `icons/`
9. اضغط **Commit changes**.
10. اذهب إلى **Settings → Pages** (في القائمة اليسرى).
11. تحت **Source** اختر `Deploy from a branch`.
12. تحت **Branch** اختر `main` و `/ (root)` ثم **Save**.
13. انتظر 1–2 دقيقة، ثم حدّث الصفحة. سيظهر رابط بالشكل:

```
https://<اسم_حسابك>.github.io/gold-ledger/
```

افتح الرابط — سيعمل التطبيق بالكامل. وبعد أول زيارة سيعمل offline أيضاً.

---

## الطريقة 2 — عبر سطر الأوامر (لمن عنده git)

1. أنشئ مستودع فارغ على GitHub باسم `gold-ledger` (نفس خطوات 1–6 أعلاه).
2. افتح Terminal/PowerShell داخل مجلد `gold-ledger` على جهازك ونفّذ:

```bash
git init
git add -A
git commit -m "first deploy"
git branch -M main
git remote add origin https://github.com/<اسم_حسابك>/gold-ledger.git
git push -u origin main
```

3. اذهب إلى **Settings → Pages** في GitHub، واختر `main` و `/ (root)` ثم **Save**.

أو استخدم سكربت `deploy.sh` المرفق (انظر الأسفل).

---

## ملاحظات مهمة

- **التطبيق يعمل offline:** بعد أول تحميل، يُسجَّل الـ Service Worker وتُحفظ الملفات في الكاش، فيشتغل بدون انترنت.
- **البيانات محلية فقط:** كل قيود الدفتر محفوظة في `localStorage` على متصفحك. لا تُرسل لأي خادم.
- **التثبيت كتطبيق:** افتح الرابط من جوّالك أو حاسوبك → سيعرض المتصفح زر «تثبيت التطبيق» (أو من قائمة Share في iOS).
- **النسخ الاحتياطي:** اضغط زر «تصدير نسخة احتياطية» في الصفحة الرئيسية لحفظ ملف JSON على جهازك.
- **التحديثات:** أي رفع جديد على `main` ينعكس على الموقع تلقائياً خلال دقيقة.

---

## بدائل مجانية أخرى (إن أردت)

| المنصة | الميزة | الخطوات |
|---|---|---|
| **Netlify Drop** | بدون حساب جيت | اسحب مجلد `gold-ledger` إلى [app.netlify.com/drop](https://app.netlify.com/drop) |
| **Vercel** | روابط جميلة + سرعة | اربط المستودع من [vercel.com](https://vercel.com) |
| **Cloudflare Pages** | أسرع CDN | من [pages.cloudflare.com](https://pages.cloudflare.com) |
