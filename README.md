# DPEd 2026-28 Counseling System

Firebase + Vite React + TypeScript project for the Punjab D.P.Ed 2026-28 counseling system.

## Clean Project Structure

```text
dped-counselling-2026-28/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
├── functions/
│   ├── src/
│   └── package.json
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc
├── .gitignore
└── README.md
```

## Root Commands

```bash
npm run dev
npm run build
npm run deploy
npm run functions:build
npm run functions:deploy
```

## Admin Login

Use the following credentials for admin access:

Username / Email: `shavi2me@admin.com`
Password: `shavi2me@6124`

Important:

- Change this password after first deployment.
- Do not commit real production passwords to a public repository.
- For production, create the admin user in Firebase Authentication and store role/permission in Firestore if required by the app.

## Cleanup Notes

The repository is intentionally organized with React code only inside `client/` and Cloud Functions only inside `functions/`.

Removed from the root during cleanup:

- Duplicate Vite React files: `src/`, `index.html`, `vite.config.*`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`
- Root frontend build/dependency outputs: `dist/`, `node_modules/`, root `package-lock.json`
- Unused default Vite client assets: `client/src/App.css`, `client/src/assets/`

Kept at the root:

- Firebase config: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`
- Cloud Functions: `functions/`
- Client app: `client/`
- Project metadata: `package.json`, `.gitignore`, `README.md`

## Firestore Collections

- `candidates`: document ID is `RegistrationId`.
- `seatMatrix`: 11 documents, one per college, using the exact college name as the document ID.
- `allotments`: audit log of allotment actions.
- `settings`: global config, starting with `settings/global`.

## Seat Matrix Source

Seat matrix is uploaded/imported from Excel for D.P.Ed 2026-28 and stored in Firestore collection `seatMatrix`.

Total seats: `350`.

## Candidate Import Function

Callable Cloud Function: `importCandidates`

Expected request:

```ts
{
  storagePath: "candidate-imports/dped-2026-28.xlsx",
  bucketName?: "optional-custom-bucket",
  sheetName?: "Sheet1",
  dryRun?: true,
  columnMap?: {
    RegistrationId?: "Registration No",
    Name?: "Candidate Name",
    DOB?: "Date of Birth",
    Father_Name?: "Father Name",
    Mother_Name?: "Mother Name",
    Category_Name?: "Category",
    MarksObtained10?: "Matric Obtained",
    TotalMarks10?: "Matric Total",
    Percentage10?: "Matric %",
    MarksObtained12?: "12th Obtained",
    TotalMarks12?: "12th Total",
    Percentage12?: "12th %",
    District?: "District",
    State?: "State"
  }
}
```

The importer reads the Excel file from Firebase Storage with `xlsx`, calculates `percentage10` and `percentage12` when only marks and totals are present, applies Punjab domicile/reservation rules, ranks candidates by `percentage12` descending, then `percentage10` descending, then DOB older first, and writes valid rows to `candidates/{RegistrationId}`.

Non-Punjab candidates keep `originalCategoryName` for display but receive `category: "General"`, `effectiveCategoryName: "General"`, and `eligibleForReservation: false`.

## Project Folders

```text
.
├── functions/
│   ├── src/
│   │   ├── index.ts
│   │   ├── models.ts
│   │   └── seatMatrix.ts
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── components/
│   ├── data/
│   │   └── seatMatrix.ts
│   ├── firebase/
│   │   └── app.ts
│   ├── hooks/
│   ├── models/
│   │   └── counselling.ts
│   ├── pages/
│   ├── services/
│   ├── styles/
│   ├── utils/
│   └── main.tsx
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
