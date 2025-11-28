# Security & Rate Limiting

Ce document décrit les protections mises en place pour sécuriser l'API contre les abus et limiter les coûts.

## Vue d'ensemble

L'API est protégée par 3 couches de sécurité :

1. **Rate Limiting** - Limite le nombre de requêtes par minute
2. **Cost Protection** - Limite le nombre de générations par jour
3. **Authentication** - JWT token requis pour tous les endpoints protégés

---

## 1. Rate Limiting

### Endpoint `/analyze` (Rate Limiting Standard)

| Protection | Limite | Blocage si dépassement |
|------------|--------|------------------------|
| Par utilisateur | 10 req/min | 5 minutes |
| Par IP | 20 req/min | 10 minutes |
| Global (tous users) | 100 req/min | Service 503 |

### Endpoint `/generate` (Rate Limiting Strict)

| Protection | Limite | Blocage si dépassement |
|------------|--------|------------------------|
| Par utilisateur | 5 req/min | 15 minutes |
| Par IP | 10 req/min | 15 minutes |
| Global (tous users) | 50 req/min | Service 503 |

### Codes d'erreur Rate Limiting

| Code HTTP | Error | Description |
|-----------|-------|-------------|
| 429 | `RATE_LIMITED` | Trop de requêtes, réessayer plus tard |
| 429 | `USER_BLOCKED` | Utilisateur temporairement bloqué |
| 429 | `IP_RATE_LIMITED` | Trop de requêtes depuis cette IP |
| 429 | `IP_BLOCKED` | IP temporairement bloquée |
| 503 | `SERVER_OVERLOADED` | Serveur surchargé, réessayer plus tard |

### Headers de réponse

```
X-RateLimit-Limit: 10        # Limite max
X-RateLimit-Remaining: 7     # Requêtes restantes
X-RateLimit-Reset: 45        # Secondes avant reset
Retry-After: 300             # Secondes avant de réessayer (si bloqué)
```

---

## 2. Cost Protection (Limites de coûts)

Protection contre les factures énormes en limitant le nombre total de générations.

### Limites par défaut

| Limite | Valeur | Description |
|--------|--------|-------------|
| `DAILY_GLOBAL_LIMIT` | 500 | Max générations/jour (tous users) |
| `DAILY_USER_LIMIT` | 50 | Max générations/jour par utilisateur |
| `HOURLY_GLOBAL_LIMIT` | 100 | Max générations/heure (protection pics) |

### Estimation des coûts

| Opération | Coût estimé | 500 générations/jour |
|-----------|-------------|----------------------|
| `/analyze` | ~$0.05 | ~$25/jour max |
| `/generate` | ~$0.08 | ~$40/jour max |

### Codes d'erreur Cost Protection

| Code HTTP | Error | Description |
|-----------|-------|-------------|
| 429 | `DAILY_LIMIT_REACHED` | Limite journalière globale atteinte |
| 429 | `HOURLY_LIMIT_REACHED` | Limite horaire atteinte |
| 429 | `USER_DAILY_LIMIT_REACHED` | Limite journalière utilisateur atteinte |

### Headers de réponse

```
X-Daily-Remaining: 377       # Générations restantes aujourd'hui
X-Daily-Limit: 500           # Limite journalière
```

---

## 3. Variables d'environnement

Ajoute ces variables dans ton fichier `.env` :

```bash
# ============================================
# SECURITY & RATE LIMITING
# ============================================

# Clé secrète pour accéder aux stats admin
# Génère une clé aléatoire : openssl rand -hex 32
ADMIN_API_KEY=your_random_secret_key_here

# Limite journalière globale (toutes générations confondues)
# Default: 500 - Ajuste selon ton budget
DAILY_GLOBAL_LIMIT=500

# Limite journalière par utilisateur (même premium)
# Default: 50 - Protection contre les comptes abusifs
DAILY_USER_LIMIT=50

# Limite horaire globale (protection contre les pics)
# Default: 100 - Évite les surcharges soudaines
HOURLY_GLOBAL_LIMIT=100
```

### Générer une clé admin sécurisée

```bash
# Option 1 : OpenSSL (Mac/Linux)
openssl rand -hex 32

# Option 2 : Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Endpoint Admin `/admin/stats`

Endpoint pour monitorer les stats de sécurité en temps réel.

### Requête

```bash
curl http://localhost:3000/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_API_KEY"
```

### Réponse

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "rateLimiting": {
    "usersTracked": 5,
    "ipsTracked": 3,
    "globalCount": 45,
    "globalResetIn": 30
  },
  "costProtection": {
    "daily": {
      "count": 123,
      "limit": 500,
      "remaining": 377,
      "percentage": 25
    },
    "hourly": {
      "count": 12,
      "limit": 100,
      "remaining": 88
    },
    "estimatedDailyCost": "$7.38",
    "usersActive": 8
  }
}
```

---

## 5. Scénarios de protection

### Attaque par spam massif
1. User envoie 100 requêtes en 1 minute
2. Après 10 requêtes → `429 RATE_LIMITED`
3. Continue → `429 USER_BLOCKED` pendant 5-15 min

### Attaque par comptes multiples
1. Même IP crée plusieurs comptes
2. Après 20 req/min depuis l'IP → `429 IP_BLOCKED`
3. Bloqué pendant 10-15 min

### Tentative de facture énorme
1. User essaie 1000 générations/jour
2. Après 50 → `429 USER_DAILY_LIMIT_REACHED`
3. Après 500 global → `429 DAILY_LIMIT_REACHED`

### Pic de trafic (DDoS)
1. Afflux massif de requêtes
2. Après 100/min global → `503 SERVER_OVERLOADED`
3. Protège les APIs payantes (OpenAI, Gemini)

---

## 6. Recommandations

### Pour la production

1. **Ajuste les limites** selon ton budget :
   ```bash
   # Budget serré (~$10/jour max)
   DAILY_GLOBAL_LIMIT=200
   DAILY_USER_LIMIT=20

   # Budget moyen (~$30/jour max)
   DAILY_GLOBAL_LIMIT=500
   DAILY_USER_LIMIT=50

   # Budget large (~$100/jour max)
   DAILY_GLOBAL_LIMIT=1500
   DAILY_USER_LIMIT=100
   ```

2. **Monitore régulièrement** via `/admin/stats`

3. **Configure des alertes** (le système log à 80% de la limite)

4. **En production avec scaling**, remplace le store en mémoire par Redis

### Fichiers concernés

- `middlewares/rateLimiter.js` - Rate limiting par user/IP
- `middlewares/costProtection.js` - Limites de coûts journalières
- `server.js` - Intégration des middlewares
