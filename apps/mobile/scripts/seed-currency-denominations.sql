CREATE TABLE IF NOT EXISTS currency_denomination (
  id TEXT PRIMARY KEY,
  currency_code VARCHAR(3) NOT NULL,
  value NUMERIC(14, 2) NOT NULL CHECK (value > 0),
  label VARCHAR(32) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (currency_code, value)
);

INSERT INTO currency_denomination (id, currency_code, value, label, sort_order) VALUES
  ('INR-500', 'INR', 500, '₹500', 10), ('INR-200', 'INR', 200, '₹200', 20),
  ('INR-100', 'INR', 100, '₹100', 30), ('INR-50', 'INR', 50, '₹50', 40),
  ('INR-20', 'INR', 20, '₹20', 50), ('INR-10', 'INR', 10, '₹10', 60),
  ('INR-5', 'INR', 5, '₹5', 70), ('INR-2', 'INR', 2, '₹2', 80), ('INR-1', 'INR', 1, '₹1', 90),
  ('USD-100', 'USD', 100, '$100', 10), ('USD-50', 'USD', 50, '$50', 20),
  ('USD-20', 'USD', 20, '$20', 30), ('USD-10', 'USD', 10, '$10', 40),
  ('USD-5', 'USD', 5, '$5', 50), ('USD-2', 'USD', 2, '$2', 60), ('USD-1', 'USD', 1, '$1', 70),
  ('USD-025', 'USD', 0.25, '25¢', 80), ('USD-010', 'USD', 0.10, '10¢', 90),
  ('USD-005', 'USD', 0.05, '5¢', 100), ('USD-001', 'USD', 0.01, '1¢', 110),
  ('EUR-500', 'EUR', 500, '€500', 10), ('EUR-200', 'EUR', 200, '€200', 20),
  ('EUR-100', 'EUR', 100, '€100', 30), ('EUR-50', 'EUR', 50, '€50', 40),
  ('EUR-20', 'EUR', 20, '€20', 50), ('EUR-10', 'EUR', 10, '€10', 60),
  ('EUR-5', 'EUR', 5, '€5', 70), ('EUR-2', 'EUR', 2, '€2', 80), ('EUR-1', 'EUR', 1, '€1', 90),
  ('EUR-050', 'EUR', 0.50, '€0.50', 100), ('EUR-020', 'EUR', 0.20, '€0.20', 110),
  ('EUR-010', 'EUR', 0.10, '€0.10', 120), ('EUR-005', 'EUR', 0.05, '€0.05', 130),
  ('EUR-002', 'EUR', 0.02, '€0.02', 140), ('EUR-001', 'EUR', 0.01, '€0.01', 150),
  ('GBP-50', 'GBP', 50, '£50', 10), ('GBP-20', 'GBP', 20, '£20', 20),
  ('GBP-10', 'GBP', 10, '£10', 30), ('GBP-5', 'GBP', 5, '£5', 40),
  ('GBP-2', 'GBP', 2, '£2', 50), ('GBP-1', 'GBP', 1, '£1', 60),
  ('GBP-050', 'GBP', 0.50, '50p', 70), ('GBP-020', 'GBP', 0.20, '20p', 80),
  ('GBP-010', 'GBP', 0.10, '10p', 90), ('GBP-005', 'GBP', 0.05, '5p', 100),
  ('GBP-002', 'GBP', 0.02, '2p', 110), ('GBP-001', 'GBP', 0.01, '1p', 120),
  ('AED-1000', 'AED', 1000, 'د.إ1000', 10), ('AED-500', 'AED', 500, 'د.إ500', 20),
  ('AED-200', 'AED', 200, 'د.إ200', 30), ('AED-100', 'AED', 100, 'د.إ100', 40),
  ('AED-50', 'AED', 50, 'د.إ50', 50), ('AED-20', 'AED', 20, 'د.إ20', 60),
  ('AED-10', 'AED', 10, 'د.إ10', 70), ('AED-5', 'AED', 5, 'د.إ5', 80),
  ('AED-1', 'AED', 1, 'د.إ1', 90), ('AED-050', 'AED', 0.50, '50 fils', 100),
  ('AED-025', 'AED', 0.25, '25 fils', 110)
ON CONFLICT (currency_code, value) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
