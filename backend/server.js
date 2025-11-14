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
  analyzeRecipeFromVideo,
  cleanupFile,
} from './services/analyzer.js';
import { authenticateToken } from './middlewares/auth.js';
import {
  saveRecipeToDatabase,
  deleteUserAccount,
  getRecipeFromDatabase,
  checkUserCanGenerateRecipe,
  decrementFreeGenerations,
  getExistingRecipeByUrl,
} from './services/database.js';
import { getUserStats } from './services/userStats.js';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUDIO_DIR = path.join(__dirname, 'downloads');

// Map pour tracker les analyses en cours et éviter les doubles générations
// Clé: userId, Valeur: normalizedUrl (URL sans query params)
const activeAnalyses = new Map();

/**
 * Normalise une URL TikTok pour la comparaison (enlève les query params)
 * @param {string} url - URL TikTok
 * @returns {string} - URL normalisée
 */
function normalizeTikTokUrl(url) {
  try {
    return url.split('?')[0]; // Garder seulement l'URL de base
  } catch (error) {
    return url; // Fallback si erreur de parsing
  }
}

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
  const language = req.body.language || 'fr'; // Langue par défaut: français
  const userId = req.user.id;

  // Log de l'utilisateur qui fait la requête
  console.log('👤 [User]', req.user.email || req.user.id);
  console.log('🌐 [Language]', language);


  if (!tiktokUrl || typeof tiktokUrl !== 'string') {
    return res.status(400).json({
      error: 'URL TikTok manquante ou invalide',
      message: 'Veuillez fournir une URL TikTok valide dans le champ "url"',
    });
  }

  // Valider le paramètre language
  if (language && !['fr', 'en'].includes(language)) {
    return res.status(400).json({
      error: 'Langue invalide',
      message: 'La langue doit être "fr" ou "en"',
    });
  }

  // Normaliser l'URL pour la comparaison (enlever les query params)
  const normalizedUrl = normalizeTikTokUrl(tiktokUrl);

  // ⚠️  PROTECTION CONTRE LES DOUBLES GÉNÉRATIONS
  // Vérifier si une analyse est déjà en cours pour cet utilisateur
  if (activeAnalyses.has(userId)) {
    const activeUrl = activeAnalyses.get(userId);
    console.warn('⚠️  [Server] Analyse déjà en cours pour cet utilisateur');
    console.log('📊 [Server] URL en cours:', activeUrl);
    console.log('📊 [Server] URL demandée:', normalizedUrl);
    return res.status(429).json({
      success: false,
      error: 'ANALYSIS_IN_PROGRESS',
      message: 'Une analyse est déjà en cours. Veuillez patienter.',
    });
  }

  // ⚠️  VÉRIFIER SI UNE RECETTE EXISTE DÉJÀ POUR CETTE URL
  // Éviter de relancer une analyse pour une recette déjà générée
  console.log('🔍 [Server] Vérification de recette existante pour URL:', normalizedUrl);
  const existingRecipe = await getExistingRecipeByUrl(userId, tiktokUrl);
  if (existingRecipe) {
    console.warn('⚠️  [Server] Recette déjà existante pour cette URL');
    console.log('📊 [Server] Recette ID:', existingRecipe.id);
    console.log('📊 [Server] Recette titre:', existingRecipe.title);
    console.log('📊 [Server] Créée le:', existingRecipe.created_at);
    
    // Récupérer la recette complète
    const fullRecipe = await getRecipeFromDatabase(existingRecipe.id);
    
    // Préparer la réponse
    const responseData = {
      success: true,
      recipe: fullRecipe,
      user_id: userId,
      alreadyExists: true, // Flag pour indiquer que c'était une recette existante
    };
    
    console.log('📤 [Server] Envoi de la recette existante au frontend...');
    console.log('📊 [Server] Réponse:', {
      success: responseData.success,
      recipeId: responseData.recipe?.id,
      recipeTitle: responseData.recipe?.title,
      hasIngredients: !!responseData.recipe?.ingredients?.length,
      hasSteps: !!responseData.recipe?.steps?.length,
      alreadyExists: responseData.alreadyExists,
    });
    
    res.status(200).json(responseData);
    console.log('✅ [Server] Recette existante envoyée avec succès');
    return; // Important : return pour éviter de continuer l'exécution
  }

  // Marquer l'analyse comme en cours (avec URL normalisée)
  activeAnalyses.set(userId, normalizedUrl);
  console.log('🔒 [Server] Analyse verrouillée pour user:', userId.substring(0, 8));
  console.log('🔒 [Server] URL normalisée:', normalizedUrl);

  console.log('\n🚀 Nouvelle analyse demandée');
  console.log('📹 URL:', tiktokUrl);

  try {
    // ⚠️  VÉRIFICATION DES DROITS DE GÉNÉRATION
    // Vérifier si l'utilisateur peut générer une recette (Premium ou générations gratuites)
    const { canGenerate, isPremium, freeGenerationsRemaining } = await checkUserCanGenerateRecipe(req.user.id);

    if (!canGenerate) {
      console.warn('⛔ [Server] Génération refusée - Limite de générations atteinte');
      // Déverrouiller avant de retourner l'erreur
      activeAnalyses.delete(userId);
      return res.status(403).json({
        success: false,
        error: 'PREMIUM_REQUIRED',
        message: 'Limite de générations gratuites atteinte. Passez à Oshii Premium pour continuer.',
        isPremium,
        freeGenerationsRemaining,
      });
    }

    console.log('✅ [Server] Vérification OK - Démarrage de l\'analyse');
    console.log('💎 [Server] Premium:', isPremium, '| Générations restantes:', freeGenerationsRemaining);
    console.log('');

    // Analyser la recette avec la nouvelle architecture modulaire
    const analysisResult = await analyzeRecipeFromVideo(tiktokUrl, AUDIO_DIR, {
      language, // Langue choisie par l'utilisateur (fr ou en)
    });

    const recipe = analysisResult.recipe;
    const platform = analysisResult.platform; // TikTok, YouTube, Instagram
    const metadata = analysisResult.metadata; // Métadonnées (titre, auteur, thumbnail)

    // Sauvegarder dans Supabase
    console.log('\n💾 SAUVEGARDE: Enregistrement dans Supabase...');
    const savedRecipe = await saveRecipeToDatabase({
      userId: req.user.id,
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      totalTime: recipe.total_time,
      sourceUrl: tiktokUrl,
      platform: platform, // Plateforme source (TikTok, YouTube, Instagram)
      thumbnailUrl: metadata?.thumbnailUrl, // URL du thumbnail depuis fetchMetadata()
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      equipment: recipe.equipment,
      nutrition: recipe.nutrition,
      generationMode: isPremium ? 'premium' : 'free', // Pour les statistiques
      cuisine_origin: recipe.cuisine_origin,
      meal_type: recipe.meal_type,
      diet_type: recipe.diet_type,
      language: language, // Langue pour le matching des food_items
    });
    console.log('✅ Sauvegarde réussie!');

    // Note: Le nettoyage des fichiers temporaires est géré automatiquement par analyzeRecipeFromVideo

    // Retourner la recette avec l'ID de la base de données
    console.log('\n🎉 Analyse terminée avec succès!\n');
    
    // Récupérer la recette complète avec ingrédients et étapes depuis la base
    const fullRecipe = await getRecipeFromDatabase(savedRecipe.id);
    
    // Décrémenter le compteur de générations gratuites si l'utilisateur n'est pas premium
    if (!isPremium) {
      console.log('📉 [Server] Décrémentation du compteur de générations...');
      await decrementFreeGenerations(req.user.id);
    } else {
      console.log('💎 [Server] Utilisateur premium - Pas de décrémentation');
    }
    
    // Préparer la réponse
    const responseData = {
      success: true,
      recipe: fullRecipe,
      user_id: req.user.id,
    };
    
    console.log('📤 [Server] Envoi de la réponse au frontend...');
    console.log('📊 [Server] Réponse:', {
      success: responseData.success,
      recipeId: responseData.recipe?.id,
      recipeTitle: responseData.recipe?.title,
      hasIngredients: !!responseData.recipe?.ingredients?.length,
      hasSteps: !!responseData.recipe?.steps?.length,
    });
    
    res.status(200).json(responseData);
    console.log('✅ [Server] Réponse envoyée avec succès');

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);

    // Note: Le nettoyage des fichiers temporaires est géré automatiquement par analyzeRecipeFromVideo

    // Cas spécial : Le contenu n'est pas une recette
    if (error.code === 'NOT_RECIPE') {
      console.warn('⚠️  [Server] Contenu non-culinaire détecté');
      // Déverrouiller avant de retourner l'erreur
      activeAnalyses.delete(userId);
      return res.status(400).json({
        success: false,
        error: 'NOT_RECIPE',
        message: error.userMessage || 'Ce lien TikTok ne contient pas de recette ou n\'est pas une vidéo culinaire.',
        userMessage: error.userMessage,
      });
    }

    // Autres erreurs (500 Internal Server Error)
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Une erreur est survenue lors de l\'analyse de la recette',
    });
  } finally {
    // ⚠️  DÉVERROUILLER L'ANALYSE (toujours, même en cas d'erreur)
    // Vérifier si le verrou existe encore (peut avoir été déverrouillé dans un return early)
    if (activeAnalyses.has(userId)) {
      activeAnalyses.delete(userId);
      console.log('🔓 [Server] Analyse déverrouillée pour user:', userId.substring(0, 8));
    }
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
 * Endpoint pour obtenir les statistiques utilisateur
 * GET /user/stats
 * Headers: { "Authorization": "Bearer JWT_TOKEN" }
 */
app.get('/user/stats', authenticateToken, async (req, res) => {
  console.log('📊 Demande de statistiques utilisateur');
  console.log('👤 [User]', req.user.email || req.user.id);

  try {
    const stats = await getUserStats(req.user.id);

    console.log('✅ Statistiques calculées avec succès');
    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('❌ Erreur lors du calcul des statistiques:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Une erreur est survenue lors du calcul des statistiques',
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
app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   API Oshii Backend - Recettes TikTok ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log('📡 Endpoints disponibles:');
  console.log('   POST   /analyze     - Analyser une recette TikTok (🔒 Protégé)');
  console.log('   GET    /user/stats  - Statistiques utilisateur (🔒 Protégé)');
  console.log('   DELETE /account     - Supprimer le compte utilisateur (🔒 Protégé)');
  console.log('   GET    /health      - Vérifier l\'état de l\'API');
  console.log('\n✅ Prêt à recevoir des requêtes!\n');
});

