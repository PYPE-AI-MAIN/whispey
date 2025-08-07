import { NextApiResponse } from 'next';
import { ApiResponse } from '../types/logs';

export const createResponse = <T>(statusCode: number, data: T, error: string | null = null): { status: number; json: ApiResponse<T> } => {
  const response: ApiResponse<T> = {
    success: statusCode >= 200 && statusCode < 300,
    data: error ? null : data,
    error: error,
    timestamp: new Date().toISOString()
  };

  return {
    status: statusCode,
    json: response
  };
};

export const sendResponse = <T>(res: NextApiResponse, statusCode: number, data: T, error: string | null = null): void => {
  const response = createResponse(statusCode, data, error);
  res.status(response.status).json(response.json);
};
