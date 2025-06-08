import { Request, Response } from "express";
import axios from "axios";
import env from "dotenv";
env.config();

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTER_SECRET!;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTER_PUBLIC!;

const FRONTEND_URL = process.env.FRONTEND_URL!;

export const initializePayment = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { amount, email, bookingData } = req.body;

    if (!amount || !email) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameters: amount and email",
      });
    }

    // Generate a unique transaction reference
    const tx_ref = `FLIGHT-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;

    // Initialize payment with Flutterwave
    const response: any = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: "NGN",
        payment_options: "card",
        redirect_url: `${FRONTEND_URL}/auth/success`,
        customer: {
          email,
          phone_number: bookingData?.guestInfo?.phone,
          name: bookingData?.guestInfo?.firstName
            ? `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`
            : "Guest User",
        },
        // customizations: {
        //   title: "Manwhit Areos Flight Booking",
        //   description: "Flight booking payment",
        //   logo: "https://manwhitareos.web.app/logo.png"
        // },
        meta: {
          bookingData: JSON.stringify(bookingData),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Return the payment link and configuration
    return res.status(200).json({
      status: "success",
      data: {
        publicKey: FLUTTERWAVE_PUBLIC_KEY,
        reference: tx_ref,
        amount: amount,
        currency: "USD",
        paymentLink: response.data.data.link,
      },
    });
  } catch (error: any) {
    console.error(
      "Payment initialization error:",
      error.response?.data || error
    );
    return res.status(500).json({
      status: "error",
      message: "Error initializing payment",
      error: error.response?.data?.message || error.message,
    });
  }
};


export const verifyFlutterwavePayment = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // You can receive tx_ref as a query parameter or in the body
    const tx_ref = req.query.tx_ref || req.body.tx_ref;

    if (!tx_ref) {
      return res.status(400).json({
        status: "error",
        message: "Missing required parameter: tx_ref",
      });
    }

    // Verify the transaction using Flutterwave's API
    const response:any = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const paymentData = response.data?.data;

    if (
      response.data.status === "success" &&
      paymentData?.status === "successful"
    ) {
      return res.status(200).json({
        status: "success",
        verified: true,
        paymentData,
      });
    } else {
      return res.status(400).json({
        status: "error",
        verified: false,
        message: "Payment not successful or not found",
        paymentData,
      });
    }
  } catch (error: any) {
    console.error(
      "Payment verification error:",
      error.response?.data || error
    );
    return res.status(500).json({
      status: "error",
      message: "Error verifying payment",
      error: error.response?.data?.message || error.message,
    });
  }
};
