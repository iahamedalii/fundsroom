import { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Central error handler - keeps controllers free of try/catch boilerplate
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Prisma unique constraint violation
  if (err.code === "P2002") {
    return res.status(409).json({ error: `Duplicate value for field: ${err.meta?.target}` });
  }

  // Prisma record not found
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  return res.status(500).json({ error: "Internal server error" });
}
