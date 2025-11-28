/**
 * Classe de base abstraite pour les providers de génération d'images
 * Tous les providers d'images doivent hériter de cette classe
 */
export class ImageProvider {
  /**
   * Nom du provider (ex: 'openai', 'gemini')
   * @type {string}
   */
  name = 'base';

  /**
   * Modèle par défaut pour ce provider
   * @type {string}
   */
  defaultModel = '';

  /**
   * Génère une image à partir d'un prompt
   * @param {Object} options - Options de génération
   * @param {string} options.prompt - Description de l'image à générer
   * @param {string} [options.model] - Modèle à utiliser (défaut: defaultModel du provider)
   * @param {string} [options.size='1024x1024'] - Taille de l'image
   * @param {string} [options.quality='standard'] - Qualité de l'image
   * @returns {Promise<string>} URL de l'image générée (temporaire ou base64)
   */
  async generateImage(options) {
    throw new Error(`generateImage() doit être implémenté par ${this.name}`);
  }

  /**
   * Vérifie que les credentials du provider sont configurés
   * @returns {boolean}
   */
  validateCredentials() {
    throw new Error(`validateCredentials() doit être implémenté par ${this.name}`);
  }

  /**
   * Retourne la clé API du provider depuis les variables d'environnement
   * @returns {string|undefined}
   */
  getApiKey() {
    throw new Error(`getApiKey() doit être implémenté par ${this.name}`);
  }

  /**
   * Vérifie si le provider supporte la génération d'images
   * @returns {boolean}
   */
  supportsImageGeneration() {
    return true;
  }
}
