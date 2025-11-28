-- ============================================
-- Table: rate_limit_stats
-- Stockage persistant des compteurs de rate limiting et cost protection
-- ============================================

-- Supprimer la table si elle existe (pour reset)
-- DROP TABLE IF EXISTS rate_limit_stats;

CREATE TABLE IF NOT EXISTS rate_limit_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type de limite
  -- 'daily_global': Limite journalière globale
  -- 'hourly_global': Limite horaire globale
  -- 'daily_user': Limite journalière par utilisateur
  -- 'ip_minute': Rate limit par IP par minute
  -- 'user_minute': Rate limit par user par minute
  type TEXT NOT NULL,

  -- Identifiant (NULL pour global, user_id pour user, IP pour ip)
  identifier TEXT,

  -- Compteur de requêtes
  count INTEGER NOT NULL DEFAULT 0,

  -- Début de la période (pour calculer le reset)
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Bloqué jusqu'à (pour les blocages temporaires)
  blocked_until TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique: un seul enregistrement par type + identifier + période
  CONSTRAINT unique_rate_limit UNIQUE (type, identifier, period_start)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_rate_limit_type ON rate_limit_stats(type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_stats(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_period ON rate_limit_stats(period_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_type_identifier ON rate_limit_stats(type, identifier);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_rate_limit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_rate_limit_updated_at ON rate_limit_stats;
CREATE TRIGGER trigger_rate_limit_updated_at
  BEFORE UPDATE ON rate_limit_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_limit_updated_at();

-- ============================================
-- Fonction: Incrémenter un compteur (upsert atomique)
-- ============================================
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_type TEXT,
  p_identifier TEXT,
  p_period_start TIMESTAMPTZ,
  p_max_count INTEGER DEFAULT NULL
)
RETURNS TABLE (
  current_count INTEGER,
  is_blocked BOOLEAN,
  blocked_until TIMESTAMPTZ
) AS $$
DECLARE
  v_record rate_limit_stats%ROWTYPE;
BEGIN
  -- Upsert atomique avec INCREMENT
  INSERT INTO rate_limit_stats (type, identifier, period_start, count)
  VALUES (p_type, p_identifier, p_period_start, 1)
  ON CONFLICT (type, identifier, period_start)
  DO UPDATE SET count = rate_limit_stats.count + 1
  RETURNING * INTO v_record;

  -- Retourner les valeurs
  RETURN QUERY SELECT
    v_record.count,
    (v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW()),
    v_record.blocked_until;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Fonction: Bloquer un identifiant
-- ============================================
CREATE OR REPLACE FUNCTION block_rate_limit(
  p_type TEXT,
  p_identifier TEXT,
  p_period_start TIMESTAMPTZ,
  p_block_duration_minutes INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE rate_limit_stats
  SET blocked_until = NOW() + (p_block_duration_minutes || ' minutes')::INTERVAL
  WHERE type = p_type
    AND identifier = p_identifier
    AND period_start = p_period_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Fonction: Nettoyer les anciennes entrées (à appeler périodiquement)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_stats
  WHERE period_start < NOW() - INTERVAL '7 days'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Vue: Statistiques actuelles
-- ============================================
CREATE OR REPLACE VIEW rate_limit_current_stats AS
SELECT
  type,
  identifier,
  count,
  period_start,
  blocked_until,
  (blocked_until IS NOT NULL AND blocked_until > NOW()) as is_currently_blocked,
  EXTRACT(EPOCH FROM (NOW() - period_start)) as seconds_since_period_start
FROM rate_limit_stats
WHERE period_start > NOW() - INTERVAL '1 day'
ORDER BY period_start DESC;

-- ============================================
-- RLS (Row Level Security) - Optionnel
-- ============================================
-- Désactiver RLS pour cette table (accès via service key uniquement)
ALTER TABLE rate_limit_stats ENABLE ROW LEVEL SECURITY;

-- Policy pour le service role (bypass RLS)
CREATE POLICY "Service role has full access" ON rate_limit_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Données initiales (compteurs globaux)
-- ============================================
-- Les compteurs seront créés automatiquement par l'application

-- ============================================
-- Commentaires
-- ============================================
COMMENT ON TABLE rate_limit_stats IS 'Stockage persistant des compteurs de rate limiting et protection des coûts';
COMMENT ON COLUMN rate_limit_stats.type IS 'Type de limite: daily_global, hourly_global, daily_user, ip_minute, user_minute';
COMMENT ON COLUMN rate_limit_stats.identifier IS 'Identifiant: NULL pour global, user_id pour user, adresse IP pour ip';
COMMENT ON COLUMN rate_limit_stats.count IS 'Nombre de requêtes dans la période';
COMMENT ON COLUMN rate_limit_stats.period_start IS 'Début de la période de comptage';
COMMENT ON COLUMN rate_limit_stats.blocked_until IS 'Si défini, identifiant bloqué jusqu''à cette date';
