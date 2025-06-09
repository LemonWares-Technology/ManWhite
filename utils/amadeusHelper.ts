import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const CURRENCY_FREAKS_API_KEY =
  process.env.CURRENCY_FREAKS_API_KEY || "232f3104c7014e39a1b00d13285860c9";

if (!CURRENCY_FREAKS_API_KEY) {
  throw new Error("Missing CURRENCY_FREAKS_API_KEY in environment variables");
}

export async function getConversionRate(
  from: string,
  to: string
): Promise<number> {
  if (from === to) return 1;

  try {
    const response: any = await axios.get(
      `https://api.currencyfreaks.com/v2.0/rates/latest`,
      {
        params: {
          apikey: CURRENCY_FREAKS_API_KEY,
          base: from.toUpperCase(),
          symbols: to.toUpperCase(),
        },
      }
    );

    const rates = response.data?.rates;
    if (!rates || !rates[to.toUpperCase()]) {
      console.error(
        `Conversion rate for ${to} not found in response`,
        response.data
      );
      return 1;
    }

    return parseFloat(rates[to.toUpperCase()]);
  } catch (error) {
    console.error("Error fetching conversion rate:", error);
    return 1;
  }
}

function formatDate(date: string | Date | undefined | null): string | null {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString().split('T')[0];
  if (typeof date === "string") return date.split('T')[0]; // Handles "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"
  return null;
}

export function mapTravelerToAmadeusFormat(t:any, id:any) {
  return {
    id: id,
    dateOfBirth: formatDate(t.dateOfBirth),
    name: {
      firstName: t.firstName,
      lastName: t.lastName,
    },
    gender: t.gender,
    contact: {
      emailAddress: t.email,
      phones: [
        {
          deviceType: "MOBILE",
          countryCallingCode: t.countryCode,
          number: t.phone,
        },
      ],
    },
    documents: [
      {
        documentType: "PASSPORT",
        number: t.passportNumber,
        expiryDate: formatDate(t.passportExpiry),
        issuanceCountry: t.issuanceCountry,
        validityCountry: t.validityCountry,
        nationality: t.nationality,
        birthPlace: t.birthPlace,
        issuanceLocation: t.issuanceLocation,
        issuanceDate: t.issuanceDate,
        holder: true,
      },
    ],
  };
}
