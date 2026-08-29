/**
 * Shared in-memory wardrobe store.
 * NOTE: This is a temporary solution. Data is lost on server restart.
 * Replace with a database-backed implementation (e.g., Prisma model) for production.
 */

export interface WardrobeItem {
  id: string;
  name: string;
  imageUrl?: string;
  category?: string;
  color?: string;
  size?: string;
  brand?: string;
  addedAt: string;
  purchased: boolean;
}

export interface WardrobeOutfit {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
}

export interface WardrobeData {
  items: WardrobeItem[];
  outfits: WardrobeOutfit[];
}

const store = new Map<string, WardrobeData>();

export function getWardrobe(userId: string): WardrobeData {
  return store.get(userId) || { items: [], outfits: [] };
}

export function setWardrobe(userId: string, data: WardrobeData): void {
  store.set(userId, data);
}
