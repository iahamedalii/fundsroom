import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  businessName: z.string().optional(),
  gstNumber: z.string().optional(),
  customerType: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]).optional(),
  address: z.string().optional(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  followUpDate: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().optional(),
});

// GET /customers?search=&status=&page=&limit=
export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, page = "1", limit = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      followUps: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      challans: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  res.json(customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const data = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      ...data,
      email: data.email || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
    },
  });
  res.status(201).json(customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const data = parsed.data;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      ...data,
      email: data.email === "" ? null : data.email,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    },
  });
  res.json(customer);
});

export const addFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ note: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const followUp = await prisma.followUp.create({
    data: {
      customerId: req.params.id,
      note: parsed.data.note,
      createdById: req.user!.id,
    },
  });
  res.status(201).json(followUp);
});
