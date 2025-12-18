import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
export const runtime = "nodejs";

const SEMAPHORE_OTP_URL = "https://api.semaphore.co/api/v4/otp";
const OTP_COOKIE_NAME = "semaphoreOtp";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const getApiKey = () => {
  const apiKey =
    process.env.SEMAPHORE_API_KEY ||
    process.env.NEXT_PUBLIC_SEMAPHORE_API_KEY ||
    process.env.SEMAPHORE_APIKEY ||
    process.env.SEMAPHORE_KEY;
  if (!apiKey) {
    throw new Error("Semaphore API key is not configured");
  }
  return apiKey;
};

const getSenderName = () => process.env.SEMAPHORE_SENDER_NAME || process.env.NEXT_PUBLIC_SEMAPHORE_SENDER_NAME;

const normalizeMobileNumber = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }

  const digitsOnly = input.replace(/\D/g, "");

  if (digitsOnly.startsWith("09") && digitsOnly.length === 11) {
    return `63${digitsOnly.slice(1)}`;
  }

  if (digitsOnly.startsWith("9") && digitsOnly.length === 10) {
    return `63${digitsOnly}`;
  }

  if (digitsOnly.startsWith("63") && digitsOnly.length === 12) {
    return digitsOnly;
  }

  return null;
};

export async function POST(request: Request) {
  try {
    const { mobileNumber } = await request.json();

    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);

    if (!normalizedMobileNumber) {
      return NextResponse.json(
        { error: "A valid Philippine mobile number starting with 09 is required." },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    const senderName = getSenderName();
    const fullNumber = normalizedMobileNumber;
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const messageTemplate = "Your MDRRMO Emergency App OTP is: {otp}. Please use it within 5 minutes.";

    const body = new URLSearchParams({
      apikey: apiKey,
      number: fullNumber,
      message: messageTemplate,
      code: otpCode,
    });

    if (senderName) {
      body.append("sendername", senderName);
    }

    const response = await fetch(SEMAPHORE_OTP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    let raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {}

    if (!response.ok) {
      const rawLower = (raw || "").toLowerCase();
      const senderInvalid = (
        (Array.isArray(data) && data[0] && ("senderName" in data[0]) && String(data[0].senderName).toLowerCase().includes("not valid")) ||
        (rawLower.includes("sendername") && rawLower.includes("not valid"))
      );

      // Fallback: retry without sendername if it's invalid
      if (senderInvalid && senderName) {
        const retryBody = new URLSearchParams({
          apikey: apiKey,
          number: fullNumber,
          message: messageTemplate,
          code: otpCode,
        });

        const retryRes = await fetch(SEMAPHORE_OTP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: retryBody.toString(),
        });

        let retryRaw = await retryRes.text();
        let retryData: any = null;
        try { retryData = JSON.parse(retryRaw); } catch {}

        if (!retryRes.ok) {
          const retryErr = Array.isArray(retryData) && retryData[0]?.message ? retryData[0].message : (retryData?.error || retryRaw || "Failed to send verification code.");
          return NextResponse.json({ error: retryErr }, { status: retryRes.status });
        }

        if (!Array.isArray(retryData) || retryData.length === 0) {
          return NextResponse.json({ error: "Unexpected response from Semaphore." }, { status: 502 });
        }

        const retryResult = retryData[0];
        const retryMessageId = String(retryResult?.message_id ?? "");
        if (!retryMessageId) {
          return NextResponse.json({ error: "Semaphore did not return a message ID." }, { status: 502 });
        }
        if (retryResult.status && typeof retryResult.status === "string" && retryResult.status.toLowerCase() === "failed") {
          return NextResponse.json({ error: retryResult?.message || "Failed to send verification code." }, { status: 400 });
        }

        // Success via fallback
        const hash = crypto
          .createHash("sha256")
          .update(`${otpCode}:${retryMessageId}`)
          .digest("hex");

        const cookiePayload = { hash, messageId: retryMessageId, expiresAt: Date.now() + OTP_EXPIRY_MS };
        cookies().set({
          name: OTP_COOKIE_NAME,
          value: JSON.stringify(cookiePayload),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: OTP_EXPIRY_MS / 1000,
          path: "/",
        });
        return NextResponse.json({ messageId: retryMessageId });
      }

      const errorMessage = Array.isArray(data) && data.length > 0 && data[0]?.message
        ? data[0].message
        : (data?.error || raw || "Failed to send verification code.");
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Unexpected response from Semaphore." }, { status: 502 });
    }

    const result = data[0];
    const messageId = String(result?.message_id ?? "");
    if (!messageId) {
      return NextResponse.json({ error: "Semaphore did not return a message ID." }, { status: 502 });
    }

    if (result.status && typeof result.status === "string" && result.status.toLowerCase() === "failed") {
      return NextResponse.json({ error: result?.message || "Failed to send verification code." }, { status: 400 });
    }

    const hash = crypto
      .createHash("sha256")
      .update(`${otpCode}:${messageId}`)
      .digest("hex");

    const cookiePayload = {
      hash,
      messageId,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
    };

    cookies().set({
      name: OTP_COOKIE_NAME,
      value: JSON.stringify(cookiePayload),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: OTP_EXPIRY_MS / 1000,
      path: "/",
    });

    return NextResponse.json({ messageId });
  } catch (error: any) {
    console.error("Semaphore OTP send error", error);
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
