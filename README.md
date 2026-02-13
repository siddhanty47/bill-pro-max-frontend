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
| Auth | Keycloak (password grant via REST API) |

## Getting Started

### Prerequisites

- Node.js 18+
- Backend running (see [bill-pro-max-backend-v2](../bill-pro-max-backend-v2/README.md))
- Docker infrastructure running (MongoDB, Redis, Keycloak)

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
| `VITE_API_URL` | _(empty - uses Vite proxy)_ | `https://api.billpromax.in/api/v1` | Backend API base URL |
| `VITE_KEYCLOAK_URL` | _(empty - uses Vite proxy)_ | `https://auth.billpromax.in` | Keycloak base URL |
| `VITE_KEYCLOAK_REALM` | `billpromax` | `billpromax` | Keycloak realm name |
| `VITE_KEYCLOAK_CLIENT_ID` | `billpromax-backend` | `billpromax-backend` | Keycloak client ID |
| `VITE_KEYCLOAK_CLIENT_SECRET` | _(set in .env)_ | _(set in hosting env)_ | Keycloak client secret |

**Development note:** Leave `VITE_API_URL` and `VITE_KEYCLOAK_URL` empty in dev. Vite's dev server proxies `/api` to `localhost:3001` and `/auth` to `localhost:8080` automatically (configured in `vite.config.ts`).

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
│   ├── authApi.ts         # Keycloak login/logout/refresh
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
│   ├── LoginPage.tsx       # Keycloak login form
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
└── types/
    └── index.ts            # Shared TypeScript interfaces
```

## Production Build

### Build for Vercel

Vercel auto-detects Vite projects. Set these environment variables in the Vercel dashboard:

- `VITE_API_URL` = `https://api.billpromax.in/api/v1`
- `VITE_KEYCLOAK_URL` = `https://auth.billpromax.in`
- `VITE_KEYCLOAK_REALM` = `billpromax`
- `VITE_KEYCLOAK_CLIENT_ID` = `billpromax-backend`

### Build with Docker

```bash
docker build \
  --build-arg VITE_API_URL=https://api.billpromax.in/api/v1 \
  --build-arg VITE_KEYCLOAK_URL=https://auth.billpromax.in \
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
