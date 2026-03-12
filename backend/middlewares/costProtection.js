/**
 * Protection contre les coûts excessifs
 * Limite le nombre total de générations par jour pour éviter les factures énormes
 * Stockage persistant dans Supabase
 */

import { supabase } from '../services/database.js';

/**
 * Configuration des limites de coûts
 */
const COST_CONFIG = {
  dailyGlobalLimit: parseInt(process.env.DAILY_GLOBAL_LIMIT) || 2000,
  dailyUserLimit: parseInt(process.env.DAILY_USER_LIMIT) || 100,
  hourlyGlobalLimit: parseInt(process.env.HOURLY_GLOBAL_LIMIT) || 500,
  alertThreshold: 0.8,
};

/**
 * Cache en mémoire pour réduire les appels DB
 * TTL court pour rester synchronisé
 */
const cache = {
  daily: { count: null, fetchedAt: 0 },
  hourly: { count: null, fetchedAt: 0 },
  users: new Map(),
};
const CACHE_TTL = 5000; // 5 secondes

/**
 * Calcule le début de la période actuelle
 * @param {'daily' | 'hourly'} period
 * @returns {Date}
 */
function getPeriodStart(period) {
  const now = new Date();
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  }
}

/**
 * Formate une date pour Supabase
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString();
}

/**
 * Récupère ou crée un compteur dans Supabase
 * @param {string} type - Type de limite
 * @param {string|null} identifier - Identifiant (null pour global)
 * @param {Date} periodStart - Début de la période
 * @returns {Promise<{ count: number, blocked_until: string | null }>}
 */
async function getOrCreateCounter(type, identifier, periodStart) {
  const periodStartStr = formatDate(periodStart);

  // Chercher le compteur existant
  const { data: existing, error: selectError } = await supabase
    .from('rate_limit_stats')
    .select('count, blocked_until')
    .eq('type', type)
    .eq('identifier', identifier || '')
    .eq('period_start', periodStartStr)
    .single();

  if (existing) {
    return existing;
  }

  // Créer si n'existe pas
  if (selectError?.code === 'PGRST116') {
    const { data: created, error: insertError } = await supabase
      .from('rate_limit_stats')
      .insert({
        type,
        identifier: identifier || '',
        period_start: periodStartStr,
        count: 0,
      })
      .select('count, blocked_until')
      .single();

    if (insertError && insertError.code !== '23505') {
      console.error('❌ [CostProtection] Erreur création compteur:', insertError);
      throw insertError;
    }

    // Si conflit (créé par un autre process), récupérer
    if (insertError?.code === '23505') {
      const { data: refetched } = await supabase
        .from('rate_limit_stats')
        .select('count, blocked_until')
        .eq('type', type)
        .eq('identifier', identifier || '')
        .eq('period_start', periodStartStr)
        .single();
      return refetched || { count: 0, blocked_until: null };
    }

    return created || { count: 0, blocked_until: null };
  }

  if (selectError) {
    console.error('❌ [CostProtection] Erreur lecture compteur:', selectError);
    throw selectError;
  }

  return { count: 0, blocked_until: null };
}

/**
 * Incrémente un compteur de manière atomique
 * @param {string} type
 * @param {string|null} identifier
 * @param {Date} periodStart
 * @returns {Promise<number>} Nouveau count
 */
async function incrementCounter(type, identifier, periodStart) {
  const periodStartStr = formatDate(periodStart);

  // Upsert avec increment atomique
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_type: type,
    p_identifier: identifier || '',
    p_period_start: periodStartStr,
  });

  if (error) {
    console.error('❌ [CostProtection] Erreur increment:', error);
    // Fallback: essayer manuellement
    const counter = await getOrCreateCounter(type, identifier, periodStart);
    const newCount = counter.count + 1;

    await supabase
      .from('rate_limit_stats')
      .update({ count: newCount })
      .eq('type', type)
      .eq('identifier', identifier || '')
      .eq('period_start', periodStartStr);

    return newCount;
  }

  return data?.[0]?.current_count || 1;
}

/**
 * Récupère le compteur avec cache
 * @param {string} type
 * @param {string|null} identifier
 * @param {'daily' | 'hourly'} period
 * @returns {Promise<number>}
 */
