#!/usr/bin/env node

/**
 * Serveur Express pour l'API Oshii Backend
 * Endpoint pour analyser les recettes TikTok
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import {
  extractTikTokAudio,
  transcribeAudio,
  analyzeRecipe,
  cleanupFile,
} from './services/analyzer.js';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUDIO_DIR = path.join(__dirname, 'downloads');

// Middleware
app.use(cors());
app.use(express.json());

// Initialiser le dossier de téléchargement
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  console.log('✅ Dossier de téléchargement créé:', AUDIO_DIR);
}

/**
 * Endpoint principal pour analyser une recette TikTok
 * POST /analyze
 * Body: { "url": "https://www.tiktok.com/..." }
 */
app.post('/analyze', async (req, res) => {
  const tiktokUrl = req.body.url;
  
  if (!tiktokUrl || typeof tiktokUrl !== 'string') {
    return res.status(400).json({
      error: 'URL TikTok manquante ou invalide',
      message: 'Veuillez fournir une URL TikTok valide dans le champ "url"',
    });
  }

  console.log('\n🚀 Nouvelle analyse demandée');
  console.log('📹 URL TikTok:', tiktokUrl);

  let audioPath = null;

  try {
    // Étape 1: Extraire l'audio
    console.log('\n📦 ÉTAPE 1/3: Extraction audio...');
    audioPath = await extractTikTokAudio(tiktokUrl, AUDIO_DIR);
    console.log('✅ Audio extrait:', path.basename(audioPath));

    // Étape 2: Transcrire avec Whisper
    console.log('\n🎤 ÉTAPE 2/3: Transcription Whisper...');
    const transcription = await transcribeAudio(audioPath);
    console.log('✅ Transcription réussie, longueur:', transcription.length, 'caractères');

    // Étape 3: Analyser avec GPT
    console.log('\n🤖 ÉTAPE 3/3: Analyse GPT...');
    const recipe = await analyzeRecipe(transcription);
    console.log('✅ Analyse réussie:', recipe.title);

    // Nettoyer le fichier audio temporaire
    if (audioPath) {
      await cleanupFile(audioPath);
    }

    // Retourner la recette
    console.log('\n🎉 Analyse terminée avec succès!\n');
    
    res.status(200).json({
      success: true,
      recipe: recipe,
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);
    
    // Nettoyer en cas d'erreur
    if (audioPath) {
      await cleanupFile(audioPath);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Une erreur est survenue lors de l\'analyse de la recette',
    });
  }
});

/**
 * Endpoint de santé
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API Oshii Backend est opérationnelle',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Démarrer le serveur
 */
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   API Oshii Backend - Recettes TikTok ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log('📡 Endpoints disponibles:');
  console.log('   POST /analyze - Analyser une recette TikTok');
  console.log('   GET  /health  - Vérifier l\'état de l\'API');
  console.log('\n✅ Prêt à recevoir des requêtes!\n');
});

