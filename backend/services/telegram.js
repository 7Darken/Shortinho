/**
 * Service de notifications Telegram
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Envoie un message via Telegram Bot API
 * @param {string} message - Message en format Markdown
 */
async function sendTelegramMessage(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️  [Telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID non configuré');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [Telegram] Erreur envoi message:', error);
    }
  } catch (error) {
    console.error('❌ [Telegram] Erreur:', error.message);
  }
}

/**
 * Notifie un nouvel abonnement
 * @param {Object} options
 * @param {string} options.email - Email du user
 * @param {string} options.productId - ID du produit (oshii_pro_monthly, oshii_pro_yearly)
 * @param {string} options.eventType - Type d'événement RevenueCat
 * @param {string|null} options.expirationDate - Date d'expiration
 */
export async function notifySubscriptionEvent({ email, productId, eventType, expirationDate }) {
  const planName = productId?.includes('yearly') ? 'Yearly' : 'Monthly';

  const icons = {
    'INITIAL_PURCHASE': '🎉',
    'RENEWAL': '🔄',
    'CANCELLATION': '😢',
    'EXPIRATION': '⛔',
    'UNCANCELLATION': '🎊',
    'BILLING_ISSUE': '⚠️',
    'PRODUCT_CHANGE': '🔀',
  };

  const labels = {
    'INITIAL_PURCHASE': 'Nouvel abonnement',
    'RENEWAL': 'Renouvellement',
    'CANCELLATION': 'Annulation',
    'EXPIRATION': 'Expiration',
    'UNCANCELLATION': 'Réactivation',
    'BILLING_ISSUE': 'Problème de paiement',
    'PRODUCT_CHANGE': 'Changement de plan',
  };

  const icon = icons[eventType] || '📨';
  const label = labels[eventType] || eventType;

  let message = `${icon} *${label}*\n`;
  message += `📧 ${email || 'Email inconnu'}\n`;
  message += `📦 Plan: *${planName}* (${productId})\n`;
  if (expirationDate) {
    message += `📅 Expiration: ${new Date(expirationDate).toLocaleDateString('fr-FR')}`;
  }

  await sendTelegramMessage(message);
}
