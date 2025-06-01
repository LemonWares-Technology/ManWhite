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
