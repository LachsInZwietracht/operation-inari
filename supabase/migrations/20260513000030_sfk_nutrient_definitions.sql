-- ============================================================================
-- SFK Nutrient Definitions
-- Adds ~50 new nutrient definitions for SFK's extended nutrient set
-- (amino acids, detailed fatty acids, extended vitamins/minerals, other)
-- and an sfk_column_name mapping column.
-- ============================================================================

-- Add SFK column name mapping helper
ALTER TABLE nutrient_definitions ADD COLUMN IF NOT EXISTS sfk_column_name TEXT;

-- Update existing rows with their SFK column names (where SFK uses the same nutrient)
UPDATE nutrient_definitions SET sfk_column_name = 'Energie_kcal' WHERE id = 'energie';
UPDATE nutrient_definitions SET sfk_column_name = 'Energie_kJ' WHERE id = 'energie_kj';
UPDATE nutrient_definitions SET sfk_column_name = 'Eiweiss' WHERE id = 'eiweiss';
UPDATE nutrient_definitions SET sfk_column_name = 'Fett' WHERE id = 'fett';
UPDATE nutrient_definitions SET sfk_column_name = 'Kohlenhydrate' WHERE id = 'kohlenhydrate';
UPDATE nutrient_definitions SET sfk_column_name = 'Ballaststoffe' WHERE id = 'ballaststoffe';
UPDATE nutrient_definitions SET sfk_column_name = 'Zucker' WHERE id = 'zucker';
UPDATE nutrient_definitions SET sfk_column_name = 'Gesaettigte_FS' WHERE id = 'gesaettigte_fettsaeuren';
UPDATE nutrient_definitions SET sfk_column_name = 'Wasser' WHERE id = 'wasser';
UPDATE nutrient_definitions SET sfk_column_name = 'Alkohol' WHERE id = 'alkohol';
UPDATE nutrient_definitions SET sfk_column_name = 'Vitamin_A_RE' WHERE id = 'vitamin_a';
UPDATE nutrient_definitions SET sfk_column_name = 'Thiamin' WHERE id = 'vitamin_b1';
UPDATE nutrient_definitions SET sfk_column_name = 'Riboflavin' WHERE id = 'vitamin_b2';
UPDATE nutrient_definitions SET sfk_column_name = 'Pyridoxin' WHERE id = 'vitamin_b6';
UPDATE nutrient_definitions SET sfk_column_name = 'Cobalamin' WHERE id = 'vitamin_b12';
UPDATE nutrient_definitions SET sfk_column_name = 'Ascorbinsaeure' WHERE id = 'vitamin_c';
UPDATE nutrient_definitions SET sfk_column_name = 'Calciferol' WHERE id = 'vitamin_d';
UPDATE nutrient_definitions SET sfk_column_name = 'Tocopherol' WHERE id = 'vitamin_e';
UPDATE nutrient_definitions SET sfk_column_name = 'Folat' WHERE id = 'folsaeure';
UPDATE nutrient_definitions SET sfk_column_name = 'Niacin' WHERE id = 'niacin';
UPDATE nutrient_definitions SET sfk_column_name = 'Vitamin_K' WHERE id = 'vitamin_k';
UPDATE nutrient_definitions SET sfk_column_name = 'Biotin' WHERE id = 'biotin';
UPDATE nutrient_definitions SET sfk_column_name = 'Pantothensaeure' WHERE id = 'pantothensaeure';
UPDATE nutrient_definitions SET sfk_column_name = 'Calcium' WHERE id = 'calcium';
UPDATE nutrient_definitions SET sfk_column_name = 'Eisen' WHERE id = 'eisen';
UPDATE nutrient_definitions SET sfk_column_name = 'Magnesium' WHERE id = 'magnesium';
UPDATE nutrient_definitions SET sfk_column_name = 'Kalium' WHERE id = 'kalium';
UPDATE nutrient_definitions SET sfk_column_name = 'Natrium' WHERE id = 'natrium';
UPDATE nutrient_definitions SET sfk_column_name = 'Zink' WHERE id = 'zink';
UPDATE nutrient_definitions SET sfk_column_name = 'Phosphor' WHERE id = 'phosphor';
UPDATE nutrient_definitions SET sfk_column_name = 'Jod' WHERE id = 'jod';
UPDATE nutrient_definitions SET sfk_column_name = 'Kupfer' WHERE id = 'kupfer';
UPDATE nutrient_definitions SET sfk_column_name = 'Mangan' WHERE id = 'mangan';
UPDATE nutrient_definitions SET sfk_column_name = 'Fluorid' WHERE id = 'fluorid';
UPDATE nutrient_definitions SET sfk_column_name = 'Chlorid' WHERE id = 'chlorid';
UPDATE nutrient_definitions SET sfk_column_name = 'Cholesterin' WHERE id = 'cholesterin';

