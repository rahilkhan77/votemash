/**
 * Common database query utilities
 * To be expanded as needed
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Get current time as a string for database operations
 * Always use server time as authoritative
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Example: Get a category by ID
 */
export async function getCategoryById(categoryId: string) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (error) {
    console.error('Error fetching category:', error);
    return null;
  }

  return data;
}

/**
 * Example: Get all active categories
 */
export async function getActiveCategories() {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data;
}
