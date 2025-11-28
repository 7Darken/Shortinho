/**
 * Middleware de Rate Limiting et protection contre les abus
 * Stockage hybride: mémoire pour la rapidité + Supabase pour la persistance des blocages
 */

import { supabase } from '../services/database.js';

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = {
  user: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  ip: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
  },
  global: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
};

/**
 * Store en mémoire pour le rate limiting rapide
 * Les blocages sont aussi persistés dans Supabase
 */
const rateLimitStore = {
  byUser: new Map(),
  byIp: new Map(),
  global: { count: 0, resetTime: Date.now() + 60000 },
};

/**
 * Nettoie les entrées expirées du store mémoire
 */
function cleanupMemoryStore() {
  const now = Date.now();

  for (const [key, value] of rateLimitStore.byUser.entries()) {
    if (value.resetTime < now && (!value.blocked || value.blockUntil < now)) {
      rateLimitStore.byUser.delete(key);
    }
  }

  for (const [key, value] of rateLimitStore.byIp.entries()) {
    if (value.resetTime < now && (!value.blocked || value.blockUntil < now)) {
      rateLimitStore.byIp.delete(key);
    }
  }
}

// Nettoyer toutes les 5 minutes
setInterval(cleanupMemoryStore, 5 * 60 * 1000);

/**
 * Obtient l'IP réelle du client
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Vérifie si un identifiant est bloqué dans Supabase
 * @param {string} type - 'user_minute' ou 'ip_minute'
 * @param {string} identifier
 * @returns {Promise<{ blocked: boolean, blockUntil: Date | null }>}
 */
async function checkBlockedInDb(type, identifier) {
  try {
    const { data, error } = await supabase
      .from('rate_limit_stats')
      .select('blocked_until')
      .eq('type', type)
      .eq('identifier', identifier)
      .gt('blocked_until', new Date().toISOString())
      .order('blocked_until', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [RateLimiter] Erreur vérification blocage:', error);
    }

    if (data?.blocked_until) {
      return {
        blocked: true,
        blockUntil: new Date(data.blocked_until),
      };
    }

    return { blocked: false, blockUntil: null };
  } catch (error) {
    return { blocked: false, blockUntil: null };
  }
}

/**
 * Persiste un blocage dans Supabase
 * @param {string} type
 * @param {string} identifier
 * @param {number} blockDurationMs
 */
async function persistBlock(type, identifier, blockDurationMs) {
  try {
    const now = new Date();
    const blockUntil = new Date(now.getTime() + blockDurationMs);
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

    await supabase
      .from('rate_limit_stats')
      .upsert({
        type,
        identifier,
        period_start: periodStart.toISOString(),
        count: 0,
        blocked_until: blockUntil.toISOString(),
      }, {
        onConflict: 'type,identifier,period_start',
      });

    console.log(`🔒 [RateLimiter] Blocage persisté: ${type} - ${identifier} jusqu'à ${blockUntil.toISOString()}`);
  } catch (error) {
    console.error('❌ [RateLimiter] Erreur persistance blocage:', error);
  }
}

/**
 * Vérifie et incrémente le compteur (mémoire + vérification DB pour blocages)
 */
async function checkLimit(store, key, config, type) {
  const now = Date.now();
  let entry = store.get(key);

  // Vérifier d'abord si bloqué en mémoire
  if (entry?.blocked && entry.blockUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.blockUntil - now) / 1000),
      blocked: true,
    };
  }

  // Vérifier si bloqué dans la DB (pour les blocages persistants)
  const dbBlock = await checkBlockedInDb(type, key);
  if (dbBlock.blocked) {
    // Mettre à jour le cache mémoire
    if (!entry) entry = { count: 0, resetTime: now + config.windowMs };
    entry.blocked = true;
    entry.blockUntil = dbBlock.blockUntil.getTime();
    store.set(key, entry);

    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((dbBlock.blockUntil.getTime() - now) / 1000),
      blocked: true,
    };
  }

  // Nouvelle entrée ou fenêtre expirée
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false,
      blockUntil: 0,
    };
    store.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: Math.ceil(config.windowMs / 1000),
      blocked: false,
    };
  }

  // Incrémenter le compteur
  entry.count++;

  // Vérifier si limite dépassée
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockUntil = now + config.blockDurationMs;
    store.set(key, entry);

    // Persister le blocage dans Supabase
    await persistBlock(type, key, config.blockDurationMs);

    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil(config.blockDurationMs / 1000),
      blocked: true,
    };
  }

  store.set(key, entry);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
    blocked: false,
  };
}

