# OpsFlow AI: Manufacturing Document Processing & Analytics Engine

OpsFlow AI is a modern manufacturing intelligence application designed to automate, validate, and verify plant production logs. Using **Google Gemini 2.5 Flash Vision OCR**, the system ingests scanned physical sheets, extracts structured parameters, runs automated validation checks, and exposes an inspection verification queue for supervisor release.

---

## 🚀 Key Features

*   **AI Document Workspace (`/`)**: Drag-and-drop or browse run sheets (PDF, PNG, JPG, JPEG, etc.). Visual scan progress highlights OCR layout analysis.
*   **Split-Screen Interactive Review**: Preview original documents (using an inline scrollable PDF viewer or image renderer) side-by-side with editable verification form fields.
*   **Real-time AI Rules Engine**:
    *   Flags **Blockers** (e.g. quantity exceeding machine capacity of 1000, unregistered machine names).
    *   Flags **Warnings** (e.g. OCR reading confidence scores below 75%, missing Operator IDs).
*   **Verification Queue & Audit Trail (`/review`)**: Supervisors can review, correct, and sign off on runs or halt and reject anomalous logs. Completed verifications are logged in the historical audit trail.
*   **Plant Performance Metrics**: Top header displays live operational diagnostics:
    *   **88.5% OEE** (Plant Performance)
    *   **Documents Processed Today** (Dynamic live counter)
    *   **Average OCR Confidence** (Dynamic accuracy percentage)
*   **Operations Analytics (`/dashboard`)**: Visualizes allocation capacity by shift, machine allocation loads, and target vs. actual yield volumes with responsive charts.

---

## 🛠️ Technology Stack

*   **Framework**: Next.js 15 (App Router, Tailwind CSS, TypeScript)
*   **Database**: SQLite
*   **ORM**: Prisma 7 (using Driver Adapter for `@prisma/adapter-better-sqlite3` and `better-sqlite3`)
*   **AI Models**: Google Gemini 2.5 Flash (`@google/generative-ai`)
*   **Icons**: Lucide React
*   **Charts**: Recharts

---

## 📂 Project Structure

```bash
├── prisma/
│   ├── schema.prisma        # Database model declarations (SQLite datasource)
│   └── seed.ts              # Seeding script for plant machine assets
├── public/
│   └── uploads/             # Locally stored scanned PDFs and images
├── src/
│   ├── app/
│   │   ├── api/             # Next.js Serverless API endpoints
│   │   │   ├── dashboard/   # Aggregates shift, machine, & yield statistics
│   │   │   ├── history/     # Retrieves verification audit logs
│   │   │   ├── orders/      # Handles document OCR upload and validation
│   │   │   └── review/      # Handles supervisor sign-off and overrides
│   │   ├── dashboard/       # Dashboard page component
│   │   ├── history/         # History table page component
│   │   ├── review/          # Review Queue page component
│   │   ├── layout.tsx       # Root layout defining the shell
│   │   └── page.tsx         # Document center homepage upload workspace
│   ├── components/          # Reusable UI parts (Header, Sidebar, Charts)
│   └── lib/
│       ├── db.ts            # Prisma client instantiation with Better SQLite3
│       └── gemini.ts        # Gemini SDK configuration, OCR prompt, & mock fallback
├── .env.example             # Template for local environment configuration
├── tsconfig.json            # TypeScript build configuration
└── package.json             # NPM dependencies and project scripts
```

---

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a local `.env` file in the root directory:
```bash
cp .env.example .env
```
Provide your `GEMINI_API_KEY` in the `.env` file. If no key is provided, the application will fallback to a simulated high-fidelity mock OCR engine.

### 3. Initialize & Seed Database
```bash
npx prisma db push
npx prisma db seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📋 API Endpoints

*   **`POST /api/orders/import`**: Uploads physical run sheets, calls Gemini Vision OCR, executes validation rules, registers the production order, and stores the file in `public/uploads`.
*   **`GET /api/review`**: Retrieves quality inspections awaiting validation.
*   **`POST /api/review/[id]`**: Saves human corrected values, signs off on the inspection run, and releases the work order.
*   **`GET /api/dashboard`**: Computes plant metrics, shift document loads, machine allocation volumes, and target vs actual production yields.
*   **`GET /api/history`**: Lists historically verified and audited runs.

---

## 📖 Documentation Reference

*   Detailed workflow pipeline diagrams, schema declarations, and rules definitions are available in [AI_WORKFLOW.md](./AI_WORKFLOW.md).
