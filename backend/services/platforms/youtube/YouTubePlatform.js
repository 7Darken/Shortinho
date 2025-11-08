/**
 * Implémentation de la plateforme YouTube (Shorts et vidéos classiques)
 */

import { Platform } from '../base/Platform.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

export class YouTubePlatform extends Platform {
  name = 'YouTube';

  // Pattern pour détecter les URLs YouTube Shorts UNIQUEMENT (pas les vidéos normales)
  urlPattern = /^https?:\/\/(www\.)?youtube\.com\/shorts\//i;

  /**
   * Vérifie si yt-dlp est installé
   * @returns {Promise<string>} Version de yt-dlp
   */
  async checkYtDlp() {
    return new Promise((resolve, reject) => {
      const check = spawn('yt-dlp', ['--version'], {
        stdio: 'pipe'
      });

      let output = '';
      check.stdout.on('data', (data) => {
        output += data.toString();
      });

      check.on('close', (code) => {
        if (code === 0 && output) {
          resolve(output.trim());
        } else {
          reject(new Error('yt-dlp non trouvé'));
        }
      });

      check.on('error', () => {
        reject(new Error('yt-dlp non installé'));
      });
    });
  }

  /**
   * Extrait l'ID de la vidéo YouTube Shorts depuis l'URL
   * @param {string} url - URL YouTube Shorts
   * @returns {string|null} ID de la vidéo
   */
  extractVideoId(url) {
    // YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return shortsMatch[1];
    }

    return null;
  }

  /**
   * Extrait l'audio d'un YouTube Short avec yt-dlp
   * @param {string} url - URL YouTube Shorts
   * @param {string} outputDir - Dossier de sortie
   * @returns {Promise<string>} Chemin du fichier audio téléchargé
   */
  async extractAudio(url, outputDir) {
    console.log(`\n🎬 [${this.name}] Début de l'extraction audio...`);
    console.log(`📹 [${this.name}] URL:`, url);
    console.log(`🎞️  [${this.name}] Type: YouTube Shorts`);

    // Vérifier que yt-dlp est installé
    try {
      const version = await this.checkYtDlp();
      console.log(`✅ [${this.name}] yt-dlp trouvé, version:`, version);
    } catch (error) {
      console.error(`❌ [${this.name}] yt-dlp n'est pas installé`);
      throw new Error('yt-dlp est requis pour extraire l\'audio de YouTube. Installez-le avec: brew install yt-dlp (macOS) ou pip install yt-dlp');
    }

    // Créer un nom de fichier unique
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `audio_${timestamp}.%(ext)s`);

    console.log(`📂 [${this.name}] Dossier de sortie:`, outputDir);

    // Configuration yt-dlp pour extraire seulement l'audio
    const ytdlpArgs = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-playlist',
      '--no-warnings',
      '--progress',
      '--console-title',
      '-o', outputPath,
      url,
    ];

    console.log(`⚙️  [${this.name}] Extraction de l'audio en cours...`);

    try {
      const ytdlp = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      await new Promise((resolve, reject) => {
        ytdlp.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp a échoué avec le code ${code}`));
          }
        });

        ytdlp.on('error', (error) => {
          reject(new Error(`Erreur lors de l'exécution de yt-dlp: ${error.message}`));
        });
      });

      // Chercher le fichier créé
      const files = fs.readdirSync(outputDir);
      const audioFile = files.find((file) => file.startsWith(`audio_${timestamp}`));

      if (!audioFile) {
        throw new Error('Fichier audio non créé');
      }

      const fullPath = path.join(outputDir, audioFile);
      const stats = fs.statSync(fullPath);

      console.log(`✅ [${this.name}] Audio extrait avec succès!`);
      console.log(`📄 [${this.name}] Fichier:`, audioFile);
      console.log(`💾 [${this.name}] Taille:`, this.formatBytes(stats.size));

      return fullPath;
    } catch (error) {
      console.error(`❌ [${this.name}] Erreur lors de l'extraction:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les métadonnées YouTube via l'API oEmbed
   * @param {string} url - URL de la vidéo YouTube
   * @returns {Promise<Object|null>} Métadonnées YouTube ou null
   */
  async fetchMetadata(url) {
    try {
      console.log(`🔍 [${this.name}] Récupération métadonnées via oEmbed...`);

      // L'API oEmbed YouTube nécessite une URL de watch, pas de shorts
      // Convertir si nécessaire
      let oembedUrl = url;
      const videoId = this.extractVideoId(url);

      if (videoId && url.includes('/shorts/')) {
        // Convertir l'URL Shorts en URL watch pour oEmbed
        oembedUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`🔄 [${this.name}] Conversion Shorts → Watch pour oEmbed`);
      }

      const apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(oembedUrl)}&format=json`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.warn(`⚠️  [${this.name}] Impossible de récupérer les métadonnées:`, response.status);
        return null;
      }

      const data = await response.json();

      const metadata = {
        title: data.title || '',
        author: data.author_name || '',
        authorUrl: data.author_url || '',
        thumbnailUrl: data.thumbnail_url || '',
        videoId: videoId,
      };

      console.log(`✅ [${this.name}] Métadonnées récupérées`);
      if (metadata.title) {
        console.log(`📝 [${this.name}] Titre:`, metadata.title.substring(0, 100));
      }
      if (metadata.author) {
        console.log(`👤 [${this.name}] Auteur:`, metadata.author);
      }

      return metadata;
    } catch (error) {
      console.error(`❌ [${this.name}] Erreur lors de la récupération des métadonnées:`, error.message);
      return null;
    }
  }

  /**
   * Nettoie la description YouTube (supprime les timestamps, liens, etc.)
   * @param {string} rawText - Texte brut
   * @returns {string} Texte nettoyé
   */
  cleanDescription(rawText) {
    if (!rawText) return '';

    return rawText
      .replace(/\s+/g, ' ') // Espaces multiples
      .replace(/#\w+/g, '') // Hashtags
      .replace(/\d{1,2}:\d{2}/g, '') // Timestamps (ex: 1:23)
      .replace(/https?:\/\/[^\s]+/g, '') // URLs
      .trim();
  }

  /**
   * Formate une taille en bytes en format lisible
   * @param {number} bytes - Taille en bytes
   * @returns {string} Taille formatée
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
