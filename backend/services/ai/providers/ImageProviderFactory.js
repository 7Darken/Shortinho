/**
 * Factory pour créer et gérer les providers de génération d'images
 * Sélectionne automatiquement le provider selon les variables d'environnement
 */
import { OpenAIImageProvider } from './openai/OpenAIImageProvider.js';
import { GeminiImageProvider } from './gemini/GeminiImageProvider.js';

/**
 * Liste des providers d'images disponibles
 */
const IMAGE_PROVIDERS = {
  openai: OpenAIImageProvider,
  gemini: GeminiImageProvider,
};

/**
 * Provider par défaut si IMAGE_PROVIDER n'est pas défini
 */
const DEFAULT_IMAGE_PROVIDER = 'openai';

/**
 * Instance singleton du provider d'images actif
 * @type {import('./base/ImageProvider.js').ImageProvider|null}
 */
let imageProviderInstance = null;

/**
 * Crée une instance du provider d'images spécifié
 * @param {string} providerName - Nom du provider ('openai', 'gemini')
 * @returns {import('./base/ImageProvider.js').ImageProvider}
 */
export function createImageProvider(providerName) {
  const ProviderClass = IMAGE_PROVIDERS[providerName.toLowerCase()];

  if (!ProviderClass) {
    const availableProviders = Object.keys(IMAGE_PROVIDERS).join(', ');
    throw new Error(
      `Provider d'images "${providerName}" non supporté. Providers disponibles: ${availableProviders}`
    );
  }

  return new ProviderClass();
}

/**
 * Retourne le provider d'images configuré selon les variables d'environnement
 * Utilise IMAGE_PROVIDER si défini, sinon AI_PROVIDER, sinon le défaut (openai)
 * @returns {import('./base/ImageProvider.js').ImageProvider}
 */
export function getImageProvider() {
  if (imageProviderInstance) {
    return imageProviderInstance;
  }

  // Priorité: IMAGE_PROVIDER > AI_PROVIDER > défaut
  const providerName = process.env.IMAGE_PROVIDER || process.env.AI_PROVIDER || DEFAULT_IMAGE_PROVIDER;
  console.log(`🖼️  [Image] Utilisation du provider d'images: ${providerName}`);

  imageProviderInstance = createImageProvider(providerName);
  return imageProviderInstance;
}

/**
 * Retourne le modèle d'image à utiliser selon les variables d'environnement
 * @param {import('./base/ImageProvider.js').ImageProvider} [provider] - Provider optionnel
 * @returns {string}
 */
export function getImageModel(provider) {
  const modelFromEnv = process.env.IMAGE_MODEL;

  if (modelFromEnv) {
    return modelFromEnv;
  }

  const activeProvider = provider || getImageProvider();
  return activeProvider.defaultModel;
}

/**
 * Réinitialise l'instance du provider d'images (utile pour les tests)
 */
export function resetImageProvider() {
  imageProviderInstance = null;
}

/**
 * Retourne la liste des providers d'images disponibles
 * @returns {string[]}
 */
export function getAvailableImageProviders() {
  return Object.keys(IMAGE_PROVIDERS);
}
