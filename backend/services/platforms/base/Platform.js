/**
 * Classe de base abstraite pour toutes les plateformes de vidéos
 * Définit l'interface commune que chaque plateforme doit implémenter
 */
export class Platform {
  /**
   * Nom de la plateforme (ex: "tiktok", "instagram", "youtube")
   * @type {string}
   */
  name = '';

  /**
   * Pattern regex pour détecter les URLs de cette plateforme
   * @type {RegExp}
   */
  urlPattern = null;

  /**
   * Vérifie si une URL correspond à cette plateforme
   * @param {string} url - URL à vérifier
   * @returns {boolean}
   */
  matches(url) {
    if (!this.urlPattern) {
      throw new Error(`${this.constructor.name} doit définir urlPattern`);
    }
    return this.urlPattern.test(url);
  }

  /**
   * Extrait l'audio d'une vidéo de la plateforme
   * @param {string} url - URL de la vidéo
   * @param {string} outputDir - Dossier de sortie
   * @returns {Promise<string>} Chemin du fichier audio extrait
   * @abstract
   */
  async extractAudio(url, outputDir) {
    throw new Error(`${this.constructor.name} doit implémenter extractAudio()`);
  }

  /**
   * Récupère les métadonnées de la vidéo (titre, description, auteur, etc.)
   * @param {string} url - URL de la vidéo
   * @returns {Promise<Object|null>} Métadonnées ou null
   * @abstract
   */
  async fetchMetadata(url) {
    throw new Error(`${this.constructor.name} doit implémenter fetchMetadata()`);
  }

  /**
   * Nettoie la description de la vidéo (supprime hashtags, emojis, etc.)
   * @param {string} rawText - Texte brut
   * @returns {string} Texte nettoyé
   */
  cleanDescription(rawText) {
    if (!rawText) return '';
    return rawText
      .replace(/\s+/g, ' ') // Supprimer les espaces multiples
      .replace(/#\w+/g, '') // Supprimer les hashtags
      .trim();
  }

  /**
   * Nettoie un fichier temporaire
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<void>}
   */
  async cleanup(filePath) {
    const fs = await import('fs');
    const path = await import('path');

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  [${this.name}] Fichier temporaire supprimé: ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`⚠️  [${this.name}] Erreur lors du nettoyage:`, error.message);
    }
  }
}
