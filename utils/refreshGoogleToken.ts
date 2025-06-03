import { OAuth2Client } from "google-auth-library";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const client: any = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
);

export async function refreshGoogleToken(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { refreshToken: true },
    });

    if (!user?.refreshToken) {
        throw new Error("No refresh token found");
    }

    const { credentials } = await client.refreshToken(user.refreshToken);

    if (!credentials.access_token) {
        throw new Error("Failed to refresh access token");
    }

    // Update new refreshToken if Google provides a new one
    await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: credentials.refresh_token || user.refreshToken },
    });

    return credentials.access_token;
}
