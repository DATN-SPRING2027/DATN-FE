// Explicit frontend simulation. Never used for KPI counts, API payloads or persistence.
export const operatorDemoSeries = [
  {
    name: "Active",
    data: [
      95, 99, 102, 113, 106, 102, 104, 107, 109, 111, 112, 114, 110, 112, 114,
      117, 112, 109, 108, 113, 115, 111, 112, 119, 116, 114, 115, 116, 119, 120,
      118,
    ],
  },
  {
    name: "Pending",
    data: [
      89, 88, 89, 101, 87, 75, 88, 95, 95, 93, 87, 94, 96, 93, 90, 87, 97, 98,
      96, 95, 93, 76, 95, 97, 96, 94, 93, 100, 102, 101, 98,
    ],
  },
  {
    name: "Suspended",
    data: [
      35, 38, 40, 43, 48, 64, 47, 42, 45, 48, 56, 52, 47, 51, 55, 63, 48, 42,
      45, 48, 49, 55, 52, 44, 48, 51, 57, 61, 54, 51, 59,
    ],
  },
];
export const operatorDemoDates = Array.from({ length: 31 }, (_, day) =>
  Date.UTC(2026, 7, day + 1),
);
