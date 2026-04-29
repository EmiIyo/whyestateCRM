#!/bin/bash
# Quick push script for why-estate-crm
# Usage: ./push.sh "your commit message"
# Or just: ./push.sh  (uses a default timestamp message)

MSG="${1:-Update: $(date '+%Y-%m-%d %H:%M')}"

cd "$(dirname "$0")"

echo "📦 Staging all changes..."
git add -A

echo "💬 Committing: $MSG"
git commit -m "$MSG"

echo "🚀 Pushing to GitHub..."
git push github main

echo "✅ Done! https://github.com/linuxlinwhy/why-estate-crm"
