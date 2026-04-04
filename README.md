# BillProMax Frontend

React SPA for the BillProMax scaffolding rental business management platform. Built with React 19, TypeScript, Redux Toolkit (RTK Query), and Vite.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 5.4 |
| State Management | Redux Toolkit + RTK Query |
| Routing | React Router DOM 7 |
| Forms | React Hook Form + Zod validation |
| Auth | Supabase Auth (OAuth + email/password) |

## Getting Started

### Prerequisites

- Node.js 18+
- Backend running (see [bill-pro-max-backend-v2](../bill-pro-max-backend-v2/README.md))

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start development server
npm run dev
```

The app will be available at **http://localhost:5174**.

### Environment Variables

| Variable | Dev Default | Production Example | Description |
|----------|-------------|-------------------|-------------|
| `VITE_API_URL` | _(empty - uses Vite proxy)_ | `https://api.billpromax.com/api/v1` | Backend API base URL |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | `https://your-project.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | _(set in .env)_ | _(set in hosting env)_ | Supabase anonymous key |

**Development note:** Leave `VITE_API_URL` empty in dev. Vite's dev server proxies `/api` to `localhost:3001` automatically (configured in `vite.config.ts`).

## Scripts

```bash
npm run dev       # Start dev server with hot reload (port 5174)
npm run build     # TypeScript check + Vite production build -> dist/
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

## Project Structure

```
src/
├── main.tsx               # App entry point
├── App.tsx                # Routes and layout
├── App.css                # Global styles
├── api/                   # RTK Query API modules
│   ├── baseApi.ts         # Base API + auth headers + 401 handling
│   ├── authApi.ts         # Supabase login/logout/OAuth
│   ├── businessApi.ts     # Business CRUD
│   ├── partyApi.ts        # Parties + sites
│   ├── agreementApi.ts    # Agreements + rates
│   ├── inventoryApi.ts    # Inventory items
│   ├── challanApi.ts      # Challans (delivery/return)
│   ├── billApi.ts         # Bills + payment summary
│   ├── paymentApi.ts      # Payments
│   └── gstinApi.ts        # GSTIN lookup
├── components/
│   ├── Layout.tsx          # App shell with sidebar + header
│   ├── ProtectedRoute.tsx  # Auth guard
│   ├── DataTable.tsx       # Reusable data table
│   ├── Modal.tsx           # Modal dialog
│   ├── ErrorMessage.tsx    # Error display
│   ├── LoadingSpinner.tsx  # Loading indicator
│   └── forms/              # Form components for each entity
├── pages/
│   ├── LoginPage.tsx       # Login form + Google OAuth
│   ├── DashboardPage.tsx   # Business overview
│   ├── PartiesPage.tsx     # Clients & suppliers management
│   ├── AgreementsPage.tsx  # Rental agreements
│   ├── InventoryPage.tsx   # Inventory management
│   ├── ChallansPage.tsx    # Delivery/return challans
│   ├── BillsPage.tsx       # Invoice management
│   └── PaymentsPage.tsx    # Payment tracking
├── store/
│   ├── index.ts            # Redux store setup
│   └── authSlice.ts        # Auth state (token, user, business)
├── hooks/
│   ├── useAuth.ts          # Login/logout/auth state hook
│   └── useCurrentBusiness.ts  # Business selection hook
├── lib/
│   └── supabase.ts         # Supabase client initialization
└── types/
    └── index.ts            # Shared TypeScript interfaces
```

## Scan Photo to Auto-Fill Challan

The challan form includes a "Scan from Photo" feature that uses the backend's Claude Vision API integration to extract structured data from photos of handwritten challans.

### Flow

1. User clicks "Scan from Photo" in `ChallanForm` and uploads a photo (JPEG/PNG/WebP, ≤5MB)
2. `useExtractChallanFromPhotoMutation()` (from `challanApi.ts`) sends the photo as `FormData` to the backend
3. Backend processes the image via Claude Vision API and returns `ExtractedChallanData`
4. `applyExtractedData()` in `ChallanForm.tsx` populates form fields via `setValue()` / `replaceItems()`
5. Extraction warnings (if any) are displayed to the user
6. User reviews, edits, and submits the form normally

### Key Files

| File | Purpose |
|------|---------|
| `src/api/challanApi.ts` | `useExtractChallanFromPhotoMutation` — RTK Query mutation |
| `src/components/forms/ChallanForm.tsx` | `handlePhotoUpload()`, `applyExtractedData()` — upload + form fill |
| `src/types/index.ts` | `ExtractedChallanData`, `ExtractedChallanItem` — response types |
| `src/components/forms/ChallanForm.module.css` | `.photoUpload`, `.uploadBtn`, `.extractionWarnings` |

### Extracted Fields

| Field | Form Action |
|-------|-------------|
| `type` | Sets delivery/return mode |
| `date` | Sets date picker |
| `partyId` | Selects party in dropdown |
| `agreementId` | Selects agreement in dropdown |
| `challanNumber` | Extracts sequence number |
| `items[]` | Populates item rows (itemId + quantity) |
| `damagedItems[]` | Populates damaged items (return challans only) |
| `transporterName`, `vehicleNumber`, `cartageAmount` | Sets transport fields |
| `confidence`, `warnings[]` | Displays extraction quality info |

---

## Production Build

### Build for Vercel

Vercel auto-detects Vite projects. Set these environment variables in the Vercel dashboard:

- `VITE_API_URL` = `https://api.billpromax.com/api/v1`
- `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `your-anon-key`

### Build with Docker

```bash
docker build \
  --build-arg VITE_API_URL=https://api.billpromax.com/api/v1 \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t billpromax-frontend .

docker run -p 8081:80 billpromax-frontend
```

### Local Production Test

From the workspace root:

```bash
docker compose -f docker-compose.prod.yml up --build
# Frontend at http://localhost:8081
```

## License

Private - All rights reserved.
