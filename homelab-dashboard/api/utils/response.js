// Standardized error response helper
export const sendError = (res, statusCode, message, details = null) => {
    const response = { error: message };
    if (details && process.env.NODE_ENV === 'development') {
        response.details = details;
    }
    return res.status(statusCode).json(response);
};

// Standardized success response helper
export const sendSuccess = (res, data, statusCode = 200) => {
    return res.status(statusCode).json(data);
};
