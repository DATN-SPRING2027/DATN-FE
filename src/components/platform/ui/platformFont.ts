import { Roboto } from "next/font/google";
export const platformFont = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
  variable: "--font-platform",
});
