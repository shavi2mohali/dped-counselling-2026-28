# DPEd 2026-28 Counseling System

Firebase + React + TypeScript project skeleton for the Punjab D.P.Ed 2026-28 counseling system.

## Firestore Collections

- `candidates`: document ID is `RegistrationId`.
- `seatMatrix`: 11 documents, one per college, using the exact college name as the document ID.
- `allotments`: audit log of allotment actions.
- `settings`: global config, starting with `settings/global`.

## Seat Matrix Source

The seat matrix is hardcoded from the official D.P.Ed Session 2025-27 data and reused for counselling session 2026-28.

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
