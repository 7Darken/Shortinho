/**
 * Implémentation de la plateforme Instagram (Reels)
 */

import { Platform } from '../base/Platform.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

export class InstagramPlatform extends Platform {
  name = 'Instagram';

  // Pattern pour détecter les URLs Instagram
  urlPattern = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//i;

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
   * Extrait l'audio d'une vidéo Instagram Reel avec yt-dlp
   * @param {string} url - URL Instagram
   * @param {string} outputDir - Dossier de sortie
   * @returns {Promise<string>} Chemin du fichier audio téléchargé
   */
  async extractAudio(url, outputDir) {
    console.log(`\n🎬 [${this.name}] Début de l'extraction audio...`);
    console.log(`📹 [${this.name}] URL:`, url);

    // Déterminer le type de contenu
    const isReel = url.includes('/reel/');
    const isPost = url.includes('/p/');
    const isTv = url.includes('/tv/');

    if (isReel) {
      console.log(`🎞️  [${this.name}] Type: Instagram Reel`);
    } else if (isPost) {
      console.log(`🎞️  [${this.name}] Type: Instagram Post`);
    } else if (isTv) {
      console.log(`🎞️  [${this.name}] Type: Instagram TV`);
    }

    // Vérifier que yt-dlp est installé
    try {
      const version = await this.checkYtDlp();
      console.log(`✅ [${this.name}] yt-dlp trouvé, version:`, version);
    } catch (error) {
      console.error(`❌ [${this.name}] yt-dlp n'est pas installé`);
      throw new Error('yt-dlp est requis pour extraire l\'audio d\'Instagram. Installez-le avec: brew install yt-dlp (macOS) ou pip install yt-dlp');
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
   * Récupère les métadonnées Instagram via l'API oEmbed
   * @param {string} url - URL de la vidéo Instagram
   * @returns {Promise<Object|null>} Métadonnées Instagram ou null
   */
  async fetchMetadata(url) {
    try {
      console.log(`🔍 [${this.name}] Récupération métadonnées via oEmbed...`);

      // Instagram oEmbed API
      // Documentation: https://developers.facebook.com/docs/instagram/oembed
      const oembedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=&omitscript=true`;

      // Note: Instagram oEmbed ne nécessite pas toujours un access_token pour les contenus publics
      // On peut aussi essayer l'ancienne API
      const fallbackOembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;

      let response = await fetch(fallbackOembedUrl);

      // Si l'ancienne API ne fonctionne pas, essayer avec la nouvelle (peut nécessiter un token)
      if (!response.ok) {
        console.log(`⚠️  [${this.name}] Tentative avec l'API principale...`);
        response = await fetch(oembedUrl);
      }

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