/**
 * Vérifie la limite globale (mémoire seulement, pas besoin de persister)
 */
function checkGlobalLimit(config) {
  const now = Date.now();

  if (rateLimitStore.global.resetTime < now) {
    rateLimitStore.global = { count: 1, resetTime: now + config.windowMs };
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  rateLimitStore.global.count++;

  if (rateLimitStore.global.count > config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - rateLimitStore.global.count,
  };
}

/**
 * Middleware de rate limiting
 */
export function rateLimiter(options = {}) {
  const config = {
    user: { ...DEFAULT_CONFIG.user, ...options.user },
    ip: { ...DEFAULT_CONFIG.ip, ...options.ip },
    global: { ...DEFAULT_CONFIG.global, ...options.global },
  };

  return async (req, res, next) => {
    const clientIp = getClientIp(req);
    const userId = req.user?.id;

    console.log(`🛡️  [RateLimit] Vérification - IP: ${clientIp}, User: ${userId?.substring(0, 8) || 'anonymous'}...`);

    // 1. Vérifier limite globale
    const globalCheck = checkGlobalLimit(config.global);
    if (!globalCheck.allowed) {
      console.warn('⛔ [RateLimit] Limite GLOBALE atteinte - Serveur surchargé');
      return res.status(503).json({
        success: false,
        error: 'SERVER_OVERLOADED',
        message: 'Le serveur est temporairement surchargé. Réessayez dans quelques instants.',
      });
    }

    // 2. Vérifier limite par IP
    const ipCheck = await checkLimit(rateLimitStore.byIp, clientIp, config.ip, 'ip_minute');
    if (!ipCheck.allowed) {
      console.warn(`⛔ [RateLimit] IP bloquée: ${clientIp} (blocked: ${ipCheck.blocked})`);
      res.set('Retry-After', ipCheck.resetIn);
      return res.status(429).json({
        success: false,
        error: ipCheck.blocked ? 'IP_BLOCKED' : 'IP_RATE_LIMITED',
        message: ipCheck.blocked
          ? `Trop de requêtes depuis cette adresse IP. Bloqué pendant ${Math.ceil(ipCheck.resetIn / 60)} minutes.`
          : 'Trop de requêtes depuis cette adresse IP. Réessayez plus tard.',
        retryAfter: ipCheck.resetIn,
      });
    }

    // 3. Vérifier limite par utilisateur
    if (userId) {
      const userCheck = await checkLimit(rateLimitStore.byUser, userId, config.user, 'user_minute');
      if (!userCheck.allowed) {
        console.warn(`⛔ [RateLimit] User bloqué: ${userId.substring(0, 8)}... (blocked: ${userCheck.blocked})`);
        res.set('Retry-After', userCheck.resetIn);
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', userCheck.resetIn);
        return res.status(429).json({
          success: false,
          error: userCheck.blocked ? 'USER_BLOCKED' : 'RATE_LIMITED',
          message: userCheck.blocked
            ? `Trop de requêtes. Votre compte est temporairement bloqué pendant ${Math.ceil(userCheck.resetIn / 60)} minutes.`
            : 'Trop de requêtes. Veuillez patienter avant de réessayer.',
          retryAfter: userCheck.resetIn,
          remaining: 0,
        });
      }

      res.set('X-RateLimit-Limit', config.user.maxRequests);
      res.set('X-RateLimit-Remaining', userCheck.remaining);
      res.set('X-RateLimit-Reset', userCheck.resetIn);
    }

    console.log('✅ [RateLimit] Requête autorisée');
    next();
  };
}

/**
 * Middleware strict pour endpoints coûteux
 */
export function strictRateLimiter() {
  return rateLimiter({
    user: {
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    },
    ip: {
      maxRequests: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    },
    global: {
      maxRequests: 50,
      windowMs: 60 * 1000,
    },
  });
}

/**
 * Statistiques du rate limiter
 */
export function getRateLimitStats() {
  return {
    usersTracked: rateLimitStore.byUser.size,
    ipsTracked: rateLimitStore.byIp.size,
    globalCount: rateLimitStore.global.count,
    globalResetIn: Math.max(0, Math.ceil((rateLimitStore.global.resetTime - Date.now()) / 1000)),
  };
}
