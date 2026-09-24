# İSTREGISTER

Kamera əsaslı kurs qeydiyyat sistemi — React + Vite + Firebase Realtime Database.
Sırf frontend (client-side) tətbiqdir — backend server tələb olunmur, buna görə istənilən statik hosting platformasında deploy edilə bilər.

## Tələblər

- Node.js 20+ (tövsiyə: 22)
- npm (və ya pnpm/yarn)

## Lokal işə salma

```bash
npm install
npm run dev
```

Bu, `http://localhost:5173` ünvanında dev serveri işə salacaq.

## Production build

```bash
npm install
npm run build
```

Nəticə `dist/` qovluğuna yazılır — bu, istənilən statik hosting-ə yükləyə biləcəyiniz tam hazır fayllar toplusudur (`index.html` + `assets/`).

Nəticəni lokal yoxlamaq üçün:

```bash
npm run preview
```

## Deploy — platforma seçimləri

Bu layihə üçün backend server, verilənlər bazası konfiqurasiyası və ya sirli açar (secret) tələb olunmur — bütün məlumat mövcud olan Firebase layihəsində saxlanılır (`src/lib/firebase.js`-də konfiqurasiya artıq daxil edilib, çünki Firebase Web SDK açarları client-side açıq olması normaldır; təhlükəsizlik Firebase Realtime Database Rules ilə təmin olunur — bax aşağıda).

### Vercel
1. Bu qovluğu GitHub-a push edin (və ya Vercel CLI ilə birbaşa yükləyin).
2. Vercel-də "New Project" → repo-nu seçin.
3. Framework preset: **Vite** (avtomatik tanınacaq).
4. Build command: `npm run build`, Output directory: `dist`.
5. Deploy.

### Netlify
1. Repo-nu Netlify-ə qoşun (və ya `netlify deploy` CLI).
2. Build command: `npm run build`
3. Publish directory: `dist`

### Firebase Hosting (məntiqli seçim, çünki artıq Firebase layihəsindəsiniz)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist, single-page app: Yes
npm run build
firebase deploy
```

### GitHub Pages
Sub-path altında yerləşəcəyi üçün `BASE_PATH` təyin edin:
```bash
BASE_PATH=/REPO-ADI/ npm run build
```
Sonra `dist/` qovluğunu `gh-pages` branch-ına push edin (məs. `gh-pages` npm paketi ilə).

### Hər hansı statik hosting / öz serveriniz
`npm run build`-dən sonra yaranan `dist/` qovluğunu istənilən statik fayl serverinə (Nginx, Apache, S3+CloudFront, Cloudflare Pages və s.) yükləmək kifayətdir. Tək qayda: bütün naməlum route-lar `index.html`-ə yönləndirilməlidir (SPA fallback), çünki tətbiq client-side routing istifadə edir.

## Environment dəyişənləri (istəyə bağlı)

- `PORT` — dev/preview server portu (default: 5173)
- `BASE_PATH` — sub-path altında deploy edərkən (məs. GitHub Pages) — default: `/`

Heç bir `.env` faylı və ya sirli açar tələb olunmur.

## Giriş kodları

- Admin panelinə giriş: tətbiq daxilində müəyyən edilib (`AdminPanel.jsx`).
- İstifadəçi giriş kodu (passcode) ilkin olaraq `0706`-dır, admin panelindən dəyişdirilə bilər — Firebase deyil, brauzerin `localStorage`-ində saxlanılır (cihaz-spesifikdir).

## Təhlükəsizlik qeydi

Firebase Realtime Database-ə oxuma/yazma icazələrini Firebase Console → Realtime Database → Rules bölməsindən idarə edin. Client-side Firebase konfiq açarları (apiKey və s.) gizli deyil — təhlükəsizlik bu Rules ilə təmin olunmalıdır, konfiqurasiyanı gizlətməklə deyil.

## Struktur qeydi

Bu layihə əvvəlcə daha böyük bir Replit monorepo şablonu (pnpm workspaces, boş Express API server, istifadə olunmayan Postgres/Drizzle DB paketi) daxilində idi. Həmin backend/DB hissəsi tətbiq tərəfindən heç vaxt istifadə edilmirdi (bütün data Firebase-dədir), ona görə tam işlək və portativ olması üçün çıxarılıb və müstəqil layihəyə çevrilib.
