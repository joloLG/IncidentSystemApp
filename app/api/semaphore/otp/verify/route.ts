import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
export const runtime = "nodejs";

const OTP_COOKIE_NAME = "semaphoreOtp";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
  try {
    const { messageId, code } = await request.json();

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
    }

    const cookieStore = cookies();
    const stored = cookieStore.get(OTP_COOKIE_NAME);

    if (!stored?.value) {
      return NextResponse.json({ error: "No pending verification found." }, { status: 400 });
    }

    let payload: { hash: string; messageId: string; expiresAt: number };
    try {
      payload = JSON.parse(stored.value);
    } catch (error) {
      cookieStore.delete(OTP_COOKIE_NAME);
      return NextResponse.json({ error: "Invalid verification state." }, { status: 400 });
    }

    if (!payload || payload.messageId !== messageId) {
      return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
    }

    if (Date.now() > payload.expiresAt) {
      cookieStore.delete(OTP_COOKIE_NAME);
      return NextResponse.json({ error: "Verification code expired." }, { status: 400 });
    }

    const computedHash = crypto
      .createHash("sha256")
      .update(`${code}:${messageId}`)
      .digest("hex");

    if (computedHash !== payload.hash) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    cookieStore.delete(OTP_COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Semaphore OTP verify error", error);
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
