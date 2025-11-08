#!/usr/bin/env node

/**
 * Script de test pour récupérer les métadonnées Instagram
 * Test du scraping HTML et extraction des Open Graph tags
 *
 * Usage:
 *   node test-instagram-metadata.js <URL_INSTAGRAM_REEL>
 *
 * Exemples:
 *   node test-instagram-metadata.js https://www.instagram.com/reel/ABC123/
 *   node test-instagram-metadata.js https://www.instagram.com/p/DEF456/
 */

import { InstagramPlatform } from './services/platforms/instagram/InstagramPlatform.js';

/**
 * Affiche l'aide
 */
function showHelp() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      TEST MÉTADONNÉES INSTAGRAM - SCRAPING HTML           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('Usage:');
  console.log('  node test-instagram-metadata.js <URL_INSTAGRAM_REEL>\n');
  console.log('Exemples:');
  console.log('  node test-instagram-metadata.js https://www.instagram.com/reel/ABC123/');
  console.log('  node test-instagram-metadata.js https://www.instagram.com/p/DEF456/');
  console.log('  node test-instagram-metadata.js https://www.instagram.com/tv/GHI789/\n');
  console.log('Ce que ce test fait:');
  console.log('  ✅ Scrape la page HTML Instagram');
  console.log('  ✅ Extrait les Open Graph tags (og:image, og:title, og:description)');
  console.log('  ✅ Affiche toutes les métadonnées récupérées\n');
}

/**
 * Affiche les métadonnées de manière formatée
 */
function displayMetadata(metadata, url) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              MÉTADONNÉES INSTAGRAM RÉCUPÉRÉES               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📱 URL:', url);
  console.log('─'.repeat(60));

  if (metadata) {
    console.log('\n✅ Métadonnées extraites avec succès!\n');

    console.log('📝 TITRE:');
    console.log('  ', metadata.title || '(non disponible)');

    console.log('\n👤 AUTEUR:');
    console.log('  ', metadata.author || '(non disponible)');

    console.log('\n🔗 URL AUTEUR:');
    console.log('  ', metadata.authorUrl || '(non disponible)');

    console.log('\n🖼️  THUMBNAIL URL:');
    console.log('  ', metadata.thumbnailUrl || '(non disponible)');

    // Afficher le JSON complet
    console.log('\n📄 JSON COMPLET:');
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    console.log('\n❌ Aucune métadonnée récupérée');
    console.log('\n💡 Vérifiez:');
    console.log('  - Que l\'URL est correcte');
    console.log('  - Que le Reel/Post est public');
    console.log('  - Votre connexion internet');
  }

  console.log('\n─'.repeat(60));
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

  const instagramUrl = args[0];

  // Vérifier que c'est bien une URL Instagram
  if (!instagramUrl.includes('instagram.com')) {
    console.error('❌ Erreur: L\'URL doit être une URL Instagram (instagram.com)');
    console.error('\n💡 Exemple:');
    console.error('   node test-instagram-metadata.js https://www.instagram.com/reel/ABC123/\n');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      TEST MÉTADONNÉES INSTAGRAM - SCRAPING HTML           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔗 URL à analyser:', instagramUrl);
  console.log('');

  try {
    // Créer une instance de InstagramPlatform
    const platform = new InstagramPlatform();

    // Récupérer les métadonnées
    console.log('🚀 Lancement du scraping...\n');
    const metadata = await platform.fetchMetadata(instagramUrl);

    // Afficher le résultat
    displayMetadata(metadata, instagramUrl);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR lors de la récupération des métadonnées:', error.message);
    console.error('\n💡 Vérifiez:');
    console.error('  - Que l\'URL est correcte et publique');
    console.error('  - Votre connexion internet');
    console.error('  - Que Instagram n\'a pas bloqué votre IP\n');

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
