import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export async function createMargin(req: Request, res: Response): Promise<any> {
  try {
    // Check if margin already exists
    const existingMargin = await prisma.marginSetting.findFirst();
    if (existingMargin) {
      return res.status(400).json({
        error: "Margin setting already exists. Please update it instead.",
      });
    }

    const { amount } = req.body;

    if (amount === undefined || amount === null || isNaN(amount)) {
      return res.status(400).json({ error: "Valid 'amount' is required." });
    }

    // Optional: Validate currency format (e.g., 3-letter ISO code)

    const margin = await prisma.marginSetting.create({
      data: {
        amount: parseFloat(amount),
      },
    });

    return res
      .status(201)
      .json({ message: "Margin created successfully", margin });
  } catch (error: any) {
    console.error("Error creating margin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllMargins(req: Request, res: Response): Promise<any> {
  try {
    const margins = await prisma.marginSetting.findMany();
    return res.status(200).json({ margins });
  } catch (error: any) {
    console.error("Error fetching margins:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMarginById(req: Request, res: Response): Promise<any> {
  try {
    const { marginId } = req.params;

    const margin = await prisma.marginSetting.findUnique({
      where: { id: marginId },
    });

    if (!margin) {
      return res.status(404).json({ error: "Margin not found" });
    }

    return res.status(200).json({ margin });
  } catch (error: any) {
    console.error("Error fetching margin:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res
        .status(404)
        .json({ error: "No margin setting found to update." });
    }

    // Prepare update data
    const data: { amount?: number; currency?: string } = {};
    if (amount !== undefined) {
      if (isNaN(amount)) {
        return res.status(400).json({ error: "Valid 'amount' is required." });
      }
      data.amount = parseFloat(amount);
    }

    const updatedMargin = await prisma.marginSetting.update({
      where: { id: existingMargin.id },
      data,
    });

    return res
      .status(200)
      .json({ message: "Margin updated successfully", margin: updatedMargin });
  } catch (error: any) {
    console.error("Error updating margin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Delete the existing margin setting
 */
export async function deleteMargin(req: Request, res: Response): Promise<any> {
  try {
    const existingMargin = await prisma.marginSetting.findFirst();
    if (!existingMargin) {
      return res
        .status(404)
        .json({ error: "No margin setting found to delete." });
    }

    await prisma.marginSetting.delete({
      where: { id: existingMargin.id },
    });

    return res.status(200).json({ message: "Margin deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting margin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
