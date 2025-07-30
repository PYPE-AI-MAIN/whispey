// app/api/validate-sso-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Token is required" },
      { status: 400 }
    );
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

    // Decode and verify the token
    const payload = jwt.verify(token, jwtSecret) as any;

    // Check if token is expired manually (optional — jwt.verify already does it)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return NextResponse.json(
        { valid: false, error: "Token has expired" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      user_email: payload.user_email,
      user_id: payload.user_id,
      agent_info: payload.agent_info || {},
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return NextResponse.json(
        { valid: false, error: "Token has expired" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { valid: false, error: `Invalid token: ${err.message}` },
      { status: 401 }
    );
  }
}