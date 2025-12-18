import { body, param, query } from 'express-validator';

// Common validators
export const idValidator = param('id').isUUID().withMessage('Invalid ID format');

export const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// Auth validators
export const loginValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const registerValidators = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role').isIn(['SUPER_ADMIN', 'AGENCY_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER']),
];

// Customer validators
export const customerValidators = [
  body('tc_vkn')
    .isLength({ min: 10, max: 11 })
    .withMessage('TC/VKN must be 10-11 characters'),
  body('name').notEmpty().withMessage('Name is required'),
  body('surname').notEmpty().withMessage('Surname is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
];

// Vehicle validators
export const vehicleValidators = [
  body('customer_id').isUUID().withMessage('Valid customer ID is required'),
  body('plate').notEmpty().withMessage('Plate is required'),
  body('brand_id').isInt().withMessage('Brand ID must be an integer'),
  body('model_id').isInt().withMessage('Model ID must be an integer'),
  body('model_year').isInt({ min: 1900, max: 2100 }),
  body('usage_type').isIn(['PRIVATE', 'COMMERCIAL', 'TAXI']),
];

// Sale validators
export const saleValidators = [
  body('customer_id').isUUID().withMessage('Valid customer ID is required'),
  body('vehicle_id').isUUID().withMessage('Valid vehicle ID is required'),
  body('package_id').isUUID().withMessage('Valid package ID is required'),
  body('price').isDecimal().withMessage('Valid price is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
];
