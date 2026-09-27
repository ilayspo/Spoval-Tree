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

The live editable source is Supabase. Apply `supabase/migrations/20260927_family_tree.sql`, then `supabase/migrations/20260927_family_seed.sql` to a dedicated project. The project is linked through `public/config.js` to the existing Supabase project named Spoval Family Tree (ref `spozwdonkcdtdgncsxah`). The original `people`, `relationships`, `profiles`, trivia tables, and `photos` bucket remain untouched; new tables and the `family-photos` bucket hold the expanded tree. Two existing photos appear in the new tree via their old bucket paths. Only the publishable key belongs in a web page. The existing verified Supabase Auth user `ilayspo@gmail.com` is authorized in `public.family_admins`; there is deliberately no client-side administrator secret. The admin page at `/admin.html` can edit names in both languages, memorial status and photos and create a person. Family links live in `family_units` and `family_members`; the admin form does not yet edit those links. `supabase/migrations/20260927_family_security.sql` records the additional permission restriction applied after the initial schema migration. Photos are public, limited to JPEG/PNG/WebP and 5 MB, and uploads require an admin session. When the configured database is unavailable, the public page shows an unavailable message instead of an outdated snapshot.

## Family relationships and dates (September 28)

`20260928_family_relationships.sql` adds approximate dates (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`), a reversible visibility flag for removing a person from the public tree, and explicit relationship status plus current/former state per family unit. An origin family identifies the child's actual parent set; half-siblings can share one parent and remain in different units. In the source export, Yuli Sherez (`I48`) was wrongly assigned to Aviv and Yelena's unit. She is now in a separate single-parent unit with Aviv (`F40`), with her other parent unspecified. The static snapshot mirrors this correction.

The public homepage starts at the deepest recorded ancestor on the Rubin branch and offers a return-to-root button. The admin form creates or restores people and lets the editor link parents, children, and partners, update a couple's status, or remove a mistaken member connection. Removing a profile hides it and its links from public reads but keeps it in admin for restoration. With a database connection configured, the public loader does not fall back to a stale bundled snapshot when the live database is unavailable, because that could expose profiles later hidden by an editor.
