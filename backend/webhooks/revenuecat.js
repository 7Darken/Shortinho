/**
 * Webhook RevenueCat pour gérer les événements d'abonnement
 * Documentation: https://www.revenuecat.com/docs/integrations/webhooks
 */

import { updateUserPremiumStatus, getUserEmail } from '../services/database.js';
import { notifySubscriptionEvent } from '../services/telegram.js';

/**
 * Types d'événements RevenueCat qui activent le premium
 */
const PREMIUM_ACTIVE_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE', // Changement de plan (upgrade/downgrade)
];

/**
 * Types d'événements RevenueCat qui désactivent le premium
 */
const PREMIUM_INACTIVE_EVENTS = [
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
];

/**
 * Types d'événements informatifs (pas de changement de statut immédiat)
 */
const INFO_EVENTS = [
  'CANCELLATION', // L'user a cancel mais a encore accès jusqu'à expiry
  'SUBSCRIBER_ALIAS',
  'TRANSFER',
];

/**
 * Handler du webhook RevenueCat
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleRevenueCatWebhook(req, res) {
  const authHeader = req.headers['authorization'];
  const expectedToken = process.env.REVENUECAT_WEBHOOK_SECRET;

  // Vérifier l'authentification du webhook
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    console.error('❌ [RevenueCat] Webhook non autorisé - token invalide');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body?.event;

  if (!event) {
    console.error('❌ [RevenueCat] Payload invalide - pas d\'événement');
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const eventType = event.type;
  const appUserId = event.app_user_id;
  const productId = event.product_id;
  const expirationDate = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  console.log('📨 [RevenueCat] Événement reçu:', eventType);
  console.log('👤 [RevenueCat] User:', appUserId);
  console.log('📦 [RevenueCat] Produit:', productId);
  console.log('📅 [RevenueCat] Expiration:', expirationDate);

  try {
    if (!appUserId) {
      console.error('❌ [RevenueCat] app_user_id manquant');
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    // Récupérer l'email du user pour les notifications
    const email = await getUserEmail(appUserId);

    // Événements qui activent le premium
    if (PREMIUM_ACTIVE_EVENTS.includes(eventType)) {
      console.log('✅ [RevenueCat] Activation premium pour:', appUserId);
      await updateUserPremiumStatus(appUserId, {
        isPremium: true,
        premiumExpiry: expirationDate,
        subscriptionName: productId || 'Oshii Pro',
      });
      await notifySubscriptionEvent({ email, productId, eventType, expirationDate });
    }

    // Événements qui désactivent le premium
    else if (PREMIUM_INACTIVE_EVENTS.includes(eventType)) {
      console.log('⛔ [RevenueCat] Désactivation premium pour:', appUserId);
      await updateUserPremiumStatus(appUserId, {
        isPremium: false,
        premiumExpiry: null,
        subscriptionName: null,
      });
      await notifySubscriptionEvent({ email, productId, eventType, expirationDate });
    }

    // Cancellation : l'user a cancel mais garde l'accès jusqu'à l'expiration
    else if (eventType === 'CANCELLATION') {
      console.log('⚠️  [RevenueCat] Annulation détectée - premium reste actif jusqu\'à:', expirationDate);
      await updateUserPremiumStatus(appUserId, {
        isPremium: true,
        premiumExpiry: expirationDate,
        subscriptionName: productId || 'Oshii Pro',
      });
      await notifySubscriptionEvent({ email, productId, eventType, expirationDate });
    }

    // Événements informatifs
    else if (INFO_EVENTS.includes(eventType)) {
      console.log('ℹ️  [RevenueCat] Événement informatif:', eventType, '- aucune action');
    }

    // Événement inconnu
    else {
      console.warn('⚠️  [RevenueCat] Événement non géré:', eventType);
    }

    // Toujours répondre 200 pour éviter les retries RevenueCat
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [RevenueCat] Erreur traitement webhook:', error.message);
    // Répondre 500 pour que RevenueCat retente
    return res.status(500).json({ error: 'Internal server error' });
  }
}