async function getCountWithCache(type, identifier, period) {
  const now = Date.now();
  const periodStart = getPeriodStart(period);
  const cacheKey = identifier || 'global';

  // Vérifier cache
  if (type === 'daily_global' && cache.daily.fetchedAt > now - CACHE_TTL) {
    return cache.daily.count || 0;
  }
  if (type === 'hourly_global' && cache.hourly.fetchedAt > now - CACHE_TTL) {
    return cache.hourly.count || 0;
  }
  if (type === 'daily_user') {
    const userCache = cache.users.get(cacheKey);
    if (userCache && userCache.fetchedAt > now - CACHE_TTL) {
      return userCache.count || 0;
    }
  }

  // Récupérer depuis DB
  const counter = await getOrCreateCounter(type, identifier, periodStart);
  const count = counter.count;

  // Mettre en cache
  if (type === 'daily_global') {
    cache.daily = { count, fetchedAt: now };
  } else if (type === 'hourly_global') {
    cache.hourly = { count, fetchedAt: now };
  } else if (type === 'daily_user') {
    cache.users.set(cacheKey, { count, fetchedAt: now });
  }

  return count;
}

/**
 * Invalide le cache après un incrément
 * @param {string} type
 * @param {string|null} identifier
 */
function invalidateCache(type, identifier) {
  if (type === 'daily_global') {
    cache.daily.fetchedAt = 0;
  } else if (type === 'hourly_global') {
    cache.hourly.fetchedAt = 0;
  } else if (type === 'daily_user' && identifier) {
    cache.users.delete(identifier);
  }
}

/**
 * Vérifie les limites et incrémente si autorisé
 * @param {string} userId
 * @param {string} operation
 * @returns {Promise<{ allowed: boolean, reason?: string, message?: string, stats: Object }>}
 */
async function checkAndIncrementCost(userId, operation) {
  try {
    const dailyPeriodStart = getPeriodStart('daily');
    const hourlyPeriodStart = getPeriodStart('hourly');

    // Récupérer les compteurs actuels (avec cache)
    const [dailyGlobalCount, hourlyGlobalCount, dailyUserCount] = await Promise.all([
      getCountWithCache('daily_global', null, 'daily'),
      getCountWithCache('hourly_global', null, 'hourly'),
      getCountWithCache('daily_user', userId, 'daily'),
    ]);

    // Vérifier limite horaire globale
    if (hourlyGlobalCount >= COST_CONFIG.hourlyGlobalLimit) {
      console.warn('⛔ [CostProtection] Limite HORAIRE globale atteinte!');
      return {
        allowed: false,
        reason: 'HOURLY_LIMIT_REACHED',
        message: 'Limite horaire atteinte. Réessayez dans quelques minutes.',
        stats: await getStats(),
      };
    }

    // Vérifier limite journalière globale
    if (dailyGlobalCount >= COST_CONFIG.dailyGlobalLimit) {
      console.warn('⛔ [CostProtection] Limite JOURNALIÈRE globale atteinte!');
      return {
        allowed: false,
        reason: 'DAILY_LIMIT_REACHED',
        message: 'Limite journalière du service atteinte. Réessayez demain.',
        stats: await getStats(),
      };
    }

    // Vérifier limite journalière utilisateur
    if (dailyUserCount >= COST_CONFIG.dailyUserLimit) {
      console.warn(`⛔ [CostProtection] Limite journalière utilisateur atteinte: ${userId.substring(0, 8)}...`);
      return {
        allowed: false,
        reason: 'USER_DAILY_LIMIT_REACHED',
        message: `Vous avez atteint votre limite de ${COST_CONFIG.dailyUserLimit} générations par jour.`,
        stats: await getStats(),
      };
    }

    // Incrémenter les compteurs (en parallèle)
    await Promise.all([
      incrementCounter('daily_global', null, dailyPeriodStart),
      incrementCounter('hourly_global', null, hourlyPeriodStart),
      incrementCounter('daily_user', userId, dailyPeriodStart),
    ]);

    // Invalider les caches
    invalidateCache('daily_global', null);
    invalidateCache('hourly_global', null);
    invalidateCache('daily_user', userId);

    // Vérifier seuil d'alerte
    const newDailyCount = dailyGlobalCount + 1;
    const dailyUsage = newDailyCount / COST_CONFIG.dailyGlobalLimit;
    if (dailyUsage >= COST_CONFIG.alertThreshold) {
      console.warn(`⚠️ [CostProtection] ALERTE: ${Math.round(dailyUsage * 100)}% de la limite journalière (${newDailyCount}/${COST_CONFIG.dailyGlobalLimit})`);
    }

    console.log(`💰 [CostProtection] ${operation} autorisé - Daily: ${newDailyCount}/${COST_CONFIG.dailyGlobalLimit}, User: ${dailyUserCount + 1}/${COST_CONFIG.dailyUserLimit}`);

    return {
      allowed: true,
      stats: await getStats(),
    };

  } catch (error) {
    console.error('❌ [CostProtection] Erreur:', error.message);
    // En cas d'erreur DB, on autorise (fail-open) pour ne pas bloquer le service
    // Mais on log l'erreur pour investigation
    return {
      allowed: true,
      stats: { error: 'DB_ERROR' },
    };
  }
}

