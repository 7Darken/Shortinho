/**
 * Classe de base abstraite pour les providers AI
 * Tous les providers doivent hériter de cette classe et implémenter les méthodes abstraites
 */
export class AIProvider {
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
   * Génère une complétion à partir d'un prompt
   * @param {Object} options - Options de génération
   * @param {string} options.systemPrompt - Prompt système
   * @param {string} options.userPrompt - Prompt utilisateur
   * @param {string} [options.model] - Modèle à utiliser (défaut: defaultModel du provider)
   * @param {number} [options.temperature=0.3] - Température du modèle
   * @param {boolean} [options.jsonMode=true] - Mode JSON pour la réponse
   * @returns {Promise<Object>} Réponse parsée en JSON
   */
  async generateCompletion(options) {
    throw new Error(`generateCompletion() doit être implémenté par ${this.name}`);
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
   * Parse la réponse JSON du provider
   * @param {string} content - Contenu de la réponse
   * @returns {Object} Objet JSON parsé
   */
  parseJsonResponse(content) {
    if (!content) {
      throw new Error('Aucun contenu dans la réponse');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      // Essayer de nettoyer le contenu (certains modèles ajoutent des backticks)
      const cleanedContent = content
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      return JSON.parse(cleanedContent);
    }
  }
}
