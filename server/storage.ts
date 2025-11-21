import {
  type User,
  type InsertUser,
  type Floor,
  type InsertFloor,
  type Table,
  type InsertTable,
  type MenuItem,
  type InsertMenuItem,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type InventoryItem,
  type InsertInventoryItem,
  type Recipe,
  type InsertRecipe,
  type RecipeIngredient,
  type InsertRecipeIngredient,
  type Supplier,
  type InsertSupplier,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type Wastage,
  type InsertWastage,
  type Invoice,
  type InsertInvoice,
  type Reservation,
  type InsertReservation,
  type Customer,
  type InsertCustomer,
  type Feedback,
  type InsertFeedback,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getFloors(): Promise<Floor[]>;
  getFloor(id: string): Promise<Floor | undefined>;
  createFloor(floor: InsertFloor): Promise<Floor>;
  updateFloor(id: string, floor: Partial<InsertFloor>): Promise<Floor | undefined>;
  deleteFloor(id: string): Promise<boolean>;

  getTables(): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  getTableByNumber(tableNumber: string): Promise<Table | undefined>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: string, table: Partial<InsertTable>): Promise<Table | undefined>;
  updateTableStatus(id: string, status: string): Promise<Table | undefined>;
  updateTableOrder(id: string, orderId: string | null): Promise<Table | undefined>;
  deleteTable(id: string): Promise<boolean>;

  getMenuItems(): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string): Promise<boolean>;

  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByTable(tableId: string): Promise<Order[]>;
  getActiveOrders(): Promise<Order[]>;
  getCompletedOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  updateOrderTotal(id: string, total: string): Promise<Order | undefined>;
  completeOrder(id: string): Promise<Order | undefined>;
  billOrder(id: string): Promise<Order | undefined>;
  checkoutOrder(id: string, paymentMode?: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;

  getOrderItems(orderId: string): Promise<OrderItem[]>;
  getOrderItem(id: string): Promise<OrderItem | undefined>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItemStatus(id: string, status: string): Promise<OrderItem | undefined>;
  deleteOrderItem(id: string): Promise<boolean>;

  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  updateInventoryQuantity(id: string, quantity: string): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;
  deductInventoryForOrder(orderId: string): Promise<void>;

  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipeByMenuItemId(menuItemId: string): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<boolean>;

  getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]>;
  getRecipeIngredient(id: string): Promise<RecipeIngredient | undefined>;
  createRecipeIngredient(ingredient: InsertRecipeIngredient): Promise<RecipeIngredient>;
  updateRecipeIngredient(id: string, ingredient: Partial<InsertRecipeIngredient>): Promise<RecipeIngredient | undefined>;
  deleteRecipeIngredient(id: string): Promise<boolean>;

  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;

  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  receivePurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<boolean>;

  getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]>;
  getPurchaseOrderItem(id: string): Promise<PurchaseOrderItem | undefined>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: string): Promise<boolean>;

  getWastages(): Promise<Wastage[]>;
  getWastage(id: string): Promise<Wastage | undefined>;
  createWastage(wastage: InsertWastage): Promise<Wastage>;
  deleteWastage(id: string): Promise<boolean>;

  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  getReservations(): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | undefined>;
  getReservationsByTable(tableId: string): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation | undefined>;
  deleteReservation(id: string): Promise<boolean>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  getFeedbacks(): Promise<Feedback[]>;
  getFeedback(id: string): Promise<Feedback | undefined>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  deleteFeedback(id: string): Promise<boolean>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  seedInventoryAndRecipes?(): Promise<{ inventoryCount: number; recipesCount: number; suppliersCount: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private floors: Map<string, Floor>;
  private tables: Map<string, Table>;
  private menuItems: Map<string, MenuItem>;
  private orders: Map<string, Order>;
  private orderItems: Map<string, OrderItem>;
  private inventoryItems: Map<string, InventoryItem>;
  private invoices: Map<string, Invoice>;
  private reservations: Map<string, Reservation>;
  private settings: Map<string, string>;

  constructor() {
    this.users = new Map();
    this.floors = new Map();
    this.tables = new Map();
    this.menuItems = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.inventoryItems = new Map();
    this.invoices = new Map();
    this.reservations = new Map();
    this.settings = new Map();
    this.seedData();
  }

  private seedData() {
    const defaultFloorId = randomUUID();
    const defaultFloor: Floor = {
      id: defaultFloorId,
      name: "Ground Floor",
      displayOrder: 0,
      createdAt: new Date(),
    };
    this.floors.set(defaultFloorId, defaultFloor);

    const tableNumbers = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const seats = [4, 6, 4, 2, 8, 4, 2, 6, 4, 4, 2, 4];
    
    tableNumbers.forEach((num, index) => {
      const id = randomUUID();
      const table: Table = {
        id,
        tableNumber: num,
        seats: seats[index],
        status: "free" as string,
        currentOrderId: null,
        floorId: defaultFloorId,
      };
      this.tables.set(id, table);
    });

    const menuData: Omit<MenuItem, "id">[] = [
      { name: "Chicken Burger", category: "Burgers", price: "199.00", cost: "80.00", available: true, isVeg: false, variants: ["Regular", "Large"], image: null, description: null, quickCode: "1" },
      { name: "Veggie Pizza", category: "Pizza", price: "299.00", cost: "120.00", available: true, isVeg: true, variants: null, image: null, description: null, quickCode: "2" },
      { name: "French Fries", category: "Fast Food", price: "99.00", cost: "35.00", available: true, isVeg: true, variants: ["Small", "Medium", "Large"], image: null, description: null, quickCode: "3" },
      { name: "Coca Cola", category: "Beverages", price: "50.00", cost: "20.00", available: true, isVeg: true, variants: null, image: null, description: null, quickCode: "4" },
      { name: "Caesar Salad", category: "Salads", price: "149.00", cost: "60.00", available: true, isVeg: true, variants: null, image: null, description: null, quickCode: "5" },
      { name: "Pasta Alfredo", category: "Pasta", price: "249.00", cost: "100.00", available: true, isVeg: true, variants: null, image: null, description: null, quickCode: "6" },
      { name: "Chocolate Cake", category: "Desserts", price: "129.00", cost: "50.00", available: true, isVeg: true, variants: null, image: null, description: null, quickCode: "7" },
      { name: "Ice Cream", category: "Desserts", price: "79.00", cost: "30.00", available: true, isVeg: true, variants: ["Vanilla", "Chocolate", "Strawberry"], image: null, description: null, quickCode: "8" },
    ];

    menuData.forEach((item) => {
      const id = randomUUID();
      const menuItem: MenuItem = {
        id,
        name: item.name,
        category: item.category,
        price: item.price,
        cost: item.cost,
        available: item.available,
        isVeg: item.isVeg,
        variants: item.variants,
        image: item.image,
        description: item.description,
        quickCode: item.quickCode,
      };
      this.menuItems.set(id, menuItem);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getFloors(): Promise<Floor[]> {
    return Array.from(this.floors.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getFloor(id: string): Promise<Floor | undefined> {
    return this.floors.get(id);
  }

  async createFloor(insertFloor: InsertFloor): Promise<Floor> {
    const id = randomUUID();
    const floor: Floor = {
      id,
      name: insertFloor.name,
      displayOrder: insertFloor.displayOrder ?? 0,
      createdAt: new Date(),
    };
    this.floors.set(id, floor);
    return floor;
  }

  async updateFloor(id: string, floorData: Partial<InsertFloor>): Promise<Floor | undefined> {
    const existing = this.floors.get(id);
    if (!existing) return undefined;
    const updated: Floor = {
      ...existing,
      name: floorData.name ?? existing.name,
      displayOrder: floorData.displayOrder ?? existing.displayOrder,
    };
    this.floors.set(id, updated);
    return updated;
  }

  async deleteFloor(id: string): Promise<boolean> {
    const tablesOnFloor = Array.from(this.tables.values()).filter(t => t.floorId === id);
    if (tablesOnFloor.length > 0) {
      throw new Error(`Cannot delete floor: ${tablesOnFloor.length} table(s) are assigned to this floor`);
    }
    return this.floors.delete(id);
  }

  async getTables(): Promise<Table[]> {
    return Array.from(this.tables.values());
  }

  async getTable(id: string): Promise<Table | undefined> {
    return this.tables.get(id);
  }

  async getTableByNumber(tableNumber: string): Promise<Table | undefined> {
    return Array.from(this.tables.values()).find((t) => t.tableNumber === tableNumber);
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const id = randomUUID();
    const table: Table = {
      id,
      tableNumber: insertTable.tableNumber,
      seats: insertTable.seats,
      status: insertTable.status ?? "free",
      currentOrderId: null,
      floorId: insertTable.floorId ?? null,
    };
    this.tables.set(id, table);
    return table;
  }

  async updateTable(id: string, tableData: Partial<InsertTable>): Promise<Table | undefined> {
    const existing = this.tables.get(id);
    if (!existing) return undefined;
    const updated: Table = {
      ...existing,
      tableNumber: tableData.tableNumber ?? existing.tableNumber,
      seats: tableData.seats ?? existing.seats,
      status: tableData.status ?? existing.status,
      floorId: tableData.floorId !== undefined ? tableData.floorId : existing.floorId,
    };
    this.tables.set(id, updated);
    return updated;
  }

  async updateTableStatus(id: string, status: string): Promise<Table | undefined> {
    const table = this.tables.get(id);
    if (!table) return undefined;
    const updated: Table = { ...table, status };
    this.tables.set(id, updated);
    return updated;
  }

  async updateTableOrder(id: string, orderId: string | null): Promise<Table | undefined> {
    const table = this.tables.get(id);
    if (!table) return undefined;
    const updated: Table = { ...table, currentOrderId: orderId };
    this.tables.set(id, updated);
    return updated;
  }

  async deleteTable(id: string): Promise<boolean> {
    return this.tables.delete(id);
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return Array.from(this.menuItems.values());
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    return this.menuItems.get(id);
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const id = randomUUID();
    
    // Validate quick code uniqueness if provided
    if (item.quickCode) {
      const existingItem = Array.from(this.menuItems.values()).find(
        menuItem => menuItem.quickCode === item.quickCode
      );
      if (existingItem) {
        throw new Error(`Quick code "${item.quickCode}" is already in use by "${existingItem.name}"`);
      }
    }
    
    const menuItem: MenuItem = {
      id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost: item.cost,
      available: item.available ?? true,
      isVeg: item.isVeg ?? true,
      variants: item.variants ?? null,
      image: item.image ?? null,
      description: item.description ?? null,
      quickCode: item.quickCode ?? null,
    };
    this.menuItems.set(id, menuItem);
    return menuItem;
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const existing = this.menuItems.get(id);
    if (!existing) return undefined;
    
    // Validate quick code uniqueness if being changed
    if (item.quickCode !== undefined && item.quickCode !== null) {
      const existingItem = Array.from(this.menuItems.values()).find(
        menuItem => menuItem.id !== id && menuItem.quickCode === item.quickCode
      );
      if (existingItem) {
        throw new Error(`Quick code "${item.quickCode}" is already in use by "${existingItem.name}"`);
      }
    }
    
    const updated: MenuItem = {
      ...existing,
      name: item.name ?? existing.name,
      category: item.category ?? existing.category,
      price: item.price ?? existing.price,
      cost: item.cost ?? existing.cost,
      available: item.available ?? existing.available,
      isVeg: item.isVeg ?? existing.isVeg,
      variants: item.variants !== undefined ? item.variants : existing.variants,
      image: item.image !== undefined ? item.image : existing.image,
      description: item.description !== undefined ? item.description : existing.description,
      quickCode: item.quickCode !== undefined ? item.quickCode : existing.quickCode,
    };
    this.menuItems.set(id, updated);
    return updated;
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    return this.menuItems.delete(id);
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByTable(tableId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.tableId === tableId);
  }

  async getActiveOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (o) => o.status === "sent_to_kitchen" || o.status === "ready_to_bill" || o.status === "billed"
    );
  }

  async getCompletedOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (o) => o.status === "paid" || o.status === "completed"
    );
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      id,
      tableId: insertOrder.tableId ?? null,
      orderType: insertOrder.orderType,
      status: insertOrder.status ?? "saved",
      total: insertOrder.total ?? "0",
      customerName: insertOrder.customerName ?? null,
      customerPhone: insertOrder.customerPhone ?? null,
      customerAddress: insertOrder.customerAddress ?? null,
      paymentMode: insertOrder.paymentMode ?? null,
      waiterId: insertOrder.waiterId ?? null,
      deliveryPersonId: insertOrder.deliveryPersonId ?? null,
      expectedPickupTime: insertOrder.expectedPickupTime ?? null,
      createdAt: new Date(),
      completedAt: null,
      billedAt: null,
      paidAt: null,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = { ...order, status };
    this.orders.set(id, updated);
    return updated;
  }

  async updateOrderTotal(id: string, total: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = { ...order, total };
    this.orders.set(id, updated);
    return updated;
  }

  async completeOrder(id: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = {
      ...order,
      status: "completed",
      completedAt: new Date(),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async billOrder(id: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = {
      ...order,
      status: "billed",
      billedAt: new Date(),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async checkoutOrder(id: string, paymentMode?: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = {
      ...order,
      status: "paid",
      paymentMode: paymentMode ?? order.paymentMode,
      paidAt: new Date(),
      completedAt: new Date(),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async deleteOrder(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter((item) => item.orderId === orderId);
  }

  async getOrderItem(id: string): Promise<OrderItem | undefined> {
    return this.orderItems.get(id);
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const orderItem: OrderItem = {
      id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes ?? null,
      status: item.status ?? "new",
      isVeg: item.isVeg ?? true,
    };
    this.orderItems.set(id, orderItem);
    return orderItem;
  }

  async updateOrderItemStatus(id: string, status: string): Promise<OrderItem | undefined> {
    const orderItem = this.orderItems.get(id);
    if (!orderItem) return undefined;
    const updated: OrderItem = { ...orderItem, status };
    this.orderItems.set(id, updated);
    return updated;
  }

  async deleteOrderItem(id: string): Promise<boolean> {
    return this.orderItems.delete(id);
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values());
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const inventoryItem: InventoryItem = {
      id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unit,
      minStock: item.minStock ?? "0",
      supplierId: item.supplierId ?? null,
      costPerUnit: item.costPerUnit ?? "0",
      lastUpdated: new Date(),
    };
    this.inventoryItems.set(id, inventoryItem);
    return inventoryItem;
  }

  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    const updated: InventoryItem = { ...item, ...data, lastUpdated: new Date() };
    this.inventoryItems.set(id, updated);
    return updated;
  }

  async updateInventoryQuantity(id: string, quantity: string): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    const updated: InventoryItem = { ...item, currentStock: quantity, lastUpdated: new Date() };
    this.inventoryItems.set(id, updated);
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  async deductInventoryForOrder(orderId: string): Promise<void> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getRecipes(): Promise<Recipe[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getRecipeByMenuItemId(menuItemId: string): Promise<Recipe | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deleteRecipe(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getRecipeIngredient(id: string): Promise<RecipeIngredient | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createRecipeIngredient(ingredient: InsertRecipeIngredient): Promise<RecipeIngredient> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async updateRecipeIngredient(id: string, ingredient: Partial<InsertRecipeIngredient>): Promise<RecipeIngredient | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deleteRecipeIngredient(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getSuppliers(): Promise<Supplier[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deleteSupplier(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async updatePurchaseOrder(id: string, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async receivePurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getPurchaseOrderItem(id: string): Promise<PurchaseOrderItem | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deletePurchaseOrderItem(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getWastages(): Promise<Wastage[]> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getWastage(id: string): Promise<Wastage | undefined> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async createWastage(wastage: InsertWastage): Promise<Wastage> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async deleteWastage(id: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage - use MongoStorage");
  }

  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    return Array.from(this.invoices.values()).find((inv) => inv.invoiceNumber === invoiceNumber);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      id,
      invoiceNumber: insertInvoice.invoiceNumber,
      orderId: insertInvoice.orderId,
      tableNumber: insertInvoice.tableNumber ?? null,
      floorName: insertInvoice.floorName ?? null,
      customerName: insertInvoice.customerName ?? null,
      customerPhone: insertInvoice.customerPhone ?? null,
      subtotal: insertInvoice.subtotal,
      tax: insertInvoice.tax,
      discount: insertInvoice.discount ?? "0",
      total: insertInvoice.total,
      paymentMode: insertInvoice.paymentMode,
      splitPayments: insertInvoice.splitPayments ?? null,
      status: insertInvoice.status ?? "Paid",
      items: insertInvoice.items,
      notes: insertInvoice.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, invoiceData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const existing = this.invoices.get(id);
    if (!existing) return undefined;
    const updated: Invoice = {
      ...existing,
      ...invoiceData,
      updatedAt: new Date(),
    };
    this.invoices.set(id, updated);
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  async getReservations(): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).sort((a, b) => 
      new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime()
    );
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }

  async getReservationsByTable(tableId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(
      (r) => r.tableId === tableId && r.status === "active"
    );
  }

  async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
    const id = randomUUID();
    const reservation: Reservation = {
      id,
      tableId: insertReservation.tableId,
      customerName: insertReservation.customerName,
      customerPhone: insertReservation.customerPhone,
      numberOfPeople: insertReservation.numberOfPeople,
      timeSlot: insertReservation.timeSlot,
      notes: insertReservation.notes ?? null,
      status: insertReservation.status ?? "active",
      createdAt: new Date(),
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async updateReservation(id: string, reservationData: Partial<InsertReservation>): Promise<Reservation | undefined> {
    const existing = this.reservations.get(id);
    if (!existing) return undefined;
    const updated: Reservation = {
      ...existing,
      tableId: reservationData.tableId ?? existing.tableId,
      customerName: reservationData.customerName ?? existing.customerName,
      customerPhone: reservationData.customerPhone ?? existing.customerPhone,
      numberOfPeople: reservationData.numberOfPeople ?? existing.numberOfPeople,
      timeSlot: reservationData.timeSlot ?? existing.timeSlot,
      notes: reservationData.notes !== undefined ? reservationData.notes : existing.notes,
      status: reservationData.status ?? existing.status,
    };
    this.reservations.set(id, updated);
    return updated;
  }

  async deleteReservation(id: string): Promise<boolean> {
    return this.reservations.delete(id);
  }

  async getSetting(key: string): Promise<string | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
}

import { MongoStorage } from './mongo-storage';

async function initializeStorage(): Promise<IStorage> {
  const storage = new MongoStorage();
  
  const floors = await storage.getFloors();
  if (floors.length === 0) {
    console.log('🌱 Seeding initial data...');
    
    const defaultFloor = await storage.createFloor({
      name: "Ground Floor",
      displayOrder: 0,
    });

    const tableNumbers = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const seats = [4, 6, 4, 2, 8, 4, 2, 6, 4, 4, 2, 4];
    
    for (let i = 0; i < tableNumbers.length; i++) {
      await storage.createTable({
        tableNumber: tableNumbers[i],
        seats: seats[i],
        status: "free",
        floorId: defaultFloor.id,
      });
    }

    const menuData = [
      { name: "Chicken Burger", category: "Burgers", price: "199.00", cost: "80.00", available: true, isVeg: false, variants: ["Regular", "Large"] },
      { name: "Veggie Pizza", category: "Pizza", price: "299.00", cost: "120.00", available: true, isVeg: true, variants: null },
      { name: "French Fries", category: "Fast Food", price: "99.00", cost: "35.00", available: true, isVeg: true, variants: ["Small", "Medium", "Large"] },
      { name: "Coca Cola", category: "Beverages", price: "50.00", cost: "20.00", available: true, isVeg: true, variants: null },
      { name: "Caesar Salad", category: "Salads", price: "149.00", cost: "60.00", available: true, isVeg: true, variants: null },
      { name: "Pasta Alfredo", category: "Pasta", price: "249.00", cost: "100.00", available: true, isVeg: true, variants: null },
      { name: "Chocolate Cake", category: "Desserts", price: "129.00", cost: "50.00", available: true, isVeg: true, variants: null },
      { name: "Ice Cream", category: "Desserts", price: "79.00", cost: "30.00", available: true, isVeg: true, variants: ["Vanilla", "Chocolate", "Strawberry"] },
    ];

    for (const item of menuData) {
      await storage.createMenuItem({
        ...item,
        image: null,
        description: null,
      });
    }

    console.log('✅ Initial data seeded successfully');
  }
  
  return storage;
}

export const storagePromise = initializeStorage();
export const storage = new MongoStorage();
