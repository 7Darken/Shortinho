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
  fetchTikTokMeta,
  cleanDescription,
} from './services/analyzer.js';
import { authenticateToken } from './middlewares/auth.js';
import { saveRecipeToDatabase, deleteUserAccount, getRecipeFromDatabase } from './services/database.js';

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
 * Headers: { "Authorization": "Bearer JWT_TOKEN" }
 * Body: { "url": "https://www.tiktok.com/..." }
 */
app.post('/analyze', authenticateToken, async (req, res) => {
  const tiktokUrl = req.body.url;
  
  // Log de l'utilisateur qui fait la requête
  console.log('👤 [User]', req.user.email || req.user.id);
  
  
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
    // Étape 0: Récupérer les métadonnées TikTok
    console.log('\n🔍 ÉTAPE 0/5: Récupération métadonnées TikTok...');
    const tiktokMeta = await fetchTikTokMeta(tiktokUrl);
    let tiktokDescription = null;
    if (tiktokMeta && tiktokMeta.title) {
      tiktokDescription = cleanDescription(tiktokMeta.title);
      console.log('✅ Description TikTok:', tiktokDescription.substring(0, 100));
    } else {
      console.log('⚠️  Pas de métadonnées TikTok disponibles');
    }

    // Étape 1: Extraire l'audio
    console.log('\n📦 ÉTAPE 1/5: Extraction audio...');
    audioPath = await extractTikTokAudio(tiktokUrl, AUDIO_DIR);
    console.log('✅ Audio extrait:', path.basename(audioPath));

    // Étape 2: Transcrire avec Whisper
    console.log('\n🎤 ÉTAPE 2/5: Transcription Whisper...');
    const transcription = await transcribeAudio(audioPath);
    console.log('✅ Transcription réussie, longueur:', transcription.length, 'caractères');

    // Étape 3: Analyser avec GPT (avec transcription ET description si disponible)
    console.log('\n🤖 ÉTAPE 3/5: Analyse GPT...');
    const recipe = await analyzeRecipe(transcription, tiktokDescription);
    console.log('✅ Analyse réussie:', recipe.title);

    // Étape 4: Sauvegarder dans Supabase
    console.log('\n💾 ÉTAPE 4/5: Sauvegarde dans Supabase...');
    const savedRecipe = await saveRecipeToDatabase({
      userId: req.user.id,
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      totalTime: recipe.total_time,
      sourceUrl: tiktokUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      equipment: recipe.equipment,
      nutrition: recipe.nutrition,
    });
    console.log('✅ Sauvegarde réussie!');

    // Nettoyer le fichier audio temporaire
    if (audioPath) {
      await cleanupFile(audioPath);
    }

    // Retourner la recette avec l'ID de la base de données
    console.log('\n🎉 Analyse terminée avec succès!\n');
    
    // Récupérer la recette complète avec ingrédients et étapes depuis la base
    const fullRecipe = await getRecipeFromDatabase(savedRecipe.id);
    
    res.status(200).json({
      success: true,
      recipe: fullRecipe,
      user_id: req.user.id,
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
 * Endpoint pour supprimer le compte utilisateur
 * DELETE /account
 * Headers: { "Authorization": "Bearer JWT_TOKEN" }
 */
app.delete('/account', authenticateToken, async (req, res) => {
  console.log('🗑️  Demande de suppression de compte');
  console.log('👤 [User]', req.user.email || req.user.id);

  try {
    const success = await deleteUserAccount(req.user.id);

    if (success) {
      console.log('✅ Compte supprimé avec succès');
      res.status(200).json({
        success: true,
        message: 'Compte supprimé avec succès',
      });
    } else {
      throw new Error('Échec de la suppression du compte');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du compte:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Une erreur est survenue lors de la suppression du compte',
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
  console.log('   POST   /analyze  - Analyser une recette TikTok (🔒 Protégé)');
  console.log('   DELETE /account  - Supprimer le compte utilisateur (🔒 Protégé)');
  console.log('   GET    /health   - Vérifier l\'état de l\'API');
  console.log('\n✅ Prêt à recevoir des requêtes!\n');
});

