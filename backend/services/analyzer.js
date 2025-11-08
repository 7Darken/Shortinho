/**
 * Orchestrateur principal pour l'analyse de recettes depuis différentes plateformes
 * Architecture modulaire permettant l'ajout facile de nouvelles plateformes
 */

import { detectPlatform } from './platforms/PlatformFactory.js';
import { transcribeAudio } from './ai/transcription.js';
import { analyzeRecipe } from './ai/recipeAnalyzer.js';

/**
 * Analyse une recette depuis une URL de vidéo (TikTok, Instagram, etc.)
 * @param {string} videoUrl - URL de la vidéo contenant la recette
 * @param {string} outputDir - Dossier pour les fichiers temporaires
 * @param {Object} options - Options d'analyse
 * @param {string} options.language - Langue de la transcription (défaut: 'fr')
 * @returns {Promise<Object>} Résultat de l'analyse complète
 */
export async function analyzeRecipeFromVideo(videoUrl, outputDir, options = {}) {
  const { language = 'fr' } = options;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         ANALYSE DE RECETTE - MULTI-PLATEFORMES            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let audioPath = null;
  let platform = null;

  try {
    // ÉTAPE 1: Détection de la plateforme
    console.log('🔍 ÉTAPE 1/5: Détection de la plateforme...');
    platform = detectPlatform(videoUrl);
    console.log(`✅ Plateforme: ${platform.name}\n`);

    // ÉTAPE 2: Récupération des métadonnées
    console.log('📋 ÉTAPE 2/5: Récupération des métadonnées...');
    const metadata = await platform.fetchMetadata(videoUrl);
    let description = null;

    if (metadata && metadata.title) {
      description = platform.cleanDescription(metadata.title);
      console.log('✅ Métadonnées récupérées');
      console.log('📝 Description:', description.substring(0, 100) + '...\n');
    } else {
      console.log('⚠️  Pas de métadonnées disponibles\n');
    }

    // ÉTAPE 3: Extraction de l'audio
    console.log('🎵 ÉTAPE 3/5: Extraction de l\'audio...');
    audioPath = await platform.extractAudio(videoUrl, outputDir);
    console.log('✅ Audio extrait avec succès\n');

    // ÉTAPE 4: Transcription avec Whisper
    console.log('🎤 ÉTAPE 4/5: Transcription audio (Whisper)...');
    const transcription = await transcribeAudio(audioPath, { language });
    console.log('✅ Transcription terminée\n');

    // ÉTAPE 5: Analyse de la recette avec GPT
    console.log('🤖 ÉTAPE 5/5: Analyse de la recette (GPT)...');
    const recipe = await analyzeRecipe(transcription, { description });
    console.log('✅ Analyse terminée\n');

    // Nettoyage du fichier audio temporaire
    if (audioPath) {
      await platform.cleanup(audioPath);
    }

    // Résultat final
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   ANALYSE TERMINÉE                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    return {
      success: true,
      platform: platform.name,
      recipe,
      metadata,
      transcription,
    };

  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'analyse:', error.message);

    // Nettoyage en cas d'erreur
    if (audioPath && platform) {
      await platform.cleanup(audioPath);
    }

    throw error;
  }
}

/**
 * Fonction helper pour nettoyer les fichiers temporaires
 * @param {string} filePath - Chemin du fichier à supprimer
 */
export async function cleanupFile(filePath) {
  const fs = await import('fs');
  const path = await import('path');

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Fichier temporaire supprimé: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error('⚠️  Erreur lors du nettoyage:', error.message);
  }
}

// Export des fonctions anciennes pour compatibilité (si nécessaire)
// Ces fonctions sont maintenant deprecated et redirigent vers les nouveaux modules

/**
 * @deprecated Utiliser TikTokPlatform.extractAudio() à la place
 */
export async function extractTikTokAudio(tiktokUrl, outputDir) {
  const { TikTokPlatform } = await import('./platforms/tiktok/TikTokPlatform.js');
  const platform = new TikTokPlatform();
  return platform.extractAudio(tiktokUrl, outputDir);
}

/**
 * @deprecated Utiliser transcribeAudio() de ./ai/transcription.js à la place
 */
export { transcribeAudio };

/**
 * @deprecated Utiliser analyzeRecipe() de ./ai/recipeAnalyzer.js à la place
 */
export { analyzeRecipe };

/**
 * @deprecated Utiliser TikTokPlatform.fetchMetadata() à la place
 */
export async function fetchTikTokMeta(tiktokUrl) {
  const { TikTokPlatform } = await import('./platforms/tiktok/TikTokPlatform.js');
  const platform = new TikTokPlatform();
  return platform.fetchMetadata(tiktokUrl);
}

/**
 * @deprecated Utiliser Platform.cleanDescription() à la place
 */
export function cleanDescription(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/\s+/g, ' ')
    .replace(/#\w+/g, '')
    .trim();
}
