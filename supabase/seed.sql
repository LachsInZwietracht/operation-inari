-- ============================================================================
-- Seed data: nutrient definitions, data sources, reference values
-- ============================================================================

-- ============================================================================
-- Data sources
-- ============================================================================
INSERT INTO data_sources (id, name, version, record_count, nutrient_count, license, url) VALUES
  ('bls', 'BLS (Bundeslebensmittelschlüssel)', '4.0', 7140, 138, 'Free (MRI)', 'https://www.blsdb.de/'),
  ('sfk', 'Souci-Fachmann-Kraut', '2024', 800, 300, 'Commercial license required', 'https://www.wissenschaftliche-verlagsgesellschaft.de/'),
  ('usda', 'USDA FoodData Central', '2026-01', 370000, 360, 'CC0 Public Domain', 'https://fdc.nal.usda.gov/'),
  ('afcd', 'Australian Food Composition Database', '1.0', 1534, 256, 'CC BY 2.5 AU', 'https://data.gov.au/'),
  ('swiss', 'Swiss Food Composition Database', '7.0', 1220, NULL, 'Free with attribution', 'https://www.naehrwertdaten.ch/'),
  ('ciqual', 'ANSES Ciqual', '2020', 3484, NULL, 'Licence Ouverte', 'https://www.data.gouv.fr/'),
  ('cofid', 'UK CoFID (McCance & Widdowson)', '2021', NULL, NULL, 'Open Government Licence v3', 'https://www.gov.uk/'),
  ('off', 'Open Food Facts', 'live', NULL, NULL, 'ODbL (attribution + share-alike)', 'https://world.openfoodfacts.org/data'),
  ('hersteller', 'Herstellerdaten', 'varies', NULL, NULL, 'Bilateral agreements', NULL),
  ('custom', 'Eigene Lebensmittel', 'live', NULL, NULL, NULL, NULL);

-- ============================================================================
-- Nutrient definitions
-- Start with our existing 28 nutrients. BLS 4.0 ETL will INSERT additional rows.
-- ============================================================================
-- bls_column_name = the BLS 4.0 nutrient CODE (e.g., 'ENERCC') used to find
-- the value column in the Excel header: "ENERCC Energie (Kilokalorien) [kcal/100g]"
-- The ETL script matches by checking if the header starts with "CODE ".
-- NULL means the value is computed from other BLS columns (see ETL script).
INSERT INTO nutrient_definitions (id, name, short_name, unit, nutrient_group, sort_order, bls_column_name) VALUES
  -- Makronährstoffe
  ('energie',                    'Energie',                    'Energie',     'kcal', 'makronaehrstoffe', 1,   'ENERCC'),
  ('energie_kj',                 'Energie (kJ)',               'Energie kJ',  'kJ',  'makronaehrstoffe', 2,   'ENERCJ'),
  ('eiweiss',                    'Eiweiß',                     'Eiweiß',      'g',    'makronaehrstoffe', 3,   'PROT625'),
  ('fett',                       'Fett',                       'Fett',        'g',    'makronaehrstoffe', 4,   'FAT'),
  ('kohlenhydrate',              'Kohlenhydrate',              'KH',          'g',    'makronaehrstoffe', 5,   'CHO'),
  ('ballaststoffe',              'Ballaststoffe',              'Ballastst.',  'g',    'makronaehrstoffe', 6,   'FIBT'),
  ('zucker',                     'Zucker',                     'Zucker',      'g',    'makronaehrstoffe', 7,   'SUGAR'),
  ('gesaettigte_fettsaeuren',    'Gesättigte Fettsäuren',      'Ges. FS',     'g',    'makronaehrstoffe', 8,   'FASAT'),
  ('ungesaettigte_fettsaeuren',  'Ungesättigte Fettsäuren',    'Unges. FS',   'g',    'makronaehrstoffe', 9,   NULL), -- computed: FAMS + FAPU
  ('wasser',                     'Wasser',                     'Wasser',      'g',    'makronaehrstoffe', 10,  'WATER'),
  ('alkohol',                    'Alkohol',                    'Alkohol',     'g',    'makronaehrstoffe', 11,  'ALC'),

  -- Vitamine
  ('vitamin_a',   'Vitamin A (RE)',              'Vit. A',    'µg', 'vitamine', 20, 'VITA'),
  ('vitamin_b1',  'Vitamin B1 (Thiamin)',        'Vit. B1',   'mg', 'vitamine', 21, 'THIA'),
  ('vitamin_b2',  'Vitamin B2 (Riboflavin)',     'Vit. B2',   'mg', 'vitamine', 22, 'RIBF'),
  ('vitamin_b6',  'Vitamin B6',                  'Vit. B6',   'mg', 'vitamine', 23, 'VITB6'),  -- BLS uses µg! ETL divides by 1000
  ('vitamin_b12', 'Vitamin B12',                 'Vit. B12',  'µg', 'vitamine', 24, 'VITB12'),
  ('vitamin_c',   'Vitamin C',                   'Vit. C',    'mg', 'vitamine', 25, 'VITC'),
  ('vitamin_d',   'Vitamin D',                   'Vit. D',    'µg', 'vitamine', 26, 'VITD'),
  ('vitamin_e',   'Vitamin E',                   'Vit. E',    'mg', 'vitamine', 27, 'VITE'),
  ('folsaeure',   'Folat-Äquivalent',            'Folat',     'µg', 'vitamine', 28, 'FOL'),
  ('niacin',      'Niacin-Äquivalent',           'Niacin',    'mg', 'vitamine', 29, 'NIAEQ'),
  ('vitamin_k',   'Vitamin K',                   'Vit. K',    'µg', 'vitamine', 30, 'VITK'),
  ('biotin',      'Biotin',                      'Biotin',    'µg', 'vitamine', 31, 'BIOT'),
  ('pantothensaeure', 'Pantothensäure',           'Pantoth.',  'mg', 'vitamine', 32, 'PANTAC'),

  -- Mineralstoffe
  ('calcium',   'Calcium',   'Ca', 'mg', 'mineralstoffe', 40, 'CA'),
  ('eisen',     'Eisen',     'Fe', 'mg', 'mineralstoffe', 41, 'FE'),
  ('magnesium', 'Magnesium', 'Mg', 'mg', 'mineralstoffe', 42, 'MG'),
  ('kalium',    'Kalium',    'K',  'mg', 'mineralstoffe', 43, 'K'),
  ('natrium',   'Natrium',   'Na', 'mg', 'mineralstoffe', 44, 'NA'),
  ('zink',      'Zink',      'Zn', 'mg', 'mineralstoffe', 45, 'ZN'),
  ('phosphor',  'Phosphor',  'P',  'mg', 'mineralstoffe', 46, 'P'),
  ('jod',       'Jod',       'J',  'µg', 'mineralstoffe', 47, 'ID'),
  ('kupfer',    'Kupfer',    'Cu', 'µg', 'mineralstoffe', 48, 'CU'),
  ('mangan',    'Mangan',    'Mn', 'µg', 'mineralstoffe', 49, 'MN'),
  ('fluorid',   'Fluorid',   'F',  'µg', 'mineralstoffe', 50, 'FD'),
  ('chlorid',   'Chlorid',   'Cl', 'mg', 'mineralstoffe', 51, 'CLD'),
  ('salz',      'Salz (NaCl)', 'Salz', 'g', 'mineralstoffe', 52, 'NACL'),
  ('cholesterin', 'Cholesterin', 'Chol.', 'mg', 'sonstige', 60, 'CHORL');

