# Competitive Audit - April 2026

This document captures raw audit findings for later product planning. It uses German clinics as the primary market lens and should be treated as strategy input, not as an implementation source of truth.

## Current Product Position

Operation Prodi is already broader than a direct PRODI clone. The current app combines German nutrition analysis, patient workflow, practice operations, reports, and early institutional meal operations in a modern SaaS architecture.

Implemented or materially present strengths:
- **Modern clinical SaaS foundation:** Next.js app shell, Supabase persistence, auth/RBAC, local fallback patterns, exports, and Playwright coverage.
- **Nutrition database workflows:** Foods, custom foods, server-backed search, synonyms, comparison, reference values, exchange tables, BLS-based data flows, and Open Food Facts product staging/promotion.
- **Recipe and meal planning workflows:** Recipe CRUD, Meal-Master-style import support, cached nutrient totals, meal planning, BE/Broteinheiten and Einzelanalyse surfaces, multi-plan Vergleich + descriptive statistics (matches DGExpert's Soll-Ist parity), Planvorlagen with browseable system and personal templates, Einkaufsliste-Aggregator across plans with synonym consolidation, additive (Zusatzstoffe / E-Nummern) declarations, print/report handoff, and production/shopping outputs for institution menus.
- **Patient and clinical workspace:** Patients, anthropometrics, diagnoses, medications, screenings, lab values, activity, allergens, counseling sessions, counseling templates, and patient-bound report history.
- **Digital protocol workflow:** Public patient diary links, practitioner review, NLP/fuzzy food matching, conversion into internal nutrition protocol drafts, and server-tracked converted state.
- **Clinical reporting and exports:** PDF/CSV report generation, patient-bound immutable report versions, mail merge PDFs, export job history, and private report file storage.
- **Institution and hospital bridge:** Menu cycles, nutrient compliance, inpatient stay assignment, diet/allergen-safe meal selection, kitchen aggregation, and printable tray cards.
- **Practice operations:** Appointments, invoices, dashboard KPIs, practice statistics, admin users, tariff surface, and role-based access foundations.

Current strategic position:
- Strongest claim: **cloud-native German clinical nutrition workflow with a patient-to-kitchen bridge**.
- Best immediate buyer fit: **German clinics and clinical nutrition departments** that need modern workflows but are not ready for heavy enterprise foodservice systems.
- Main risk: the product must prove scientific/data credibility and clinic IT readiness before it can displace entrenched desktop or enterprise systems.

## Competitor Landscape

German scientific and counseling tools:
- **PRODI 7.5** - German professional baseline for nutrition counseling, clinics, pharmacies, and menu planning. Public materials describe BLS extract data, NutriBase product data, recipes, day/menu plans, protocol analysis, DGE/OeGE comparisons, patient management in higher tiers, web-based client protocol, diabetes counseling, billing, appointment planning, costs, and CO2 data. It remains Windows-oriented with high up-front pricing. Source: https://www.nutri-science.de/software/prodi.php
- **DGExpert 2.0** - DGE-backed Windows software for nutrition counseling and community catering. It emphasizes DGE authority, BLS 3.02, client management, intake protocols, recipe and meal-plan management, Soll-Ist comparison, and network permissions. Sources: https://www.dge.de/ernaehrungsberatung/dgexpert/ and https://www.dge.de/ernaehrungsberatung/dgexpert/preise/
- **OptiDiet** - German counseling and clinic-oriented nutrition software with DGE recommendations, indication-specific diet information, automatic optimization, allergy search, LMIV allergen tooling, and sustainability/CO2 positioning. Source: https://www.goe-software.de/
- **nut.s** - DACH nutrition software platform for consulting, science, kitchens, and industry. It offers modular data coverage such as BLS, OeNWT, USDA, Swiss food data, allergens, yields/retentions, LMIV labeling, raw data, statistics, protocols, FFQ/diet history, menu planning, and industrial labeling. Sources: https://www.nutritional-software.at/ and https://www.nutritional-software.at/content/preisuebersicht/kaufpreise/
- **EBIS-light / EBISpro** - Legacy nutrition counseling and diet creation niche, including food-frequency-style workflows. Source: https://www.nutrisurvey.de/ebispro/ebislight/
- **NutriGuide** - German nutrition calculation software focused on analysis, product/labeling workflows, pricing, and margin management. Sources: https://www.exafol.com/products/nutriguide and https://www.capterra.com/p/219315/NutriGuide/

Modern dietitian SaaS and client engagement tools:
- **Nutrium** - Cloud platform for dietitians with client app, meal plans, food diary, chat, reminders, progress tracking, and telehealth-style workflow expectations. Source: https://nutrium.com/professionals
- **NutriAdmin** - Practice-management and meal-planning platform with records, questionnaires, reports, calendar, payments, client portal, recipes, nutrition analysis, meal-plan generation, AI recipes, and telehealth add-ons. Source: https://nutriadmin.com/pricing
- **Foodzilla** - AI-oriented meal planning for dietitians and coaches with meal-plan generation, recipe library, client app/portal, branded PDFs, chat, payments, and white-label options. Source: https://foodzilla.com/pricing
- **That Clean Life** - Recipe and meal-plan content workflow with templates, branded PDF exports, filters, and advanced nutrition. Source: https://thatcleanlife.com/pricing
- **Healthie** - Practice-management and telehealth platform for health and nutrition practices with scheduling, payments, forms, EHR, telehealth, messaging, food/lifestyle journaling, and programs. Source: https://www.gethealthie.com/healthie-pricing

Enterprise healthcare and foodservice systems:
- **Nutritics** - Enterprise food data, healthcare, foodservice, recipe/menu management, allergens, supplier updates, costing, labeling, and patient ordering. It is a strong benchmark for institutional data breadth and menu operations. Source: https://www.nutritics.com/en/sectors/healthcare/
- **SANALOGIC** - DACH hospital, care, and community-catering suite with recipes, meal plans, BLS II nutrient calculation, LMIV, ordering, purchasing, production, tray logistics, and allergy/intolerance/diet-form checks. Source: https://www.sanalogic.com/loesungen/
- **OrgaCard** - DACH hospital menu ordering and kitchen logistics with bedside/dining-hall menu ordering, meal-plan reports, ingredients, nutrients, LMIV, allergens, tray cards, exports, and kitchen/logistics modules. Source: https://www.orgacard.de/software/kueche/menuebestellung
- **JOMOsoft** - DACH catering and clinic foodservice suite with menu planning, ordering, logistics, purchasing, inventory, cost control, HACCP, CO2/allergens, and clinic system interfaces. Sources: https://www.jomosoft.de/ and https://www.jomosoft.de/Klinikverpflegung-3314.htm

## Clinic-First Gaps

The most important missing or incomplete capabilities for German clinic sales are:
- **Scientific data moat:** SFK, broader official data coverage, full BLS expansion, OeNWT/Swiss/USDA/AFCD options, multilingual food names, and direct clinical manufacturer feeds.
- **Database lifecycle management:** Global food replacement, database version migrations, nutrient-source diffing, release notes, and audit-friendly source/version traceability.
- **Clinic IT readiness:** HL7 v2 import, FHIR sync, SSO via SAML/OIDC, LDAP/Active Directory mapping, API keys, webhooks, integration persistence, and production-grade device connectors.
- **Audit and compliance:** Record access logs, export logs beyond generic jobs, report retention policies, diet-order override logs, role-change logs, and procurement-ready security documentation.
- **Clinical modules:** Diabetes counseling depth, renal/nutrition-support workflows, structured food-frequency/anamnesis forms, diagnosis-specific intervention templates, and stronger indication-based decision support.
- **Documentation packs:** Arztbrief, Ernährungsbericht, Übergabe Küche, Verlaufsbericht, Qualitätsbericht, patient handouts, and clinic-specific document templates.
- **Hospital kitchen depth:** Supplier pricing, inventory, purchase exports, LMIV label printing, production batch states, waste tracking, multi-site controls, and deeper allergy/diet-form production checks.
- **Patient engagement:** Patient portal/PWA for diary entry, report delivery, meal-plan feedback, reminders, secure messaging, and follow-up tracking.
- **Commercial readiness:** Live subscription/checkout or clinic contract management, procurement packet, migration onboarding, sales demo flows, and data-import tooling from incumbent systems.

## Recommended Priority

> **Note:** This ordering is clinic-first strategy input. It is now subordinate to `docs/user-priority-feedback.md`, the current #1 product guideline, which leans toward practitioner/counseling usability (intuitive UX, PAL-adjustable references, nutrient sort/filter, custom foods/recipes, portions, Word/Excel export). Treat the list below as the clinic-readiness track, not as the default next-up order.

For German clinics, prioritize work in this order:

1. **Data credibility:** SFK/full BLS expansion, source/version visibility, calculation validation, and database update workflows.
2. **Clinic IT readiness:** SSO, audit logs, HL7/FHIR, API keys, webhooks, and production connector foundations.
3. **Patient-to-kitchen bridge:** Diet orders, allergen-safe meal selection, tray cards, kitchen reports, and institution analytics.
4. **Clinical documentation:** Immutable report history, report packs, patient handouts, clinic handoff documents, and export retention policy.
5. **Patient portal:** Remote diary, report delivery, follow-up reminders, patient feedback, and secure communication.
6. **Commercial and procurement readiness:** Clinic pricing, contract/admin flows, migration tools, security documentation, and guided demo/onboarding flows.

## Strategic Direction

The strongest differentiation is not to copy PRODI feature by feature. The better target is:

> A cloud-native German clinical nutrition system that preserves PRODI/DGExpert scientific trust, adds modern patient engagement, and connects dietitians to hospital meal operations without becoming a heavy kitchen ERP.

AI should be positioned as workflow assistance, not as scientific authority. Suitable uses include food matching, protocol cleanup, report drafting, recipe substitution, diet/allergen conflict explanation, meal-plan variants, and patient-friendly summaries. Nutrient calculations and clinical outputs should remain traceable to approved data sources and deterministic calculation logic.
