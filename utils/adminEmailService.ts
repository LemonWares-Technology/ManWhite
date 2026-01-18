import { SendMailClient } from "zeptomail";
import env from "dotenv";
env.config();

const ZEPTOMAIL_TOKEN: string = process.env.ZEPTOMAIL_TOKEN!;
const SENDER_EMAIL: string =
  process.env.SENDER_EMAIL || "noreply@manwhitaroes.com";
const SENDER_NAME: string = process.env.SENDER_NAME || "ManwhitAroes";

const ZEPTOMAIL_URL: string = process.env.ZEPTOMAIL_URL || "api.zeptomail.com/";

const client = new SendMailClient({ url: ZEPTOMAIL_URL, token: ZEPTOMAIL_TOKEN });

export async function sendEmailBookingProcess({
  adminEmail,
  customerName,
  subject,
  customerEmail,
  text,
}: {
  adminEmail: string;
  customerName: string;
  subject: string;
  customerEmail: string;
  text: string;
}) {
  try {
    await client.sendMail({
      from: {
        address: adminEmail || SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [
        {
          email_address: {
            address: customerEmail,
            name: customerName,
          },
        },
      ],
      subject: subject,
      htmlbody: `<html><body><p>${text}</p></body></html>`,
    });

    console.log(`Email sent successfully to ${customerEmail}`);
    return { success: true, message: "Email sent successfully" };
  } catch (error: any) {
    console.error("Error sending email:", error);
    throw new Error(error?.message || "Failed to send email");
  }
}