-- ============================================================================
-- DGE Reference values (Erwachsene 25–51 Jahre)
-- Source: Deutsche Gesellschaft für Ernährung (DGE), Stand 2024
-- ============================================================================
INSERT INTO reference_values (nutrient_id, amount, gender, age_min, age_max, source, label) VALUES
  -- Makronährstoffe
  ('energie',                   2400, 'm', 25, 51, 'DGE 2024', 'Energie (Erwachsener Mann)'),
  ('energie',                   1900, 'w', 25, 51, 'DGE 2024', 'Energie (Erwachsene Frau)'),
  ('eiweiss',                   57,   'm', 25, 51, 'DGE 2024', 'Eiweiß (Erwachsener Mann)'),
  ('eiweiss',                   48,   'w', 25, 51, 'DGE 2024', 'Eiweiß (Erwachsene Frau)'),
  ('fett',                      80,   'm', 25, 51, 'DGE 2024', 'Fett (Erwachsener Mann)'),
  ('fett',                      63,   'w', 25, 51, 'DGE 2024', 'Fett (Erwachsene Frau)'),
  ('kohlenhydrate',             300,  'm', 25, 51, 'DGE 2024', 'Kohlenhydrate (Erwachsener Mann)'),
  ('kohlenhydrate',             237,  'w', 25, 51, 'DGE 2024', 'Kohlenhydrate (Erwachsene Frau)'),
  ('ballaststoffe',             30,   'm', 25, 51, 'DGE 2024', 'Ballaststoffe (Erwachsener Mann)'),
  ('ballaststoffe',             30,   'w', 25, 51, 'DGE 2024', 'Ballaststoffe (Erwachsene Frau)'),
  ('zucker',                    60,   'm', 25, 51, 'DGE 2024', 'Zucker (Erwachsener Mann)'),
  ('zucker',                    47,   'w', 25, 51, 'DGE 2024', 'Zucker (Erwachsene Frau)'),
  ('gesaettigte_fettsaeuren',   27,   'm', 25, 51, 'DGE 2024', 'Ges. Fettsäuren (Erwachsener Mann)'),
  ('gesaettigte_fettsaeuren',   21,   'w', 25, 51, 'DGE 2024', 'Ges. Fettsäuren (Erwachsene Frau)'),
  ('ungesaettigte_fettsaeuren', 53,   'm', 25, 51, 'DGE 2024', 'Unges. Fettsäuren (Erwachsener Mann)'),
  ('ungesaettigte_fettsaeuren', 42,   'w', 25, 51, 'DGE 2024', 'Unges. Fettsäuren (Erwachsene Frau)'),
  ('wasser',                    2500, 'm', 25, 51, 'DGE 2024', 'Wasser (Erwachsener Mann)'),
  ('wasser',                    2000, 'w', 25, 51, 'DGE 2024', 'Wasser (Erwachsene Frau)'),

  -- Vitamine
  ('vitamin_a',   850,  'm', 25, 51, 'DGE 2024', 'Vitamin A (Erwachsener Mann)'),
  ('vitamin_a',   700,  'w', 25, 51, 'DGE 2024', 'Vitamin A (Erwachsene Frau)'),
  ('vitamin_b1',  1.3,  'm', 25, 51, 'DGE 2024', 'Vitamin B1 (Erwachsener Mann)'),
  ('vitamin_b1',  1.0,  'w', 25, 51, 'DGE 2024', 'Vitamin B1 (Erwachsene Frau)'),
  ('vitamin_b2',  1.4,  'm', 25, 51, 'DGE 2024', 'Vitamin B2 (Erwachsener Mann)'),
  ('vitamin_b2',  1.1,  'w', 25, 51, 'DGE 2024', 'Vitamin B2 (Erwachsene Frau)'),
  ('vitamin_b6',  1.6,  'm', 25, 51, 'DGE 2024', 'Vitamin B6 (Erwachsener Mann)'),
  ('vitamin_b6',  1.4,  'w', 25, 51, 'DGE 2024', 'Vitamin B6 (Erwachsene Frau)'),
  ('vitamin_b12', 4.0,  'm', 25, 51, 'DGE 2024', 'Vitamin B12 (Erwachsener Mann)'),
  ('vitamin_b12', 4.0,  'w', 25, 51, 'DGE 2024', 'Vitamin B12 (Erwachsene Frau)'),
  ('vitamin_c',   110,  'm', 25, 51, 'DGE 2024', 'Vitamin C (Erwachsener Mann)'),
  ('vitamin_c',   95,   'w', 25, 51, 'DGE 2024', 'Vitamin C (Erwachsene Frau)'),
  ('vitamin_d',   20,   'm', 25, 51, 'DGE 2024', 'Vitamin D (Erwachsener Mann)'),
  ('vitamin_d',   20,   'w', 25, 51, 'DGE 2024', 'Vitamin D (Erwachsene Frau)'),
  ('vitamin_e',   15,   'm', 25, 51, 'DGE 2024', 'Vitamin E (Erwachsener Mann)'),
  ('vitamin_e',   12,   'w', 25, 51, 'DGE 2024', 'Vitamin E (Erwachsene Frau)'),
  ('folsaeure',   300,  'm', 25, 51, 'DGE 2024', 'Folsäure (Erwachsener Mann)'),
  ('folsaeure',   300,  'w', 25, 51, 'DGE 2024', 'Folsäure (Erwachsene Frau)'),
  ('niacin',      16,   'm', 25, 51, 'DGE 2024', 'Niacin (Erwachsener Mann)'),
  ('niacin',      13,   'w', 25, 51, 'DGE 2024', 'Niacin (Erwachsene Frau)'),

  -- Mineralstoffe
  ('calcium',   1000, 'm', 25, 51, 'DGE 2024', 'Calcium (Erwachsener Mann)'),
  ('calcium',   1000, 'w', 25, 51, 'DGE 2024', 'Calcium (Erwachsene Frau)'),
  ('eisen',     10,   'm', 25, 51, 'DGE 2024', 'Eisen (Erwachsener Mann)'),
  ('eisen',     15,   'w', 25, 51, 'DGE 2024', 'Eisen (Erwachsene Frau)'),
  ('magnesium', 400,  'm', 25, 51, 'DGE 2024', 'Magnesium (Erwachsener Mann)'),
  ('magnesium', 300,  'w', 25, 51, 'DGE 2024', 'Magnesium (Erwachsene Frau)'),
  ('kalium',    4000, 'm', 25, 51, 'DGE 2024', 'Kalium (Erwachsener Mann)'),
  ('kalium',    4000, 'w', 25, 51, 'DGE 2024', 'Kalium (Erwachsene Frau)'),
  ('natrium',   1500, 'm', 25, 51, 'DGE 2024', 'Natrium (Erwachsener Mann)'),
  ('natrium',   1500, 'w', 25, 51, 'DGE 2024', 'Natrium (Erwachsene Frau)'),
  ('zink',      14,   'm', 25, 51, 'DGE 2024', 'Zink (Erwachsener Mann)'),
  ('zink',      8,    'w', 25, 51, 'DGE 2024', 'Zink (Erwachsene Frau)'),
  ('phosphor',  700,  'm', 25, 51, 'DGE 2024', 'Phosphor (Erwachsener Mann)'),
  ('phosphor',  700,  'w', 25, 51, 'DGE 2024', 'Phosphor (Erwachsene Frau)'),
  ('jod',       200,  'm', 25, 51, 'DGE 2024', 'Jod (Erwachsener Mann)'),
  ('jod',       200,  'w', 25, 51, 'DGE 2024', 'Jod (Erwachsene Frau)');
