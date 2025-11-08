#!/usr/bin/env node

/**
 * Script de test pour analyser une recette vidéo en local
 * Test complet du workflow sans enregistrer dans la base de données
 *
 * Usage:
 *   node test-analyze.js <URL_VIDEO>
 *
 * Exemples:
 *   node test-analyze.js https://www.tiktok.com/@chef/video/123456
 *   node test-analyze.js https://www.youtube.com/shorts/abc123
 *   node test-analyze.js https://www.instagram.com/reel/ABC123/
 */

import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyzeRecipeFromVideo } from './services/analyzer.js';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, 'downloads');

/**
 * Affiche l'aide
 */
function showHelp() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST D\'ANALYSE DE RECETTE - MODE LOCAL            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('Usage:');
  console.log('  node test-analyze.js <URL_VIDEO>\n');
  console.log('Exemples:');
  console.log('  node test-analyze.js https://www.tiktok.com/@chef/video/123456');
  console.log('  node test-analyze.js https://www.youtube.com/shorts/abc123');
  console.log('  node test-analyze.js https://www.instagram.com/reel/ABC123/\n');
  console.log('Plateformes supportées:');
  console.log('  ✅ TikTok (tiktok.com, vm.tiktok.com)');
  console.log('  ✅ YouTube (youtube.com/shorts, youtube.com/watch, youtu.be)');
  console.log('  ✅ Instagram (instagram.com/reel, instagram.com/p, instagram.com/tv)\n');
  console.log('Variables d\'environnement requises dans .env:');
  console.log('  OPENAI_API_KEY=votre_clé_api_openai\n');
}

/**
 * Affiche le résultat de l'analyse de manière formatée
 */
function displayResult(result) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                   RÉSULTAT DE L\'ANALYSE                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const { platform, recipe, metadata, transcription } = result;

  // Informations de la plateforme
  console.log('📱 PLATEFORME:', platform);
  console.log('─'.repeat(60));

  // Métadonnées
  if (metadata && metadata.title) {
    console.log('\n📋 MÉTADONNÉES:');
    console.log('  Titre:', metadata.title);
    if (metadata.author) {
      console.log('  Auteur:', metadata.author);
    }
    if (metadata.thumbnailUrl) {
      console.log('  Thumbnail:', metadata.thumbnailUrl.substring(0, 60) + '...');
    }
  }

  // Transcription
  if (transcription) {
    console.log('\n📝 TRANSCRIPTION:');
    console.log('  Longueur:', transcription.length, 'caractères');
    console.log('  Extrait:', transcription.substring(0, 200) + '...');
  }

  // Recette
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                       RECETTE EXTRAITE                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🍳', recipe.title.toUpperCase());
  console.log('─'.repeat(60));

  // Informations générales
  if (recipe.servings) {
    console.log('👥 Portions:', recipe.servings);
  }
  if (recipe.prep_time) {
    console.log('⏱️  Préparation:', recipe.prep_time);
  }
  if (recipe.cook_time) {
    console.log('🔥 Cuisson:', recipe.cook_time);
  }
  if (recipe.total_time) {
    console.log('⏰ Total:', recipe.total_time);
  }

  // Classification
  if (recipe.cuisine_origin) {
    console.log('🌍 Origine:', recipe.cuisine_origin);
  }
  if (recipe.meal_type) {
    console.log('🍽️  Type de repas:', recipe.meal_type);
  }
  if (recipe.diet_type && recipe.diet_type.length > 0) {
    console.log('🥗 Régime:', recipe.diet_type.join(', '));
  }

  // Équipements
  if (recipe.equipment && recipe.equipment.length > 0) {
    console.log(`\n🛠️  ÉQUIPEMENTS (${recipe.equipment.length}):`);
    recipe.equipment.forEach((eq, idx) => {
      console.log(`   ${idx + 1}. ${eq}`);
    });
  }

  // Ingrédients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    console.log(`\n🥘 INGRÉDIENTS (${recipe.ingredients.length}):`);
    recipe.ingredients.forEach((ing, idx) => {
      const qty = ing.quantity || '';
      const unit = ing.unit || '';
      const qtyStr = (qty && unit) ? ` ${qty}${unit}` : qty ? ` ${qty}` : '';
      console.log(`   ${idx + 1}. ${ing.name}${qtyStr}`);
    });
  }

  // Étapes
  if (recipe.steps && recipe.steps.length > 0) {
    console.log(`\n📝 ÉTAPES (${recipe.steps.length}):`);
    recipe.steps.forEach((step) => {
      console.log(`\n   Étape ${step.order}: ${step.text}`);
      if (step.duration) {
        console.log(`   ⏱️  Durée: ${step.duration}`);
      }
      if (step.temperature) {
        console.log(`   🌡️  Température: ${step.temperature}`);
      }
      if (step.ingredients_used && step.ingredients_used.length > 0) {
        console.log(`   🥕 Ingrédients: ${step.ingredients_used.join(', ')}`);
      }
    });
  }

  // Nutrition
  if (recipe.nutrition) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    VALEURS NUTRITIONNELLES                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    const nutrition = recipe.nutrition;
    if (nutrition.calories) {
      console.log('🔥 Calories:', nutrition.calories, 'kcal');
    }
    if (nutrition.proteins) {
      console.log('💪 Protéines:', nutrition.proteins, 'g');
    }
    if (nutrition.carbs) {
      console.log('🍞 Glucides:', nutrition.carbs, 'g');
    }
    if (nutrition.fats) {
      console.log('🥑 Lipides:', nutrition.fats, 'g');
    }
  }

  console.log('\n─'.repeat(60));
  console.log('✅ Analyse terminée avec succès!\n');
}

/**
 * Fonction principale
 */
async function main() {
  // Vérifier les arguments
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const videoUrl = args[0];

  // Vérifier que OPENAI_API_KEY est définie
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Erreur: OPENAI_API_KEY non définie dans le fichier .env');
    console.error('\n💡 Créez un fichier .env avec:');
    console.error('   OPENAI_API_KEY=votre_clé_api_openai\n');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST D\'ANALYSE DE RECETTE - MODE LOCAL            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔗 URL à analyser:', videoUrl);
  console.log('');

  try {
    // Lancer l'analyse complète
    const result = await analyzeRecipeFromVideo(videoUrl, AUDIO_DIR, {
      language: 'fr',
    });

    // Afficher le résultat
    displayResult(result);

    // Afficher le JSON complet (optionnel, pour debug)
    if (args.includes('--json')) {
      console.log('\n📄 JSON COMPLET:');
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'analyse:', error.message);
    console.error('\n💡 Vérifiez:');
    console.error('  - Que yt-dlp est installé: yt-dlp --version');
    console.error('  - Que ffmpeg est installé: ffmpeg -version');
    console.error('  - Que OPENAI_API_KEY est valide dans .env');
    console.error('  - Que l\'URL est correcte et publique\n');

    if (error.stack) {
      console.error('📋 Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Lancer le script
main().catch((error) => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});
