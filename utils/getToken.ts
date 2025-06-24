import axios from "axios";
import env from "dotenv";
env.config();

const baseURL: string = "https://test.api.amadeus.com";

const api_key = process.env.AMADEUS_API_KEY!;

const api_secret = process.env.AMADEUS_API_SECRET!;

const getAmadeusToken: any = async () => {
  try {
    const response: any = await axios.post(
      `${baseURL}/v1/security/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: api_key,
        client_secret: api_secret,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    // console.log(`This is the error here: `, error?.message)
    throw new Error(
      error?.message || "Failed to authenticate with Amadeus API"
    );
  }
};

export default getAmadeusToken;
