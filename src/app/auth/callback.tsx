// pages/api/validate-sso-token.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ valid: false, error: "Token is required" });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

    // Decode and verify the token
    const payload = jwt.verify(token, jwtSecret) as any;

    // Check if token is expired manually (optional — jwt.verify already does it)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ valid: false, error: "Token has expired" });
    }

    return res.status(200).json({
      valid: true,
      user_email: payload.user_email,
      user_id: payload.user_id,
      agent_info: payload.agent_info || {},
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ valid: false, error: "Token has expired" });
    }
    return res.status(401).json({ valid: false, error: `Invalid token: ${err.message}` });
  }
};

export default handler;
