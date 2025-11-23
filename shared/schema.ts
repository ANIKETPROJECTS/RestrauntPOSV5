import { z } from "zod";

// User types
export interface User {
  id: string;
  username: string;
  password: string;
}

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Floor types
export interface Floor {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: Date;
}

export const insertFloorSchema = z.object({
  name: z.string(),
  displayOrder: z.number().default(0),
});

export type InsertFloor = z.infer<typeof insertFloorSchema>;

// Table types
export interface Table {
  id: string;
  tableNumber: string;
  seats: number;
  status: string;
  currentOrderId: string | null;
  floorId: string | null;
}

export const insertTableSchema = z.object({
  tableNumber: z.string(),
  seats: z.number(),
  status: z.string().default("free"),
  floorId: z.string().nullable().optional(),
});

export type InsertTable = z.infer<typeof insertTableSchema>;

// MenuItem types
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: string;
  cost: string;
  available: boolean;
  isVeg: boolean;
  variants: string[] | null;
  image: string | null;
  description: string | null;
  quickCode: string | null;
}

export const insertMenuItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.string(),
  cost: z.string(),
  available: z.boolean().default(true),
  isVeg: z.boolean().default(true),
  variants: z.array(z.string()).nullable().optional(),
  image: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  quickCode: z.string().nullable().optional(),
});

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;

// Order types
export interface Order {
  id: string;
  tableId: string | null;
  orderType: string;
  status: string;
  total: string;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  paymentMode: string | null;
  waiterId: string | null;
  deliveryPersonId: string | null;
  expectedPickupTime: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  billedAt: Date | null;
  paidAt: Date | null;
}

