import { prisma } from "../config/db";

// Generates a sequential challan number like CH-2026-0001
export async function generateChallanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.salesChallan.count({
    where: {
      challanNumber: { startsWith: `CH-${year}-` },
    },
  });
  const next = String(count + 1).padStart(4, "0");
  return `CH-${year}-${next}`;
}
