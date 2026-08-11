import { Request, Response } from "express";
import { z } from "zod";
import { Product } from "@prisma/client";
import { prisma } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { generateChallanNumber } from "../utils/generateChallanNumber";

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).optional(), // defaults to DRAFT
});

// GET /challans?status=&customerId=&page=&limit=
export const listChallans = asyncHandler(async (req: Request, res: Response) => {
  const { status, customerId, page = "1", limit = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [items, total] = await Promise.all([
    prisma.salesChallan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { customer: { select: { name: true, businessName: true } }, items: true },
    }),
    prisma.salesChallan.count({ where }),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

export const getChallan = asyncHandler(async (req: Request, res: Response) => {
  const challan = await prisma.salesChallan.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: true, createdBy: { select: { name: true } } },
  });
  if (!challan) throw new ApiError(404, "Challan not found");
  res.json(challan);
});

// Creates a challan. If status is CONFIRMED at creation time, stock is deducted immediately.
export const createChallan = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createChallanSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);
  const { customerId, items, status } = parsed.data;
  const finalStatus = status || "DRAFT";

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new ApiError(404, "Customer not found");

  const productIds = items.map((i) => i.productId);
  const products: Product[] = await prisma.product.findMany({ where: { id: { in: productIds } } });

  if (products.length !== productIds.length) {
    throw new ApiError(404, "One or more products not found");
  }

  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]));

  // If confirming immediately, validate stock BEFORE writing anything
  if (finalStatus === "CONFIRMED") {
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
        );
      }
    }
  }

  const challanNumber = await generateChallanNumber();
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  const result = await prisma.$transaction(async (tx) => {
    const challan = await tx.salesChallan.create({
      data: {
        challanNumber,
        customerId,
        totalQuantity,
        status: finalStatus,
        createdById: req.user!.id,
        items: {
          create: items.map((i) => {
            const product = productMap.get(i.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              unitPrice: product.unitPrice,
              quantity: i.quantity,
            };
          }),
        },
      },
      include: { items: true, customer: true },
    });

    if (finalStatus === "CONFIRMED") {
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: item.quantity,
            movementType: "OUT",
            reason: `Sales challan ${challanNumber}`,
            createdById: req.user!.id,
          },
        });
      }
    }

    return challan;
  });

  res.status(201).json(result);
});

// Confirms an existing DRAFT challan - deducts stock, re-validating availability at confirm time
export const confirmChallan = asyncHandler(async (req: Request, res: Response) => {
  const challan = await prisma.salesChallan.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!challan) throw new ApiError(404, "Challan not found");
  if (challan.status !== "DRAFT") {
    throw new ApiError(400, `Only DRAFT challans can be confirmed. Current status: ${challan.status}`);
  }

  const productIds = challan.items.map((i) => i.productId);
  const products: Product[] = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]));

  for (const item of challan.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new ApiError(404, `Product ${item.productName} no longer exists`);
    if (product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for "${item.productName}". Available: ${product.stock}, requested: ${item.quantity}`
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of challan.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          movementType: "OUT",
          reason: `Sales challan ${challan.challanNumber}`,
          createdById: req.user!.id,
        },
      });
    }
    return tx.salesChallan.update({
      where: { id: challan.id },
      data: { status: "CONFIRMED" },
      include: { items: true, customer: true },
    });
  });

  res.json(updated);
});

// Cancels a challan. If it was already CONFIRMED, stock is restored.
export const cancelChallan = asyncHandler(async (req: Request, res: Response) => {
  const challan = await prisma.salesChallan.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!challan) throw new ApiError(404, "Challan not found");
  if (challan.status === "CANCELLED") {
    throw new ApiError(400, "Challan is already cancelled");
  }

  const wasConfirmed = challan.status === "CONFIRMED";

  const updated = await prisma.$transaction(async (tx) => {
    if (wasConfirmed) {
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "IN",
            reason: `Cancelled challan ${challan.challanNumber} - stock restored`,
            createdById: req.user!.id,
          },
        });
      }
    }
    return tx.salesChallan.update({ where: { id: challan.id }, data: { status: "CANCELLED" } });
  });

  res.json(updated);
});
