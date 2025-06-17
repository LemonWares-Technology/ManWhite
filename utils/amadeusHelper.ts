import { parseISO, format } from "date-fns";
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

  try {
    let parsedDate: Date;

    if (date instanceof Date) {
      parsedDate = date;
    } else if (typeof date === "string") {
      // Try to parse ISO string
      parsedDate = parseISO(date);
      if (isNaN(parsedDate.getTime())) {
        // Invalid date string
        return null;
      }
    } else {
      return null;
    }

    // Format as YYYY-MM-DD
    return format(parsedDate, "yyyy-MM-dd");
  } catch {
    return null;
  }
}

export function mapTravelerToAmadeusFormat(t: any, id: any) {
  return {
    id: id,
    dateOfBirth: formatDate(t.dateOfBirth),
    name: {
      firstName: t.name?.firstName || t.firstName, // Try nested first, fallback to flat
      lastName: t.name?.lastName || t.lastName,
    },
    gender: t.gender,
    contact: {
      emailAddress: t.contact?.emailAddress || t.email,
      phones: [
        {
          deviceType: "MOBILE",
          countryCallingCode:
            t.contact?.phones?.[0]?.countryCallingCode || t.countryCode,
          number: t.contact?.phones?.[0]?.number || t.phone,
        },
      ],
    },
    documents: [
      {
        documentType: "PASSPORT",
        number: t.documents?.[0]?.number || t.passportNumber,
        expiryDate: formatDate(
          t.documents?.[0]?.expiryDate || t.passportExpiry
        ),
        issuanceCountry: t.documents?.[0]?.issuanceCountry || t.issuanceCountry,
        validityCountry: t.documents?.[0]?.validityCountry || t.validityCountry,
        nationality: t.documents?.[0]?.nationality || t.nationality,
        birthPlace: t.documents?.[0]?.birthPlace || t.birthPlace,
        issuanceLocation:
          t.documents?.[0]?.issuanceLocation || t.issuanceLocation,
        issuanceDate: t.documents?.[0]?.issuanceDate || t.issuanceDate,
        holder: true,
      },
    ],
  };
}
