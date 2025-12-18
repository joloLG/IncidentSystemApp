"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Check if environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
}

export const supabase = createClientComponentClient()

// User type
export type UserRole = 'superadmin' | 'admin' | 'user';

export interface User {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  email: string
  mobileNumber?: string
  user_type: UserRole
  created_at: string
  updated_at?: string
  is_banned?: boolean
  banned_until?: string | null
  ban_reason?: string | null
}

// Check if user is superadmin
export const isSuperAdmin = (user: User | null): boolean => {
  return user?.user_type === 'superadmin';
}

// Custom error class for database operations
class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}

// Helper function to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
  console.error(`[Supabase Error] ${context}:`, error);
  
  if (error.code) {
    switch (error.code) {
      case '22P02': // Invalid text representation
      case '23505': // Unique violation
      case '23503': // Foreign key violation
      case '23514': // Check violation
        throw new DatabaseError(
          'Invalid data provided',
          error.code,
          error.details
        );
      case '42501': // Insufficient privilege
        throw new DatabaseError(
          'Insufficient permissions',
          error.code,
          { hint: 'Check your RLS policies' }
        );
      default:
        throw new DatabaseError(
          error.message || 'Database operation failed',
          error.code,
          error.details
        );
    }
  }
  
  throw new DatabaseError(error.message || 'An unknown database error occurred');
};

// User queries
export const userQueries = {
  // Get all users (only accessible by superadmin)
  getAllUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as User[];
    } catch (error) {
      return handleSupabaseError(error, 'getAllUsers');
    }
  },

  // Get user by ID
  getUserById: async (userId: string): Promise<User> => {
    try {
      if (!userId) {
        throw new DatabaseError('User ID is required');
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!data) {
        throw new DatabaseError('User not found', '404');
      }
      
      return data as User;
    } catch (error) {
      return handleSupabaseError(error, 'getUserById');
    }
  },

  // Update user role (only for superadmin)
  updateUserRole: async (
    userId: string,
    role: UserRole
  ): Promise<User> => {
    try {
      if (!userId || !role) {
        throw new DatabaseError('User ID and role are required');
      }

      const { data, error } = await supabase
        .from('users')
        .update({ 
          user_type: role,
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new DatabaseError('User not found', '404');
      }
      
      return data as User;
    } catch (error) {
      return handleSupabaseError(error, 'updateUserRole');
    }
  },

  // Delete user (only for superadmin)
  deleteUser: async (userId: string): Promise<boolean> => {
    try {
      if (!userId) {
        throw new DatabaseError('User ID is required');
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      return handleSupabaseError(error, 'deleteUser');
    }
  },

  // Update user ban status
  updateUserBanStatus: async (
    userId: string, 
    isBanned: boolean, 
    banReason?: string, 
    bannedUntil?: string | null
  ): Promise<User> => {
    try {
      if (!userId) {
        throw new DatabaseError('User ID is required');
      }

      const updateData: Partial<User> = {
        is_banned: isBanned,
        ban_reason: banReason || null,
        banned_until: bannedUntil || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new DatabaseError('User not found', '404');
      }
      
      return data as User;
    } catch (error) {
      return handleSupabaseError(error, 'updateUserBanStatus');
    }
  },
};