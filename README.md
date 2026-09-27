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

The static `public/family-data.js` is the last published snapshot. It contains Hebrew and Russian names for 88 people. Family Echo spellings are preserved in the original GEDCOM in `upload/` for comparison; confirm ambiguous transliterations with relatives.

The live editable source is Supabase. Apply `supabase/migrations/20260927_family_tree.sql`, then `supabase/migrations/20260927_family_seed.sql` to a dedicated project. In `public/config.js`, set `window.SUPABASE_CONFIG = { url: 'https://PROJECT_REF.supabase.co', key: 'sb_publishable_...' }`. Only the publishable key belongs in a web page. Create an Auth user with a verified email and add its UUID to `public.family_admins`; there is deliberately no client-side administrator secret. The admin page at `/admin.html` can edit names in both languages, memorial status, notes, and photos and create a person. Family links live in `family_units` and `family_members`; the admin form does not yet edit those links. Photos are public, limited to JPEG/PNG/WebP and 5 MB, and uploads require an admin session. Database read errors fall back to the static snapshot so the public tree remains available, though recent edits will be absent during an outage.
