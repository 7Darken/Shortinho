/**
 * Service de génération d'images de plats cuisinés
 * Utilise l'architecture modulaire des providers d'images (DALL-E, Imagen)
 */

import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import { getImageProvider, getImageModel } from './providers/ImageProviderFactory.js';
import { supabase } from '../database.js';

/**
 * Construit le prompt pour générer une image de plat cuisiné
 * @param {string} recipeTitle - Titre de la recette
 * @param {string[]} ingredients - Liste des ingrédients principaux
 * @param {string} cuisineOrigin - Origine culinaire (optionnel)
 * @param {string} language - Langue ('fr' ou 'en')
 * @returns {string} Prompt optimisé pour la génération d'image
 */
function buildImagePrompt(recipeTitle, ingredients = [], cuisineOrigin = null, language = 'fr') {
  // Prendre les 5 premiers ingrédients principaux
  const mainIngredients = ingredients.slice(0, 5).map(i =>
    typeof i === 'string' ? i : i.name
  ).filter(Boolean);

  const ingredientsList = mainIngredients.length > 0
    ? mainIngredients.join(', ')
    : '';

  const cuisineStyle = cuisineOrigin
    ? `${cuisineOrigin} cuisine style, `
    : '';

  // Prompt optimisé pour des images de plats appétissants
  const prompt = `Professional food photography of "${recipeTitle}". ${cuisineStyle}${ingredientsList ? `Made with ${ingredientsList}. ` : ''}Beautifully plated dish on an elegant plate, top-down view or 45-degree angle, soft natural lighting, shallow depth of field, restaurant quality presentation, appetizing and delicious looking, high-end culinary photography, clean background, photorealistic, 8k quality.`;

  return prompt;
}

/**
 * Upload une image (URL ou base64) vers Supabase Storage
 * @param {string} imageData - URL de l'image ou data URL base64
 * @param {string} recipeTitle - Titre de la recette (pour le nom du fichier)
 * @returns {Promise<string|null>} URL publique de l'image ou null
 */
async function uploadGeneratedImageToStorage(imageData, recipeTitle) {
  try {
    let imageBuffer;
    let contentType = 'image/png';

    if (imageData.startsWith('data:')) {
      // C'est une data URL base64
      console.log('🔄 [ImageGen] Conversion de l\'image base64...');
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Format base64 invalide');
      }
      contentType = matches[1];
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      // C'est une URL, télécharger l'image
      console.log('⬇️  [ImageGen] Téléchargement de l\'image générée...');
      const response = await fetch(imageData, { timeout: 30000 });

      if (!response.ok) {
        throw new Error(`Échec du téléchargement: ${response.status}`);
      }

      contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image vide');
    }

    console.log(`📦 [ImageGen] Taille de l'image: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

    // Générer un nom de fichier unique
    const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    const sanitizedTitle = recipeTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);
    const fileName = `generated-${sanitizedTitle}-${Date.now()}-${randomUUID().substring(0, 8)}.${extension}`;
    const storagePath = `generated/${fileName}`;

    console.log('☁️  [ImageGen] Upload vers Supabase Storage...', storagePath);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('recipe-thumbnails')
      .upload(storagePath, imageBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [ImageGen] Échec de l\'upload:', uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('recipe-thumbnails')
      .getPublicUrl(uploadData?.path || storagePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.warn('⚠️  [ImageGen] Impossible de récupérer l\'URL publique');
      return null;
    }

    console.log('✅ [ImageGen] Image stockée avec succès:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('❌ [ImageGen] Erreur lors de l\'upload de l\'image:', error.message);
    return null;
  }
}

/**
 * Génère une image pour une recette et l'upload dans Supabase
 * @param {Object} recipe - Données de la recette
 * @param {string} recipe.title - Titre de la recette
 * @param {Array} recipe.ingredients - Liste des ingrédients
 * @param {string} [recipe.cuisine_origin] - Origine culinaire
 * @param {Object} options - Options de génération
 * @param {string} [options.language='fr'] - Langue
 * @returns {Promise<string|null>} URL publique de l'image générée ou null
 */
export async function generateRecipeImage(recipe, options = {}) {
  const { language = 'fr' } = options;

  try {
    const provider = getImageProvider();
    const model = getImageModel(provider);

    console.log('🎨 [ImageGen] Début de la génération d\'image...');
    console.log(`🔌 [ImageGen] Provider: ${provider.name}, Modèle: ${model}`);
    console.log('📋 [ImageGen] Recette:', recipe.title);

    // Construire le prompt
    const prompt = buildImagePrompt(
      recipe.title,
      recipe.ingredients,
      recipe.cuisine_origin,
      language
    );

    console.log('📝 [ImageGen] Prompt:', prompt.substring(0, 200) + '...');

    // Générer l'image
    const imageData = await provider.generateImage({
      prompt,
      model,
      size: '1024x1024',
      quality: 'standard',
    });

    // Upload vers Supabase Storage
    const publicUrl = await uploadGeneratedImageToStorage(imageData, recipe.title);

    if (publicUrl) {
      console.log('✅ [ImageGen] Image générée et stockée avec succès!');
    } else {
      console.warn('⚠️  [ImageGen] Image générée mais échec de l\'upload');
    }

    return publicUrl;

  } catch (error) {
    console.error('❌ [ImageGen] Erreur lors de la génération d\'image:', error.message);
    // Ne pas faire échouer toute la génération de recette si l'image échoue
    return null;
  }
}
