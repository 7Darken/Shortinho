# Configuration RevenueCat Webhook

## 1. Variable d'environnement

Ajoute dans ton `.env` :

```
REVENUECAT_WEBHOOK_SECRET=ton_secret_ici
```

Genere un token random, par exemple :

```bash
openssl rand -hex 32
```

## 2. Configuration dans le dashboard RevenueCat

1. Va dans **RevenueCat Dashboard > Project Settings > Integrations > Webhooks**
2. Ajoute un nouveau webhook :
   - **URL** : `https://ton-domaine.com/webhooks/revenuecat`
   - **Authorization header** : `Bearer TON_SECRET` (le meme que dans `.env`)
3. Active les evenements suivants :
   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `CANCELLATION`
   - `UNCANCELLATION`
   - `EXPIRATION`
   - `BILLING_ISSUE`
   - `SUBSCRIPTION_PAUSED`
   - `PRODUCT_CHANGE`

## 3. Mapping app_user_id

RevenueCat envoie un `app_user_id` dans chaque event. Il faut que ce soit le **UUID Supabase** de l'utilisateur.

Si tu utilises deja `Purchases.configure(apiKey, appUserID: supabaseUser.id)` cote mobile, c'est bon.

Sinon, assure-toi d'identifier l'utilisateur avec son ID Supabase :

```swift
// iOS
Purchases.shared.logIn(supabaseUser.id)
```

```kotlin
// Android
Purchases.sharedInstance.logIn(supabaseUser.id)
```

## 4. Fix des users existants

Les users qui ont cancel mais sont encore `is_premium = true` seront corriges automatiquement a leur prochaine requete (grace a la verification de `premium_expiry`).

Pour les corriger immediatement, execute cette requete SQL dans **Supabase SQL Editor** :

```sql
-- Voir les users concernes
SELECT id, is_premium, premium_expiry, subscription_name
FROM profiles
WHERE is_premium = true
  AND premium_expiry IS NOT NULL
  AND premium_expiry < NOW();

-- Les desactiver
UPDATE profiles
SET is_premium = false, subscription_name = NULL
WHERE is_premium = true
  AND premium_expiry IS NOT NULL
  AND premium_expiry < NOW();
```

## 5. Comment ca marche

```
User cancel son abo
        |
        v
RevenueCat envoie CANCELLATION
        |
        v
Webhook met premium_expiry = date de fin de periode
(is_premium reste true, l'user a paye jusqu'a cette date)
        |
        v
Date d'expiration atteinte
        |
        v
RevenueCat envoie EXPIRATION --> is_premium = false
        |
        OU
        v
L'user fait une requete --> checkUserCanGenerateRecipe()
detecte que premium_expiry < maintenant --> is_premium = false
```

## 6. Tester le webhook

```bash
# Test local avec curl
curl -X POST http://localhost:3000/webhooks/revenuecat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TON_SECRET" \
  -d '{
    "event": {
      "type": "EXPIRATION",
      "app_user_id": "USER_UUID_ICI",
      "product_id": "oshii_pro_monthly",
      "expiration_at_ms": 1711584000000
    }
  }'
```
