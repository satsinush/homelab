import { Request, Response, NextFunction } from 'express';

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    
    // Default error response structure
    let error = {
        error: err.message || 'Internal Server Error',
        status: err.status || 500
    };
    
    // Handle specific error types with better messages
    if (err.name === 'ValidationError') {
        error.status = 400;
        error.error = 'Request validation failed';
    } else if (err.name === 'UnauthorizedError') {
        error.status = 401;
        error.error = 'Authentication required';
    } else if (err.name === 'CastError') {
        error.status = 400;
        error.error = 'Invalid data format provided';
    } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
        error.status = 400;
        error.error = 'Invalid JSON in request body';
    } else if (err.code === 'ECONNREFUSED') {
        error.status = 503;
        error.error = 'Service temporarily unavailable';
    } else if (err.code === 'ENOTFOUND') {
        error.status = 502;
        error.error = 'External service not found';
    }
    
    // Include development details if in development mode
    const response: { error: string; details?: string } = { error: error.error };
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.details = err.stack;
    }
    
    res.status(error.status).json(response);
};

// 404 handler with consistent response format
export const notFound = (req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
        error: `Resource not found: ${req.method} ${req.originalUrl}`
    });
};