/**
 * Obtenir les statistiques actuelles
 * @returns {Promise<Object>}
 */
async function getStats() {
  try {
    const dailyPeriodStart = getPeriodStart('daily');
    const hourlyPeriodStart = getPeriodStart('hourly');

    const [dailyGlobal, hourlyGlobal] = await Promise.all([
      getOrCreateCounter('daily_global', null, dailyPeriodStart),
      getOrCreateCounter('hourly_global', null, hourlyPeriodStart),
    ]);

    // Compter les utilisateurs actifs aujourd'hui
    const { count: usersActive } = await supabase
      .from('rate_limit_stats')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'daily_user')
      .eq('period_start', formatDate(dailyPeriodStart));

    return {
      daily: {
        count: dailyGlobal.count,
        limit: COST_CONFIG.dailyGlobalLimit,
        remaining: Math.max(0, COST_CONFIG.dailyGlobalLimit - dailyGlobal.count),
        percentage: Math.round((dailyGlobal.count / COST_CONFIG.dailyGlobalLimit) * 100),
      },
      hourly: {
        count: hourlyGlobal.count,
        limit: COST_CONFIG.hourlyGlobalLimit,
        remaining: Math.max(0, COST_CONFIG.hourlyGlobalLimit - hourlyGlobal.count),
      },
      estimatedDailyCost: `$${(dailyGlobal.count * 0.06).toFixed(2)}`,
      usersActive: usersActive || 0,
    };
  } catch (error) {
    console.error('❌ [CostProtection] Erreur getStats:', error.message);
    return {
      daily: { count: 0, limit: COST_CONFIG.dailyGlobalLimit, remaining: COST_CONFIG.dailyGlobalLimit, percentage: 0 },
      hourly: { count: 0, limit: COST_CONFIG.hourlyGlobalLimit, remaining: COST_CONFIG.hourlyGlobalLimit },
      estimatedDailyCost: '$0.00',
      usersActive: 0,
      error: error.message,
    };
  }
}

/**
 * Middleware de protection des coûts
 * @param {string} operation - Type d'opération ('analyze' ou 'generate')
 * @returns {Function} - Middleware Express
 */
export function costProtection(operation = 'analyze') {
  return async (req, res, next) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentification requise',
      });
    }

    const result = await checkAndIncrementCost(userId, operation);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: result.reason,
        message: result.message,
        stats: {
          dailyRemaining: result.stats.daily?.remaining,
          dailyPercentage: result.stats.daily?.percentage,
        },
      });
    }

    // Ajouter les stats aux headers
    res.set('X-Daily-Remaining', result.stats.daily?.remaining?.toString() || '0');
    res.set('X-Daily-Limit', result.stats.daily?.limit?.toString() || '0');

    next();
  };
}

/**
 * Récupérer les stats (pour endpoint admin)
 */
export async function getCostStats() {
  return await getStats();
}

/**
 * Obtenir les stats d'un utilisateur spécifique
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function getUserCostStats(userId) {
  try {
    const dailyPeriodStart = getPeriodStart('daily');
    const counter = await getOrCreateCounter('daily_user', userId, dailyPeriodStart);

    return {
      dailyCount: counter.count,
      dailyLimit: COST_CONFIG.dailyUserLimit,
      dailyRemaining: Math.max(0, COST_CONFIG.dailyUserLimit - counter.count),
    };
  } catch (error) {
    return {
      dailyCount: 0,
      dailyLimit: COST_CONFIG.dailyUserLimit,
      dailyRemaining: COST_CONFIG.dailyUserLimit,
    };
  }
}

/**
 * Nettoyer les anciennes entrées (à appeler périodiquement)
 */
export async function cleanupOldRateLimits() {
  try {
    const { data, error } = await supabase.rpc('cleanup_old_rate_limits');
    if (error) throw error;
    console.log(`🧹 [CostProtection] Nettoyage: ${data} entrées supprimées`);
    return data;
  } catch (error) {
    console.error('❌ [CostProtection] Erreur nettoyage:', error.message);
    return 0;
  }
}
