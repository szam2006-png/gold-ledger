#!/usr/bin/env bash
# =============================================================
#  deploy.sh — نشر «دفتر مدير الفرع» إلى GitHub Pages
# =============================================================
#  الاستخدام:
#    1) عدّل المتغيرين GITHUB_USER و REPO_NAME أدناه.
#    2) shغّل الملف من داخل مجلد gold-ledger:
#         bash deploy.sh
#    3) أول مرة فقط: سيطلب منك Git إدخال اسم مستخدم وكلمة سر
#       (استخدم Personal Access Token من github.com/settings/tokens).
# =============================================================

set -e

GITHUB_USER="ضع_اسم_حسابك_هنا"
REPO_NAME="gold-ledger"
BRANCH="main"
COMMIT_MSG="${1:-deploy $(date +%Y-%m-%d_%H:%M)}"

# تحقق من أنك داخل المجلد الصحيح
if [ ! -f "index.html" ] || [ ! -f "manifest.webmanifest" ]; then
  echo "خطأ: نفّذ هذا السكربت من داخل مجلد gold-ledger" >&2
  exit 1
fi

if [ "$GITHUB_USER" = "ضع_اسم_حسابك_هنا" ]; then
  echo "خطأ: عدّل المتغير GITHUB_USER في أعلى الملف أولاً" >&2
  exit 1
fi

REMOTE="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

# تهيئة الريبو إن لم يكن موجوداً
if [ ! -d ".git" ]; then
  echo "==> تهيئة مستودع Git جديد..."
  git init
  git branch -M "$BRANCH"
fi

# ضبط الـ remote
if git remote | grep -q "^origin$"; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo "==> إضافة الملفات والكوميت..."
git add -A
git commit -m "$COMMIT_MSG" || echo "(لا توجد تغييرات للكوميت)"

echo "==> الدفع إلى $REMOTE ..."
git push -u origin "$BRANCH"

echo
echo "✅ تم الدفع بنجاح."
echo "   الآن افتح: https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/pages"
echo "   واختر Branch: ${BRANCH} و / (root) ثم Save."
echo "   سيظهر تطبيقك خلال دقيقة على:"
echo "   👉 https://${GITHUB_USER}.github.io/${REPO_NAME}/"
