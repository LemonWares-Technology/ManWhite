import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function createMargin(req: Request, res: Response): Promise<any> {
  try {
    // Check if margin already exists
    const existingMargin = await prisma.marginSetting.findFirst();
    if (existingMargin) {
      return sendError(res, "Margin setting already exists. Please update it instead.", 400);
    }

    const { amount } = req.body;

    if (amount === undefined || amount === null || isNaN(amount)) {
      return sendError(res, "Valid 'amount' is required.", 400);
    }

    // Optional: Validate currency format (e.g., 3-letter ISO code)

    const margin = await prisma.marginSetting.create({
      data: {
        amount: parseFloat(amount),
      },
    });

    return sendSuccess(res, "Margin created successfully", margin, 201);
  } catch (error: any) {
    console.error("Error creating margin:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getAllMargins(req: Request, res: Response): Promise<any> {
  try {
    const margins = await prisma.marginSetting.findMany();
    return sendSuccess(res, "Margins fetched successfully", margins);
  } catch (error: any) {
    console.error("Error fetching margins:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

export async function getMarginById(req: Request, res: Response): Promise<any> {
  try {
    const { marginId } = req.params;

    const margin = await prisma.marginSetting.findUnique({
      where: { id: marginId },
    });

    if (!margin) {
      return sendError(res, "Margin not found", 404);
    }

    return sendSuccess(res, "Margin fetched successfully", margin);
  } catch (error: any) {
    console.error("Error fetching margin:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

/**
 * Update the existing margin setting
 */
export async function updateMargin(req: Request, res: Response): Promise<any> {
  try {
    const { amount } = req.body;

    // Find existing margin
    const existingMargin = await prisma.marginSetting.findFirst();
    if (!existingMargin) {
      return sendError(res, "No margin setting found to update.", 404);
    }

    // Prepare update data
    const data: { amount?: number; currency?: string } = {};
    if (amount !== undefined) {
      if (isNaN(amount)) {
        return sendError(res, "Valid 'amount' is required.", 400);
      }
      data.amount = parseFloat(amount);
    }

    const updatedMargin = await prisma.marginSetting.update({
      where: { id: existingMargin.id },
      data,
    });

    return sendSuccess(res, "Margin updated successfully", updatedMargin);
  } catch (error: any) {
    console.error("Error updating margin:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}

/**
 * Delete the existing margin setting
 */
export async function deleteMargin(req: Request, res: Response): Promise<any> {
  try {
    const existingMargin = await prisma.marginSetting.findFirst();
    if (!existingMargin) {
      return sendError(res, "No margin setting found to delete.", 404);
    }

    await prisma.marginSetting.delete({
      where: { id: existingMargin.id },
    });

    return sendSuccess(res, "Margin deleted successfully");
  } catch (error: any) {
    console.error("Error deleting margin:", error);
    return sendError(res, "Internal server error", 500, error);
  }
}
