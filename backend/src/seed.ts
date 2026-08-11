import bcrypt from "bcryptjs";
import { prisma } from "./config/db";

// Seeds one test user per role plus a couple of sample products/customers
async function main() {
  const password = await bcrypt.hash("password123", 10);

  const roles = [
    { name: "Admin User", email: "admin@erp.test", role: "ADMIN" as const },
    { name: "Sales User", email: "sales@erp.test", role: "SALES" as const },
    { name: "Warehouse User", email: "warehouse@erp.test", role: "WAREHOUSE" as const },
    { name: "Accounts User", email: "accounts@erp.test", role: "ACCOUNTS" as const },
  ];

  for (const r of roles) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { ...r, password },
    });
  }

  await prisma.product.upsert({
    where: { sku: "SKU-001" },
    update: {},
    create: {
      name: "Steel Rod 10mm",
      sku: "SKU-001",
      category: "Raw Material",
      unitPrice: 450.0,
      stock: 500,
      minStock: 50,
      location: "Warehouse A",
    },
  });

  await prisma.product.upsert({
    where: { sku: "SKU-002" },
    update: {},
    create: {
      name: "Cement Bag 50kg",
      sku: "SKU-002",
      category: "Building Material",
      unitPrice: 380.0,
      stock: 200,
      minStock: 30,
      location: "Warehouse B",
    },
  });

  console.log("Seed complete. Test logins (password: password123):");
  roles.forEach((r) => console.log(`  ${r.role}: ${r.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
