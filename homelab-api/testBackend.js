const ValidationUtils = require('./utils/validation');
console.log('Backend MAC normalization test:');
console.log('Input: 00-D8-61-78-E9-34');
console.log('Normalized:', ValidationUtils.validateAndNormalizeMac('00-D8-61-78-E9-34'));
