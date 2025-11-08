/**
 * Implémentation de la plateforme Instagram (Reels)
 */

import { Platform } from '../base/Platform.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { parse } from 'node-html-parser';

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
   * Récupère les métadonnées Instagram en scrapant le HTML (Open Graph tags)
   * @param {string} url - URL de la vidéo Instagram
   * @returns {Promise<Object|null>} Métadonnées Instagram ou null
   */
  async fetchMetadata(url) {
    try {
      console.log(`🔍 [${this.name}] Scraping du <head> Instagram pour métadonnées...`);

      // Headers pour imiter un navigateur réel et obtenir le HTML complet
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.warn(`⚠️  [${this.name}] Échec de récupération HTML:`, response.status);
        return null;
      }

      const html = await response.text();
      console.log(`📄 [${this.name}] HTML récupéré: ${html.length} caractères`);

      // Parser le HTML
      const root = parse(html);

      // Extraire les balises Open Graph du <head>
      const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogDescription = root.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

      // Utiliser og:title ou og:description comme titre
      const title = ogTitle || ogDescription || '';

      // Extraire l'auteur depuis l'URL
      let author = '';
      let authorUrl = '';

      // Pour les reels: /username/reel/ID ou /reel/ID
      // Pour les posts: /username/p/ID ou /p/ID
      const usernameMatch = url.match(/instagram\.com\/([^\/\?]+)\/(reel|p|tv)\//);
      if (usernameMatch && usernameMatch[1] !== 'reel' && usernameMatch[1] !== 'p' && usernameMatch[1] !== 'tv') {
        author = usernameMatch[1];
        authorUrl = `https://www.instagram.com/${author}/`;
      }

      const metadata = {
        title: title,
        author: author,
        authorUrl: authorUrl,
        thumbnailUrl: ogImage,
      };

      console.log(`✅ [${this.name}] Métadonnées extraites du <head>`);
      if (metadata.thumbnailUrl) {
        console.log(`🖼️  [${this.name}] og:image:`, metadata.thumbnailUrl.substring(0, 80) + '...');
      }
      if (metadata.title) {
        console.log(`📝 [${this.name}] Titre:`, metadata.title.substring(0, 100));
      }
      if (metadata.author) {
        console.log(`👤 [${this.name}] Auteur:`, metadata.author);
      }

      return metadata;
    } catch (error) {
      console.error(`❌ [${this.name}] Erreur lors du scraping des métadonnées:`, error.message);
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
