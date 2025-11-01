#!/bin/bash

# Script d'installation du backend Oshii
# Installe yt-dlp, ffmpeg et configure le backend

set -e

echo "╔════════════════════════════════════════╗"
echo "║   Installation Backend Oshii           ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Détecter le système d'exploitation
if [[ "$OSTYPE" == "darwin"* ]]; then
    SYSTEM="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    SYSTEM="linux"
else
    echo "❌ Système non supporté"
    exit 1
fi

echo "🐧 Système détecté: $SYSTEM"
echo ""

# Fonction pour installer via Homebrew
install_homebrew() {
    local package=$1
    if command -v $package &> /dev/null; then
        echo "✅ $package est déjà installé"
        $package --version 2>/dev/null || echo "Version installée"
    else
        echo "📥 Installation de $package via Homebrew..."
        brew install $package
    fi
}

# Fonction pour installer via apt
install_apt() {
    local package=$1
    if command -v $package &> /dev/null; then
        echo "✅ $package est déjà installé"
        $package -version 2>/dev/null || echo "Version installée"
    else
        echo "📥 Installation de $package via apt..."
        sudo apt install -y $package
    fi
}

# Installer selon le système
if [ "$SYSTEM" = "macos" ]; then
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew n'est pas installé"
        echo "💡 Installez Homebrew: https://brew.sh"
        exit 1
    fi
    
    echo "📦 Installation via Homebrew..."
    install_homebrew yt-dlp
    install_homebrew ffmpeg
    
elif [ "$SYSTEM" = "linux" ]; then
    if ! command -v apt &> /dev/null; then
        echo "❌ apt n'est pas installé"
        echo "💡 Utilisez votre gestionnaire de paquets système"
        exit 1
    fi
    
    echo "📦 Installation via apt..."
    install_apt yt-dlp
    install_apt ffmpeg
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Installation terminée !              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🚀 Pour démarrer le backend:"
echo "   npm start"
echo ""
