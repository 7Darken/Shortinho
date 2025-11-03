/**
 * Middleware d'authentification JWT pour Supabase
 * Vérifie et valide les tokens JWT émis par Supabase
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;

/**
 * Middleware pour vérifier le token JWT Supabase
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 * @param {import('express').NextFunction} next - Next middleware function
 */
export function authenticateToken(req, res, next) {
  // Récupérer le token depuis l'en-tête Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  // Si aucun token n'est fourni
  if (!token) {
    console.error('❌ [Auth] Aucun token fourni');
    return res.status(401).json({
      success: false,
      error: 'Token manquant',
      message: 'Veuillez fournir un token d\'authentification valide',
    });
  }

  // Vérifier que le secret JWT est configuré
  if (!SUPABASE_JWT_SECRET) {
    console.error('❌ [Auth] SUPABASE_JWT_SECRET non configuré');
    return res.status(500).json({
      success: false,
      error: 'Erreur de configuration serveur',
      message: 'Configuration d\'authentification manquante',
    });
  }

  try {
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Vérifier que le token provient bien de Supabase
    // Le iss dans les tokens Supabase est {SUPABASE_URL}/auth/v1
    const expectedIss = SUPABASE_URL + '/auth/v1';
    if (!decoded.iss || decoded.iss !== expectedIss) {
      console.error('❌ [Auth] Token ne provient pas de Supabase:');
      console.error('  Reçu:', decoded.iss);
      console.error('  Attendu:', expectedIss);
      return res.status(401).json({
        success: false,
        error: 'Token invalide',
        message: 'Token ne provient pas d\'une source autorisée',
      });
    }

    // Vérifier l'expiration du token
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      console.error('❌ [Auth] Token expiré');
      return res.status(401).json({
        success: false,
        error: 'Token expiré',
        message: 'Votre session a expiré, veuillez vous reconnecter',
      });
    }

    // Attacher les informations de l'utilisateur à la requête
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      aud: decoded.aud,
    };

    console.log('✅ [Auth] Utilisateur authentifié:', decoded.email || decoded.sub);

    // Passer au middleware suivant
    next();
  } catch (error) {
    console.error('❌ [Auth] Erreur de vérification du token:', error.message);

    // Gérer les différents types d'erreurs JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide',
        message: 'Le token fourni n\'est pas valide',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expiré',
        message: 'Votre session a expiré, veuillez vous reconnecter',
      });
    }

    // Erreur inconnue
    return res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification',
      message: 'Une erreur est survenue lors de la vérification de votre session',
    });
  }
}

/**
 * Middleware optionnel pour vérifier un rôle spécifique
 * @param {string[]} allowedRoles - Rôles autorisés
 * @returns {Function} Middleware Express
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié',
        message: 'Vous devez être authentifié pour accéder à cette ressource',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.error('❌ [Auth] Rôle insuffisant:', req.user.role);
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas les permissions nécessaires',
      });
    }

    next();
  };
}