export const insertOrderSchema = z.object({
  tableId: z.string().nullable().optional(),
  orderType: z.string(),
  status: z.string().default("saved"),
  total: z.string().default("0"),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  paymentMode: z.string().nullable().optional(),
  waiterId: z.string().nullable().optional(),
  deliveryPersonId: z.string().nullable().optional(),
  expectedPickupTime: z.coerce.date().nullable().optional(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;

// OrderItem types
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: string;
  notes: string | null;
  status: string;
  isVeg: boolean;
}

export const insertOrderItemSchema = z.object({
  orderId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  quantity: z.number(),
  price: z.string(),
  notes: z.string().nullable().optional(),
  status: z.string().default("new"),
  isVeg: z.boolean().default(true),
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

// InventoryItem types
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: string;
  unit: string;
  minStock: string;
  supplierId: string | null;
  costPerUnit: string;
  lastUpdated: Date;
}

export const insertInventoryItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  currentStock: z.string(),
  unit: z.string(),
  minStock: z.string().default("0"),
  supplierId: z.string().nullable().optional(),
  costPerUnit: z.string().default("0"),
  image: z.string().nullable().optional(),
});

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// Recipe types - links menu items to their required ingredients
export interface Recipe {
  id: string;
  menuItemId: string;
  createdAt: Date;
}

export const insertRecipeSchema = z.object({
  menuItemId: z.string(),
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;

// RecipeIngredient types - the actual ingredients needed for a recipe
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
}

export const insertRecipeIngredientSchema = z.object({
  recipeId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string(),
});

export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;

// Supplier types
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
}

export const insertSupplierSchema = z.object({
  name: z.string(),
  contactPerson: z.string().nullable().optional(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.string().default("active"),
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

// PurchaseOrder types
export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  status: string;
  totalAmount: string;
  notes: string | null;
  createdAt: Date;
}

export const insertPurchaseOrderSchema = z.object({
  orderNumber: z.string(),
  supplierId: z.string(),
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  status: z.string().default("pending"),
  totalAmount: z.string().default("0"),
  notes: z.string().nullable().optional(),
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

// PurchaseOrderItem types
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
  totalCost: string;
}

export const insertPurchaseOrderItemSchema = z.object({
  purchaseOrderId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string(),
  costPerUnit: z.string(),
  totalCost: z.string(),
});

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

// Wastage types
export interface Wastage {
  id: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  reason: string;
  reportedBy: string | null;
  notes: string | null;
  createdAt: Date;
}

export const insertWastageSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string(),
  reason: z.string(),
  reportedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InsertWastage = z.infer<typeof insertWastageSchema>;

// Invoice types
export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  tableNumber: string | null;
  floorName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  paymentMode: string;
  splitPayments: string | null;
  status: string;
  items: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const insertInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  orderId: z.string(),
  tableNumber: z.string().nullable().optional(),
  floorName: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  subtotal: z.string(),
  tax: z.string(),
  discount: z.string().default("0"),
  total: z.string(),
  paymentMode: z.string(),
  splitPayments: z.string().nullable().optional(),
  status: z.string().default("Paid"),
  items: z.string(),
  notes: z.string().nullable().optional(),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Reservation types
export interface Reservation {
  id: string;
  tableId: string;
  customerName: string;
  customerPhone: string;
  numberOfPeople: number;
  timeSlot: Date;
  notes: string | null;
  status: string;
  createdAt: Date;
}

export const insertReservationSchema = z.object({
  tableId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  numberOfPeople: z.number(),
  timeSlot: z.coerce.date(),
  notes: z.string().nullable().optional(),
  status: z.string().default("active"),
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;

// Customer types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: Date;
}

export const insertCustomerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// Feedback types
export interface Feedback {
  id: string;
  customerId: string | null;
  customerName: string;
  rating: number;
  comment: string;
  sentiment: string;
  createdAt: Date;
}

export const insertFeedbackSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerName: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  sentiment: z.enum(["Positive", "Neutral", "Negative"]).default("Neutral"),
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

// InventoryUsage types - tracks when items are used
export interface InventoryUsage {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  usedAt: Date;
  source: string;
  notes: string | null;
  createdAt: Date;
}

export const insertInventoryUsageSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string(),
  source: z.string().default("manual"),
  notes: z.string().nullable().optional(),
});

export type InsertInventoryUsage = z.infer<typeof insertInventoryUsageSchema>;

// Category-specific units mapping
export const categoryUnits: Record<string, string[]> = {
  "Vegetables & Produce": ["kg", "g", "pcs", "bunch", "box"],
  "Meat & Poultry": ["kg", "g", "pcs", "lb"],
  "Fish & Seafood": ["kg", "g", "pcs", "lb"],
  "Dairy & Cheese": ["L", "ml", "kg", "g", "pcs", "box"],
  "Bakery & Bread": ["kg", "g", "pcs", "dozen", "box"],
  "Grains & Pasta": ["kg", "g", "pcs", "bag"],
  "Oils & Condiments": ["L", "ml", "kg", "bottle", "jar"],
  "Spices & Seasonings": ["kg", "g", "ml", "jar"],
  "Beverages": ["L", "ml", "pcs", "bottle", "can"],
  "Fruits": ["kg", "g", "pcs", "bunch", "box"],
  "Frozen Items": ["kg", "g", "pcs", "box"],
  "Canned & Packaged": ["pcs", "can", "jar", "box", "kg"],
  "Sauces & Dressings": ["L", "ml", "kg", "bottle", "jar"],
  "Sugar & Sweeteners": ["kg", "g", "pcs", "box"],
  "Coffee & Tea": ["kg", "g", "pcs", "box", "bag"],
  "Eggs": ["pcs", "dozen", "crate"],
  "Nuts & Seeds": ["kg", "g", "pcs", "bag"],
  "Herbs & Aromatics": ["kg", "g", "bunch", "pcs"],
  "Dry Goods": ["kg", "g", "pcs", "bag", "box"],
  "Other": ["kg", "g", "L", "ml", "pcs", "box"],
};

// Digital Menu Order types
export interface DigitalMenuOrderItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  price: number;
  total: number;
  spiceLevel?: string;
  notes?: string;
}

export interface DigitalMenuOrder {
  _id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: DigitalMenuOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  tableNumber?: string;
  floorNumber?: string;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DigitalMenuCustomer {
  _id: string;
  name: string;
  phoneNumber: string;
  visitCount: number;
  firstVisit: Date;
  lastVisit: Date;
  loginStatus: string;
  tableNumber?: string;
  floorNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}
