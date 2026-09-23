# İSTREGISTER — Tədris Reyestri İdarəetmə Sistemi

Industrial Support and Training MMC təlim mərkəzinin tələbə qeydiyyat reyestrinin (REGİSTR-2026.xlsx) produksiyaya hazır veb tətbiqi.

## Xüsusiyyətlər

- **🔍 Qlobal axtarış** — bütün sütunlar üzrə real-time axtarış
- **📊 Sütun üzrə filtr** — Excel-vari filtr paneli, bir neçə sütun eyni anda (AND məntiqi)
- **🔗 Kurs üzrə sənəd filteri** — Course Code filterində seçilən kurs Protokol siyahısında da tətbiq olunur
- **⚡ Virtualised cədvəl** — AG-Grid vasitəsilə 3000+ sətir axıcı scroll
- **📋 Training Plan** — filtrlənmiş məlumatdan Excel sənəd yaradılması
- **🗒️ Jurnal** — `src/assets/jurnal_template.xlsx` əsil faylını 1:1 şablon kimi istifadə edərək (GDC-1/HSE/qeyd), maksimum 6 günlük səhifə qaydası ilə yaradılır
- **📄 Protokol** — mövcud Jurnal qrupundan (qrup nömrəsi, kurs, tarix, iştirakçılar) `src/assets/protokol_template.docx` əsasında avtomatik yaradılır, ona görə iki sənəd heç vaxt uyğunsuz ola bilməz
- **🖱️ Protokol menyusu** — Protokol düyməsi sağ yuxarıdan çıxarılıb; aktiv filterli sətirdə sağ klik və ya uzun basma menyusundan açılır və qrup nömrəsi avtomatik təklif olunur
- **🔄 Qrup sinxronizasiyası** — Training Plan qrup nömrəsi həmin kurs/tarix üçün Jurnala ötürülür; admin arxivdə manual düzəliş edə bilər
- **⚡ Sürətli açılış** — Firebase ilk snapshot-u gecikdirsə belə, lokal registr dərhal göstərilir və realtime məlumat gələn kimi avtomatik yenilənir
- **📄 Kontekst menyu** — sağ klik / mobil uzun basış
- **📱 Responsive** — masaüstü, planşet və mobil tam dəstəklənir

## Quraşdırma

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run preview  # preview production build
```

## Firebase İnteqrasiyası

Tətbiq hazırda statik məlumat rejimində işləyir (REGİSTR-2026.xlsx-dan idxal edilən JSON).

Firebase Realtime Database-i aktivləşdirmək üçün `src/lib/firebase.js` faylında
konfiqurasiya dəyərlərini daxil edin, sonra `src/services/registryService.js` 
məlumatları Firebase-dən oxumağa başlayacaq.

## Data Strukturu

- `src/data/registrData.json` — REGİSTR-2026.xlsx-dan idxal edilən 3265 qeyd
- `src/data/adminPanel.json` — Kurs kodu → Gün sayı lüğəti
- `src/data/courses.js` — Kurs kodları, tam adları, qısa adları (abreviatura) və saatları
- `src/data/teachers.js` — Müəllim siyahısı
- `src/assets/jurnal_template.xlsx` — Jurnal üçün əsil master şablon (dəyişdirilmədən istifadə olunur)
- `src/assets/protokol_template.docx` — Protokol üçün əsil master şablon (dəyişdirilmədən istifadə olunur)
