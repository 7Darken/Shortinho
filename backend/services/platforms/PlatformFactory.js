/**
 * Factory pour détecter et instancier la bonne plateforme selon l'URL
 */

import { TikTokPlatform } from './tiktok/TikTokPlatform.js';
import { InstagramPlatform } from './instagram/InstagramPlatform.js';
import { YouTubePlatform } from './youtube/YouTubePlatform.js';

// Liste de toutes les plateformes supportées
const PLATFORMS = [
  TikTokPlatform,
  InstagramPlatform,
  YouTubePlatform,
  // Ajoutez d'autres plateformes ici (Facebook, Snapchat, etc.)
];

/**
 * Détecte la plateforme appropriée pour une URL donnée
 * @param {string} url - URL de la vidéo
 * @returns {Platform} Instance de la plateforme appropriée
 * @throws {Error} Si aucune plateforme ne correspond à l'URL
 */
export function detectPlatform(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL invalide ou manquante');
  }

  console.log('🔍 [PlatformFactory] Détection de la plateforme pour:', url);

  // Tester chaque plateforme
  for (const PlatformClass of PLATFORMS) {
    const platform = new PlatformClass();

    if (platform.matches(url)) {
      console.log(`✅ [PlatformFactory] Plateforme détectée: ${platform.name}`);
      return platform;
    }
  }

  // Aucune plateforme trouvée
  console.error('❌ [PlatformFactory] Aucune plateforme trouvée pour:', url);
  throw new Error(`Plateforme non supportée pour l'URL: ${url}. Plateformes supportées: ${PLATFORMS.map(P => new P().name).join(', ')}`);
}

/**
 * Obtient la liste des plateformes supportées
 * @returns {Array<{name: string, pattern: string}>}
 */
export function getSupportedPlatforms() {
  return PLATFORMS.map((PlatformClass) => {
    const platform = new PlatformClass();
    return {
      name: platform.name,
      pattern: platform.urlPattern.toString(),
    };
  });
}

/**
 * Vérifie si une URL est supportée
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
export function isSupported(url) {
  try {
    detectPlatform(url);
    return true;
  } catch (error) {
    return false;
  }
}
