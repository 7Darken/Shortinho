# Guide de Test - Analyse de Recettes

Ce guide explique comment tester le workflow complet d'analyse de recettes en local.

## 🧪 Script de Test

Le fichier `test-analyze.js` permet de tester une analyse complète **sans serveur** et **sans base de données**.

### Utilisation

```bash
# Afficher l'aide
npm run test:analyze -- --help

# Tester avec une URL TikTok
npm run test:analyze https://www.tiktok.com/@chef/video/123456

# Tester avec une URL YouTube Shorts
npm run test:analyze https://www.youtube.com/shorts/abc123

# Tester avec une URL Instagram Reel
npm run test:analyze https://www.instagram.com/reel/ABC123/

# Afficher aussi le JSON complet (pour debug)
npm run test:analyze <URL> --json
```

### Prérequis

1. **Variables d'environnement** : Créez un fichier `.env` avec :
   ```env
   OPENAI_API_KEY=votre_clé_api_openai
   ```

2. **Dépendances système** :
   ```bash
   # macOS
   brew install yt-dlp ffmpeg

   # Linux
   sudo apt install ffmpeg
   pip install yt-dlp
   ```

3. **Dépendances Node.js** :
   ```bash
   npm install
   ```

## 📋 Ce que le test vérifie

Le script teste **tout le workflow** :

1. ✅ **Détection de plateforme** (TikTok, YouTube, Instagram)
2. ✅ **Récupération des métadonnées** (titre, auteur, thumbnail)
3. ✅ **Extraction de l'audio** avec yt-dlp
4. ✅ **Transcription** avec OpenAI Whisper
5. ✅ **Analyse** avec GPT-4o-mini
6. ✅ **Extraction structurée** (ingrédients, étapes, nutrition, etc.)
7. ✅ **Nettoyage** des fichiers temporaires

## 📊 Résultat Attendu

Le script affiche un résultat détaillé :

```
╔════════════════════════════════════════════════════════════╗
║                   RÉSULTAT DE L'ANALYSE                    ║
╚════════════════════════════════════════════════════════════╝

📱 PLATEFORME: TikTok
────────────────────────────────────────────────────────────

📋 MÉTADONNÉES:
  Titre: Recette de gâteau au chocolat facile ! #cuisine
  Auteur: @chef_cuisine
  Thumbnail: https://...

📝 TRANSCRIPTION:
  Longueur: 450 caractères
  Extrait: Bonjour à tous ! Aujourd'hui je vous montre...

╔════════════════════════════════════════════════════════════╗
║                       RECETTE EXTRAITE                      ║
╚════════════════════════════════════════════════════════════╝

🍳 GÂTEAU AU CHOCOLAT FACILE
────────────────────────────────────────────────────────────
👥 Portions: 6
⏱️  Préparation: 15 min
🔥 Cuisson: 30 min
⏰ Total: 45 min
🌍 Origine: française
🍽️  Type de repas: dessert

🛠️  ÉQUIPEMENTS (3):
   1. four
   2. mixeur
   3. moule à gâteau

🥘 INGRÉDIENTS (8):
   1. chocolat noir 200g
   2. beurre 100g
   3. sucre 150g
   4. farine 100g
   5. œufs 4
   ...

📝 ÉTAPES (5):
   Étape 1: Préchauffer le four à 180°C
   🌡️  Température: 180°C

   Étape 2: Faire fondre le chocolat et le beurre au bain-marie
   ⏱️  Durée: 5 min
   🥕 Ingrédients: chocolat noir, beurre
   ...

╔════════════════════════════════════════════════════════════╗
║                    VALEURS NUTRITIONNELLES                  ║
╚════════════════════════════════════════════════════════════╝

🔥 Calories: 1800 kcal
💪 Protéines: 45 g
🍞 Glucides: 200 g
🥑 Lipides: 85 g

────────────────────────────────────────────────────────────
✅ Analyse terminée avec succès!
```

## 🐛 Dépannage

### Erreur : OPENAI_API_KEY non définie

```bash
❌ Erreur: OPENAI_API_KEY non définie dans le fichier .env
```

**Solution** : Créez un fichier `.env` avec votre clé API OpenAI.

### Erreur : yt-dlp non installé

```bash
❌ [TikTok] yt-dlp n'est pas installé
```

**Solution** :
```bash
# macOS
brew install yt-dlp

# Linux/Windows
pip install yt-dlp
```

### Erreur : ffmpeg non trouvé

```bash
❌ Erreur lors de l'extraction: ffmpeg non trouvé
```

**Solution** :
```bash
# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### Erreur : Plateforme non supportée

```bash
❌ [PlatformFactory] Aucune plateforme trouvée pour: https://...
```

**Solution** : Vérifiez que l'URL est bien d'une plateforme supportée (TikTok, YouTube, Instagram).

### Erreur : Video unavailable

```bash
❌ yt-dlp a échoué avec le code 1
```

**Solutions** :
- Vérifiez que la vidéo est **publique**
- Vérifiez que l'URL est correcte
- Essayez de mettre à jour yt-dlp : `yt-dlp -U`

## 📝 Notes

### Coûts API

Chaque test consomme des crédits OpenAI :
- **Whisper** : ~$0.006 par minute d'audio
- **GPT-4o-mini** : ~$0.00015 par 1K tokens

Une vidéo de 1 minute coûte environ **$0.01** à analyser.

### Fichiers Temporaires

Les fichiers audio sont stockés dans `downloads/` et **automatiquement supprimés** après l'analyse.

### Mode Debug

Pour voir le JSON complet de la réponse GPT :

```bash
npm run test:analyze <URL> --json
```

## ✅ Checklist de Test

Avant de déployer en production, testez :

- [ ] TikTok : Vidéo de recette courte (< 1 min)
- [ ] YouTube Shorts : Vidéo de recette courte
- [ ] Instagram Reel : Vidéo de recette publique
- [ ] Vidéo avec ingrédients clairs
- [ ] Vidéo avec étapes détaillées
- [ ] Vidéo en français
- [ ] Vidéo en anglais (tester avec `language: 'en'`)
- [ ] Vidéo non-recette (doit retourner `NOT_RECIPE`)

## 🚀 Tests Automatisés

### Test de Détection de Plateformes

```bash
npm run test:platforms
```

Vérifie que toutes les URLs sont correctement détectées.

### Test d'Analyse Complète

```bash
npm run test:analyze <URL>
```

Vérifie que le workflow complet fonctionne de bout en bout.

### Test de Métadonnées Instagram

```bash
npm run test:instagram <URL_INSTAGRAM_REEL>
```

Teste uniquement la récupération des métadonnées Instagram (scraping HTML, Open Graph tags).

**Exemple:**
```bash
npm run test:instagram https://www.instagram.com/reel/ABC123/
```

**Ce que le test affiche:**
- 📝 Titre (og:title ou og:description)
- 👤 Auteur
- 🔗 URL de l'auteur
- 🖼️ URL du thumbnail (og:image)
- 📄 JSON complet des métadonnées
