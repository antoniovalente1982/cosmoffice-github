#!/bin/bash

# 🚀 Push Cosmoffice to GitHub
# This script pushes the local repository to GitHub

set -e

echo "🌌 Cosmoffice - Push to GitHub"
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "🔧 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Cosmoffice setup"
    echo -e "${GREEN}✓ Git repository initialized${NC}"
else
    echo "✓ Git already initialized"
fi

echo ""
echo "📋 Next steps:"
echo ""
echo "1. Create a repository on GitHub:"
echo "   https://github.com/new"
echo ""
echo "2. Repository name: cosmoffice"
echo "   (don't initialize with README)"
echo ""
echo "3. Get your repository URL (replace USERNAME with your GitHub username):"
echo "   https://github.com/USERNAME/cosmoffice.git"
echo ""

read -p "Enter your GitHub repository URL: " repo_url

echo ""
echo "🔗 Connecting to GitHub..."
git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"

echo ""
echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo ""
echo -e "${GREEN}✅ Successfully pushed to GitHub!${NC}"
echo ""
echo "🌐 Your repository is now at:"
echo "   $repo_url"
echo ""
echo "🚀 Next: Deploy to Vercel"
echo "   npm i -g vercel"
echo "   vercel --prod"
echo ""
