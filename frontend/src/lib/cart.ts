// Shopping Cart State Management
import type { Product } from './database.types';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  slug: string;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

const CART_STORAGE_KEY = 'dtc_cart';

// Get cart from localStorage
export function getCart(): CartState {
  if (typeof window === 'undefined') {
    return { items: [], subtotal: 0, itemCount: 0 };
  }
  
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const items: CartItem[] = JSON.parse(stored);
      return calculateCartState(items);
    }
  } catch (error) {
    console.error('Error reading cart from localStorage:', error);
  }
  
  return { items: [], subtotal: 0, itemCount: 0 };
}

// Save cart to localStorage
function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    // Dispatch custom event for cart updates
    window.dispatchEvent(new CustomEvent('cart-updated', { 
      detail: calculateCartState(items) 
    }));
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
}

// Calculate cart totals
function calculateCartState(items: CartItem[]): CartState {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, subtotal, itemCount };
}

export function setCartItems(items: CartItem[]): CartState {
  saveCart(items);
  return calculateCartState(items);
}

// Add item to cart
export function addToCart(product: Product, quantity: number = 1): CartState {
  const cart = getCart();
  const existingIndex = cart.items.findIndex(item => item.productId === product.id);
  
  if (existingIndex >= 0) {
    cart.items[existingIndex].quantity += quantity;
  } else {
    cart.items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.main_image_url,
      slug: product.slug,
    });
  }
  
  saveCart(cart.items);
  return calculateCartState(cart.items);
}

export function addToCartItem(
  product: { id: string; name: string; price: number; main_image_url: string | null; slug: string },
  quantity: number = 1
): CartState {
  const cart = getCart();
  const existingIndex = cart.items.findIndex(item => item.productId === product.id);

  if (existingIndex >= 0) {
    cart.items[existingIndex].quantity += quantity;
  } else {
    cart.items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.main_image_url,
      slug: product.slug,
    });
  }

  saveCart(cart.items);
  return calculateCartState(cart.items);
}

// Update item quantity
export function updateCartItemQuantity(productId: string, quantity: number): CartState {
  const cart = getCart();
  const index = cart.items.findIndex(item => item.productId === productId);
  
  if (index >= 0) {
    if (quantity <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = quantity;
    }
    saveCart(cart.items);
  }
  
  return calculateCartState(cart.items);
}

// Remove item from cart
export function removeFromCart(productId: string): CartState {
  const cart = getCart();
  const items = cart.items.filter(item => item.productId !== productId);
  saveCart(items);
  return calculateCartState(items);
}

// Clear entire cart
export function clearCart(): CartState {
  saveCart([]);
  return { items: [], subtotal: 0, itemCount: 0 };
}

// Format price for display
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
