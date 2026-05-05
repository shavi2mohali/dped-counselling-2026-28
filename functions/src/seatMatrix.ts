import type { SeatCounts } from "./models.js";

export interface SeedSeatMatrixEntry {
  collegeName: string;
  seats: SeatCounts;
  total: number;
  isActive: true;
  sourceSession: "2025-27";
  counsellingSession: "2026-28";
}

export const emptySeatCounts = (): SeatCounts => ({
  General: 0,
  EWS: 0,
  BC: 0,
  "SC (RO)": 0,
  "SC(MB)": 0,
  "Ex serviceman (Gen)": 0,
  "Ex serviceman (BC)": 0,
  "Ex serviceman (SC)": 0,
  "General (FF)": 0,
  "Gen (Sports)": 0,
  "SC (Sports)": 0,
  "Phy Handicapped": 0,
});

export const SEAT_MATRIX: SeedSeatMatrixEntry[] = [
  {
    collegeName: "Akal college of Physical education, Gurusagar",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 1, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 0, "SC (Sports)": 0, "Phy Handicapped": 2 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Govind National College of Physical education, Narangwal ludhiana",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 1, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 0, "SC (Sports)": 0, "Phy Handicapped": 2 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Khalsa college of physical Education, Amritsar",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 0, "Ex serviceman (SC)": 2, "General (FF)": 0, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Malwa college of Physical education, Bathinda",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 0, "Ex serviceman (SC)": 2, "General (FF)": 0, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Mata Gurdev kaur shahi college, jhakdaudi, Ludhiana",
    seats: { General: 11, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 1, "Ex serviceman (SC)": 2, "General (FF)": 0, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Professor Gursewak Singh Government College of Physical education, Patiala",
    seats: { General: 19, EWS: 5, BC: 5, "SC (RO)": 5, "SC(MB)": 5, "Ex serviceman (Gen)": 3, "Ex serviceman (BC)": 2, "Ex serviceman (SC)": 2, "General (FF)": 1, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 2 },
    total: 50,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "S. Rajinder Chahal college of Physical Education kalyan, Patiala",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 0, "Ex serviceman (SC)": 1, "General (FF)": 1, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Saint Soldier college of Physical Education, Lidran, jalandhar",
    seats: { General: 11, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 3, "Ex serviceman (BC)": 0, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 1, "SC (Sports)": 1, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Shaheed kansi Ram College of Physical Education, Bhago majra, mohali",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 1, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 0, "SC (Sports)": 0, "Phy Handicapped": 2 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "Shri Guru Gobind singh Khalsa College, Mehadpur, hoshiarpur",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 2, "Ex serviceman (BC)": 1, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 1, "SC (Sports)": 0, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
  {
    collegeName: "The enlightened college of Physical education, Jhunir, Mansa",
    seats: { General: 12, EWS: 3, BC: 3, "SC (RO)": 3, "SC(MB)": 3, "Ex serviceman (Gen)": 3, "Ex serviceman (BC)": 0, "Ex serviceman (SC)": 1, "General (FF)": 0, "Gen (Sports)": 0, "SC (Sports)": 1, "Phy Handicapped": 1 },
    total: 30,
    isActive: true,
    sourceSession: "2025-27",
    counsellingSession: "2026-28",
  },
];

export const TOTAL_SEATS = 350;
