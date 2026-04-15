-- Ensure rerunning the BLS ETL does not create duplicate synonyms
ALTER TABLE public.food_synonyms
  ADD CONSTRAINT food_synonyms_food_locale_source_name_key
  UNIQUE (food_id, locale, source, name);
