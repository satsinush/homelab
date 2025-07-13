// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Default error
    let error = {
        message: err.message || 'Internal Server Error',
        status: err.status || 500
    };
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        error.status = 400;
        error.message = 'Validation Error';
    } else if (err.name === 'UnauthorizedError') {
        error.status = 401;
        error.message = 'Unauthorized';
    } else if (err.name === 'CastError') {
        error.status = 400;
        error.message = 'Invalid ID format';
    }
    
    res.status(error.status).json({
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 handler
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

module.exports = {
    errorHandler,
    notFound
};
