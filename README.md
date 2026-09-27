# עץ משפחת ספובל

אתר סטטי לתצוגת עץ המשפחה. אינו דורש מסד נתונים או חשבונות משתמשים.

## עדכון העץ

1. ייצאו את העץ מ־Family Echo בפורמט GEDCOM.
2. שמרו את הקובץ בשם `source/family.ged` (התיקייה אינה נכללת ב־Git).
3. הריצו `python3 scripts/import_gedcom.py` ושמרו את `public/family-data.js` במאגר.

הייבוא כולל שמות וקשרי משפחה בלבד. תאריכים מלאים, הערות ושאר פרטים אישיים אינם נכללים באתר. בדקו עם בני המשפחה לפני פרסום נתונים על אנשים חיים.

## פריסה

ייבאו את המאגר לפרויקט Vercel חדש. הקובץ `vercel.json` מגדיר פריסה סטטית של התיקייה `public`, ללא Build Command. המאגר ופרויקט Vercel נפרדים מחיטוב ישראל.

## Bilingual data and administration

The static `public/family-data.js` is the last published snapshot. It contains Hebrew and Russian names for 90 people, including two relatives preserved from the earlier six-person Supabase prototype. Family Echo spellings are preserved in the original GEDCOM in `upload/` for comparison; confirm ambiguous transliterations with relatives.

The live editable source is Supabase. Apply `supabase/migrations/20260927_family_tree.sql`, then `supabase/migrations/20260927_family_seed.sql` to a dedicated project. The project is linked through `public/config.js` to the existing Supabase project named Spoval Family Tree (ref `spozwdonkcdtdgncsxah`). The original `people`, `relationships`, `profiles`, trivia tables, and `photos` bucket remain untouched; new tables and the `family-photos` bucket hold the expanded tree. Two existing photos appear in the new tree via their old bucket paths. Only the publishable key belongs in a web page. The existing verified Supabase Auth user `ilayspo@gmail.com` is authorized in `public.family_admins`; there is deliberately no client-side administrator secret. The admin page at `/admin.html` can edit names in both languages, memorial status and photos and create a person. Family links live in `family_units` and `family_members`; the admin form does not yet edit those links. `supabase/migrations/20260927_family_security.sql` records the additional permission restriction applied after the initial schema migration. Photos are public, limited to JPEG/PNG/WebP and 5 MB, and uploads require an admin session. Database read errors fall back to the static snapshot so the public tree remains available, though recent edits will be absent during an outage.
