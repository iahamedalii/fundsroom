import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  minStock: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
});

// GET /products?search=&lowStock=true&page=&limit=
export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { search, lowStock, page = "1", limit = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let items = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  });

  if (lowStock === "true") {
    items = items.filter((p) => p.stock <= p.minStock);
  }

  const total = await prisma.product.count({ where });

  res.json({ items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { stockMovements: { orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { name: true } } } } },
  });
  if (!product) throw new ApiError(404, "Product not found");
  res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const product = await prisma.product.create({ data: { ...parsed.data, stock: 0 } });
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(product);
});

const movementSchema = z.object({
  quantity: z.number().int().positive(),
  movementType: z.enum(["IN", "OUT"]),
  reason: z.string().optional(),
});

// POST /products/:id/stock-movements - manual stock adjustment (warehouse/admin)
export const addStockMovement = asyncHandler(async (req: Request, res: Response) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);
  const { quantity, movementType, reason } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new ApiError(404, "Product not found");

  if (movementType === "OUT" && product.stock < quantity) {
    throw new ApiError(400, `Insufficient stock. Available: ${product.stock}, requested: ${quantity}`);
  }

  const newStock = movementType === "IN" ? product.stock + quantity : product.stock - quantity;

  const [updatedProduct, movement] = await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { stock: newStock } }),
    prisma.stockMovement.create({
      data: {
        productId: product.id,
        quantity,
        movementType,
        reason,
        createdById: req.user!.id,
      },
    }),
  ]);

  res.status(201).json({ product: updatedProduct, movement });
});
