#!/bin/bash

# Script de test pour l'extracteur TikTok
# Teste le backend avec un lien TikTok exemple

echo "🧪 Test du backend TikTok Audio Extractor"
echo "========================================"
echo ""

# Remplacer par un vrai lien TikTok pour tester
TIKTOK_URL="https://www.tiktok.com/@account/video/1234567890"

# Tester avec le backend
echo "📝 Test avec le backend..."
echo "URL: $TIKTOK_URL"
echo ""

npm start -- --url "$TIKTOK_URL"

echo ""
echo "✅ Test terminé"
echo "📁 Vérifier le répertoire downloads/ pour le fichier audio"

