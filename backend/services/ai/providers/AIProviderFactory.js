/**
 * Factory pour créer et gérer les providers AI
 * Sélectionne automatiquement le provider selon les variables d'environnement
 */
import { OpenAIProvider } from './openai/OpenAIProvider.js';
import { GeminiProvider } from './gemini/GeminiProvider.js';

/**
 * Liste des providers disponibles
 * Pour ajouter un nouveau provider:
 * 1. Créer une classe dans providers/[name]/[Name]Provider.js
 * 2. L'ajouter à cette liste
 */
const PROVIDERS = {
  openai: OpenAIProvider,
  gemini: GeminiProvider,
};

/**
 * Provider par défaut si AI_PROVIDER n'est pas défini
 */
const DEFAULT_PROVIDER = 'openai';

/**
 * Instance singleton du provider actif
 * @type {import('./base/AIProvider.js').AIProvider|null}
 */
let providerInstance = null;

/**
 * Crée une instance du provider spécifié
 * @param {string} providerName - Nom du provider ('openai', 'gemini', etc.)
 * @returns {import('./base/AIProvider.js').AIProvider}
 */
export function createProvider(providerName) {
  const ProviderClass = PROVIDERS[providerName.toLowerCase()];

  if (!ProviderClass) {
    const availableProviders = Object.keys(PROVIDERS).join(', ');
    throw new Error(
      `Provider AI "${providerName}" non supporté. Providers disponibles: ${availableProviders}`
    );
  }

  return new ProviderClass();
}

/**
 * Retourne le provider configuré selon les variables d'environnement
 * Utilise AI_PROVIDER pour déterminer le provider, sinon utilise le défaut (openai)
 * @returns {import('./base/AIProvider.js').AIProvider}
 */
export function getProvider() {
  if (providerInstance) {
    return providerInstance;
  }

  const providerName = process.env.AI_PROVIDER || DEFAULT_PROVIDER;
  console.log(`🔌 [AI] Utilisation du provider: ${providerName}`);

  providerInstance = createProvider(providerName);
  return providerInstance;
}

/**
 * Retourne le modèle à utiliser selon les variables d'environnement
 * Utilise AI_MODEL si défini, sinon le modèle par défaut du provider
 * @param {import('./base/AIProvider.js').AIProvider} [provider] - Provider optionnel
 * @returns {string}
 */
export function getModel(provider) {
  const modelFromEnv = process.env.AI_MODEL;

  if (modelFromEnv) {
    return modelFromEnv;
  }

  const activeProvider = provider || getProvider();
  return activeProvider.defaultModel;
}

/**
 * Réinitialise l'instance du provider (utile pour les tests)
 */
export function resetProvider() {
  providerInstance = null;
}

/**
 * Retourne la liste des providers disponibles
 * @returns {string[]}
 */
export function getAvailableProviders() {
  return Object.keys(PROVIDERS);
}