-- Insert new SFK nutrient definitions
INSERT INTO nutrient_definitions (id, name, short_name, unit, nutrient_group, sort_order, bls_column_name, sfk_column_name) VALUES
  -- Extended Vitamins
  ('beta_carotin',      'Beta-Carotin',                  'β-Carotin',  'µg', 'vitamine',      33, NULL, 'Beta_Carotin'),
  ('retinol',           'Retinol',                       'Retinol',    'µg', 'vitamine',      34, NULL, 'Retinol'),
  ('alpha_tocopherol',  'Alpha-Tocopherol',              'α-Tocoph.',  'mg', 'vitamine',      35, NULL, 'Alpha_Tocopherol'),
  ('vitamin_k1',        'Vitamin K1 (Phyllochinon)',     'Vit. K1',   'µg', 'vitamine',      36, NULL, 'Phyllochinon'),
  ('vitamin_k2',        'Vitamin K2 (Menachinon)',       'Vit. K2',   'µg', 'vitamine',      37, NULL, 'Menachinon'),

  -- Extended Minerals
  ('selen',     'Selen',     'Se', 'µg', 'mineralstoffe', 53, NULL, 'Selen'),
  ('chrom',     'Chrom',     'Cr', 'µg', 'mineralstoffe', 54, NULL, 'Chrom'),
  ('molybdaen', 'Molybdän',  'Mo', 'µg', 'mineralstoffe', 55, NULL, 'Molybdaen'),
  ('silicium',  'Silicium',  'Si', 'mg', 'mineralstoffe', 56, NULL, 'Silicium'),

  -- Amino Acids (essential)
  ('isoleucin',     'Isoleucin',     'Ile', 'mg', 'aminosaeuren', 100, NULL, 'Isoleucin'),
  ('leucin',        'Leucin',        'Leu', 'mg', 'aminosaeuren', 101, NULL, 'Leucin'),
  ('lysin',         'Lysin',         'Lys', 'mg', 'aminosaeuren', 102, NULL, 'Lysin'),
  ('methionin',     'Methionin',     'Met', 'mg', 'aminosaeuren', 103, NULL, 'Methionin'),
  ('cystein',       'Cystein',       'Cys', 'mg', 'aminosaeuren', 104, NULL, 'Cystein'),
  ('phenylalanin',  'Phenylalanin',  'Phe', 'mg', 'aminosaeuren', 105, NULL, 'Phenylalanin'),
  ('tyrosin',       'Tyrosin',       'Tyr', 'mg', 'aminosaeuren', 106, NULL, 'Tyrosin'),
  ('threonin',      'Threonin',      'Thr', 'mg', 'aminosaeuren', 107, NULL, 'Threonin'),
  ('tryptophan',    'Tryptophan',    'Trp', 'mg', 'aminosaeuren', 108, NULL, 'Tryptophan'),
  ('valin',         'Valin',         'Val', 'mg', 'aminosaeuren', 109, NULL, 'Valin'),

  -- Amino Acids (non-essential)
  ('arginin',          'Arginin',         'Arg', 'mg', 'aminosaeuren', 110, NULL, 'Arginin'),
  ('histidin',         'Histidin',        'His', 'mg', 'aminosaeuren', 111, NULL, 'Histidin'),
  ('alanin',           'Alanin',          'Ala', 'mg', 'aminosaeuren', 112, NULL, 'Alanin'),
  ('asparaginsaeure',  'Asparaginsäure',  'Asp', 'mg', 'aminosaeuren', 113, NULL, 'Asparaginsaeure'),
  ('glutaminsaeure',   'Glutaminsäure',   'Glu', 'mg', 'aminosaeuren', 114, NULL, 'Glutaminsaeure'),
  ('glycin',           'Glycin',          'Gly', 'mg', 'aminosaeuren', 115, NULL, 'Glycin'),
  ('prolin',           'Prolin',          'Pro', 'mg', 'aminosaeuren', 116, NULL, 'Prolin'),
  ('serin',            'Serin',           'Ser', 'mg', 'aminosaeuren', 117, NULL, 'Serin'),

  -- Fatty Acid Detail
  ('laurinsaeure',     'Laurinsäure (C12:0)',            'C12:0',    'mg', 'fettsaeuren', 200, NULL, 'Laurinsaeure'),
  ('myristinsaeure',   'Myristinsäure (C14:0)',          'C14:0',    'mg', 'fettsaeuren', 201, NULL, 'Myristinsaeure'),
  ('palmitinsaeure',   'Palmitinsäure (C16:0)',          'C16:0',    'mg', 'fettsaeuren', 202, NULL, 'Palmitinsaeure'),
  ('stearinsaeure',    'Stearinsäure (C18:0)',           'C18:0',    'mg', 'fettsaeuren', 203, NULL, 'Stearinsaeure'),
  ('oelsaeure',        'Ölsäure (C18:1)',                'C18:1',    'mg', 'fettsaeuren', 204, NULL, 'Oelsaeure'),
  ('linolsaeure',      'Linolsäure (C18:2 n-6)',        'C18:2',    'mg', 'fettsaeuren', 205, NULL, 'Linolsaeure'),
  ('linolensaeure',    'Linolensäure (C18:3 n-3)',      'C18:3',    'mg', 'fettsaeuren', 206, NULL, 'Linolensaeure'),
  ('arachidonsaeure',  'Arachidonsäure (C20:4 n-6)',    'C20:4',    'mg', 'fettsaeuren', 207, NULL, 'Arachidonsaeure'),
  ('epa',              'EPA (C20:5 n-3)',                'EPA',      'mg', 'fettsaeuren', 208, NULL, 'EPA'),
  ('dha',              'DHA (C22:6 n-3)',                'DHA',      'mg', 'fettsaeuren', 209, NULL, 'DHA'),
  ('trans_fettsaeuren', 'Trans-Fettsäuren',              'Trans-FS', 'mg', 'fettsaeuren', 210, NULL, 'Trans_Fettsaeuren'),
  ('omega_3_gesamt',   'Omega-3-Fettsäuren (gesamt)',   'Ω-3',     'mg', 'fettsaeuren', 211, NULL, 'Omega3_gesamt'),
  ('omega_6_gesamt',   'Omega-6-Fettsäuren (gesamt)',   'Ω-6',     'mg', 'fettsaeuren', 212, NULL, 'Omega6_gesamt'),

  -- Other (SFK-specific)
  ('purine',             'Purine',            'Purine',  'mg', 'sonstige', 61, NULL, 'Purine'),
  ('harnsaeure',         'Harnsäure',         'Harns.',  'mg', 'sonstige', 62, NULL, 'Harnsaeure'),
  ('oxalsaeure',         'Oxalsäure',         'Oxals.',  'mg', 'sonstige', 63, NULL, 'Oxalsaeure'),
  ('staerke',            'Stärke',            'Stärke',  'g',  'sonstige', 64, NULL, 'Staerke'),
  ('sorbit',             'Sorbit',            'Sorbit',  'mg', 'sonstige', 65, NULL, 'Sorbit'),
  ('organische_saeuren', 'Organische Säuren', 'Org. S.', 'g', 'sonstige', 66, NULL, 'Organische_Saeuren')
ON CONFLICT (id) DO UPDATE SET
  sfk_column_name = EXCLUDED.sfk_column_name;
