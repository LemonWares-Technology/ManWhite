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
exports.getAllMargins = getAllMargins;
exports.getMarginById = getMarginById;
exports.updateMargin = updateMargin;
exports.deleteMargin = deleteMargin;
const prisma_1 = require("../lib/prisma");
const apiResponse_1 = require("../utils/apiResponse");
function createMargin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if margin already exists
            const existingMargin = yield prisma_1.prisma.marginSetting.findFirst();
            if (existingMargin) {
                return (0, apiResponse_1.sendError)(res, "Margin setting already exists. Please update it instead.", 400);
            }
            const { amount } = req.body;
            if (amount === undefined || amount === null || isNaN(amount)) {
                return (0, apiResponse_1.sendError)(res, "Valid 'amount' is required.", 400);
            }
            // Optional: Validate currency format (e.g., 3-letter ISO code)
            const margin = yield prisma_1.prisma.marginSetting.create({
                data: {
                    amount: parseFloat(amount),
                },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Margin created successfully", margin, 201);
        }
        catch (error) {
            console.error("Error creating margin:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getAllMargins(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const margins = yield prisma_1.prisma.marginSetting.findMany();
            return (0, apiResponse_1.sendSuccess)(res, "Margins fetched successfully", margins);
        }
        catch (error) {
            console.error("Error fetching margins:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
function getMarginById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { marginId } = req.params;
            const margin = yield prisma_1.prisma.marginSetting.findUnique({
                where: { id: marginId },
            });
            if (!margin) {
                return (0, apiResponse_1.sendError)(res, "Margin not found", 404);
            }
            return (0, apiResponse_1.sendSuccess)(res, "Margin fetched successfully", margin);
        }
        catch (error) {
            console.error("Error fetching margin:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
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
            const existingMargin = yield prisma_1.prisma.marginSetting.findFirst();
            if (!existingMargin) {
                return (0, apiResponse_1.sendError)(res, "No margin setting found to update.", 404);
            }
            // Prepare update data
            const data = {};
            if (amount !== undefined) {
                if (isNaN(amount)) {
                    return (0, apiResponse_1.sendError)(res, "Valid 'amount' is required.", 400);
                }
                data.amount = parseFloat(amount);
            }
            const updatedMargin = yield prisma_1.prisma.marginSetting.update({
                where: { id: existingMargin.id },
                data,
            });
            return (0, apiResponse_1.sendSuccess)(res, "Margin updated successfully", updatedMargin);
        }
        catch (error) {
            console.error("Error updating margin:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
/**
 * Delete the existing margin setting
 */
function deleteMargin(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingMargin = yield prisma_1.prisma.marginSetting.findFirst();
            if (!existingMargin) {
                return (0, apiResponse_1.sendError)(res, "No margin setting found to delete.", 404);
            }
            yield prisma_1.prisma.marginSetting.delete({
                where: { id: existingMargin.id },
            });
            return (0, apiResponse_1.sendSuccess)(res, "Margin deleted successfully");
        }
        catch (error) {
            console.error("Error deleting margin:", error);
            return (0, apiResponse_1.sendError)(res, "Internal server error", 500, error);
        }
    });
}
