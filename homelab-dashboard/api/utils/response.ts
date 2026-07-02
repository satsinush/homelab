import { Response } from 'express';

// Standardized error response helper
export const sendError = (res: Response, statusCode: number, message: string, details: any = null) => {
    const response: { error: string; details?: any } = { error: message };
    if (details && process.env.NODE_ENV === 'development') {
        response.details = details;
    }
    return res.status(statusCode).json(response);
};

// Standardized success response helper
export const sendSuccess = (res: Response, data: any, statusCode: number = 200) => {
    return res.status(statusCode).json(data);
};
