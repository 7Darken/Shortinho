# 🚀 Quick Start - Backend TikTok Audio Extractor

## Installation Express (2 minutes)

### Sur macOS

```bash
# 1. Installer yt-dlp
brew install yt-dlp

# 2. Installer les dépendances Node
cd backend
npm install

# 3. Tester
npm start
```

## Usage

### Mode interactif (recommandé)

```bash
npm start
```

Le script demande le lien TikTok. Collez-le.

### Mode direct

```bash
npm start -- -u "https://www.tiktok.com/@chef/video/123456"
```

## Résultat

Le fichier audio est sauvegardé dans :
```
backend/downloads/tiktok_audio_TIMESTAMP.m4a
```

## Tests

Tester avec le script :
```bash
./example-test.sh
```

## Documentation complète

- `README.md` : Documentation complète
- `EXAMPLES.md` : Exemples d'utilisation
- `BACKEND_INTEGRATION.md` : Intégration avec l'app
- `BACKEND_SETUP.md` : Guide de setup rapide

## Aide

En cas de problème :
1. Vérifier que yt-dlp est installé : `yt-dlp --version`
2. Vérifier les logs pour voir l'erreur exacte
3. Consulter `EXAMPLES.md` pour les messages d'erreur

