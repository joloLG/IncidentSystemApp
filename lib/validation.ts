import { z } from 'zod';

// Common validation schemas
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format');

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')
  .regex(/^[a-zA-Z\s-']+$/, 'Name contains invalid characters');

// User validation schemas
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const userRegisterSchema = z
  .object({
    firstName: nameSchema,
    middleName: z.string().max(100, 'Middle name is too long').optional(),
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    userType: z.enum(['admin', 'user', 'superadmin']).default('user'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Report validation schema
export const reportSchema = z.object({
  emergencyType: z.enum([
    'Fire Incident',
    'Medical Emergency',
    'Vehicular Incident',
    'Weather Disturbance',
    'Armed Conflict',
    'Others',
  ]),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description is too long'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  locationAddress: z.string().min(5, 'Please provide a valid address'),
  additionalInfo: z.string().max(500).optional(),
});

// Utility function for validating data
export async function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: boolean; data?: T; errors?: Record<string, string> }> {
  try {
    const result = await schema.safeParseAsync(data);
    if (!result.success) {
      const errors = result.error.issues.reduce<Record<string, string>>(
        (acc, issue) => {
          const path = issue.path.join('.');
          acc[path] = issue.message;
          return acc;
        },
        {}
      );
      return { success: false, errors };
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      success: false,
      errors: { general: 'An error occurred during validation' },
    };
  }
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;');
}

// Validate and sanitize search query
export function validateSearchQuery(query: string): string | null {
  const sanitized = sanitizeInput(query.trim());
  if (sanitized.length < 1 || sanitized.length > 100) {
    return null;
  }
  return sanitized;
}
