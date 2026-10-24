-- Devise par défaut : dinar tunisien (demande de l'utilisatrice).
-- Les comptes qui avaient l'euro enregistré passent au dinar tunisien ; modifiable ensuite dans Paramètres.
UPDATE "User"
SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{currency}', '"TND"'::jsonb, true)
WHERE COALESCE("settings"->>'currency', 'EUR') = 'EUR';
