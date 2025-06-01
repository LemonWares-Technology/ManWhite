"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMargin = createMargin;
exports.updateMargin = updateMargin;
exports.deleteMargin = deleteMargin;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function createMargin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if margin already exists
            const existingMargin = yield prisma.marginSetting.findFirst();
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
            const margin = yield prisma.marginSetting.create({
                data: {
                    amount: parseFloat(amount),
                },
            });
            return res
                .status(201)
                .json({ message: "Margin created successfully", margin });
        }
        catch (error) {
            console.error("Error creating margin:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
/**
 * Update the existing margin setting
 */
function updateMargin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { amount } = req.body;
            // Find existing margin
            const existingMargin = yield prisma.marginSetting.findFirst();
            if (!existingMargin) {
                return res
                    .status(404)
                    .json({ error: "No margin setting found to update." });
            }
            // Prepare update data
            const data = {};
            if (amount !== undefined) {
                if (isNaN(amount)) {
                    return res.status(400).json({ error: "Valid 'amount' is required." });
                }
                data.amount = parseFloat(amount);
            }
            const updatedMargin = yield prisma.marginSetting.update({
                where: { id: existingMargin.id },
                data,
            });
            return res
                .status(200)
                .json({ message: "Margin updated successfully", margin: updatedMargin });
        }
        catch (error) {
            console.error("Error updating margin:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
/**
 * Delete the existing margin setting
 */
function deleteMargin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingMargin = yield prisma.marginSetting.findFirst();
            if (!existingMargin) {
                return res
                    .status(404)
                    .json({ error: "No margin setting found to delete." });
            }
            yield prisma.marginSetting.delete({
                where: { id: existingMargin.id },
            });
            return res.status(200).json({ message: "Margin deleted successfully" });
        }
        catch (error) {
            console.error("Error deleting margin:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}
