// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

// server/mongodb.ts
import { MongoClient } from "mongodb";
var MongoDBService = class {
  client = null;
  db = null;
  async connect() {
    if (this.client && this.db) {
      return;
    }
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      const dbName = this.extractDatabaseName(uri);
      this.db = this.client.db(dbName);
      console.log(`\u2705 Connected to MongoDB database: ${dbName}`);
    } catch (error) {
      console.error("\u274C MongoDB connection error:", error);
      throw error;
    }
  }
  extractDatabaseName(uri) {
    try {
      const url = new URL(uri);
      const pathname = url.pathname.substring(1);
      if (pathname && pathname !== "") {
        return pathname.split("?")[0];
      }
      return "restaurant_pos";
    } catch (error) {
      return "restaurant_pos";
    }
  }
  getDatabase() {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }
  getCollection(name) {
    return this.getDatabase().collection(name);
  }
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log("Disconnected from MongoDB");
    }
  }
};
var mongodb = new MongoDBService();

// server/mongo-storage.ts
import { randomUUID } from "crypto";
var MongoStorage = class {
  async ensureConnection() {
    await mongodb.connect();
  }
  stripMongoId(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  }
  async getUser(id) {
    await this.ensureConnection();
    const user = await mongodb.getCollection("users").findOne({ id });
    return user ?? void 0;
  }
  async getUserByUsername(username) {
    await this.ensureConnection();
    const user = await mongodb.getCollection("users").findOne({ username });
    return user ?? void 0;
  }
  async createUser(user) {
    await this.ensureConnection();
    const id = randomUUID();
    const newUser = { id, ...user };
    await mongodb.getCollection("users").insertOne(newUser);
    return newUser;
  }
  async getFloors() {
    await this.ensureConnection();
    const floors = await mongodb.getCollection("floors").find().sort({ displayOrder: 1 }).toArray();
    return floors;
  }
  async getFloor(id) {
    await this.ensureConnection();
    const floor = await mongodb.getCollection("floors").findOne({ id });
    return floor ?? void 0;
  }
  async createFloor(insertFloor) {
    await this.ensureConnection();
    const id = randomUUID();
    const floor = {
      id,
      name: insertFloor.name,
      displayOrder: insertFloor.displayOrder ?? 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("floors").insertOne(floor);
    return floor;
  }
  async updateFloor(id, floorData) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("floors").findOneAndUpdate(
      { id },
      { $set: floorData },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteFloor(id) {
    await this.ensureConnection();
    const tablesOnFloor = await mongodb.getCollection("tables").countDocuments({ floorId: id });
    if (tablesOnFloor > 0) {
      throw new Error(`Cannot delete floor: ${tablesOnFloor} table(s) are assigned to this floor`);
    }
    const result = await mongodb.getCollection("floors").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getTables() {
    await this.ensureConnection();
    const tables = await mongodb.getCollection("tables").find().toArray();
    return tables;
  }
  async getTable(id) {
    await this.ensureConnection();
    const table = await mongodb.getCollection("tables").findOne({ id });
    return table ?? void 0;
  }
  async getTableByNumber(tableNumber) {
    await this.ensureConnection();
    const table = await mongodb.getCollection("tables").findOne({ tableNumber });
    return table ?? void 0;
  }
  async createTable(insertTable) {
    await this.ensureConnection();
    const id = randomUUID();
    const table = {
      id,
      tableNumber: insertTable.tableNumber,
      seats: insertTable.seats,
      status: insertTable.status ?? "free",
      currentOrderId: null,
      floorId: insertTable.floorId ?? null
    };
    await mongodb.getCollection("tables").insertOne(table);
    return table;
  }
  async updateTable(id, tableData) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("tables").findOneAndUpdate(
      { id },
      { $set: tableData },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async updateTableStatus(id, status) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("tables").findOneAndUpdate(
      { id },
      { $set: { status } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async updateTableOrder(id, orderId) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("tables").findOneAndUpdate(
      { id },
      { $set: { currentOrderId: orderId } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteTable(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("tables").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getMenuItems() {
    await this.ensureConnection();
    const items = await mongodb.getCollection("menuItems").find().toArray();
    return items;
  }
  async getMenuItem(id) {
    await this.ensureConnection();
    const item = await mongodb.getCollection("menuItems").findOne({ id });
    return item ?? void 0;
  }
  async createMenuItem(item) {
    await this.ensureConnection();
    const normalizedQuickCode = item.quickCode ? item.quickCode.trim().toLowerCase() : null;
    if (normalizedQuickCode) {
      const existingItems = await mongodb.getCollection("menuItems").find().toArray();
      const duplicate = existingItems.find(
        (existing) => existing.quickCode && existing.quickCode.toLowerCase() === normalizedQuickCode
      );
      if (duplicate) {
        throw new Error(`Quick code "${item.quickCode}" is already assigned to another item`);
      }
    }
    const id = randomUUID();
    const menuItem = {
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
      quickCode: normalizedQuickCode
    };
    await mongodb.getCollection("menuItems").insertOne(menuItem);
    return menuItem;
  }
  async updateMenuItem(id, item) {
    await this.ensureConnection();
    const normalizedQuickCode = item.quickCode ? item.quickCode.trim().toLowerCase() : null;
    const updateData = { ...item };
    if (item.quickCode !== void 0) {
      updateData.quickCode = normalizedQuickCode;
    }
    if (normalizedQuickCode) {
      const existingItems = await mongodb.getCollection("menuItems").find().toArray();
      const duplicate = existingItems.find(
        (existing) => existing.id !== id && existing.quickCode && existing.quickCode.toLowerCase() === normalizedQuickCode
      );
      if (duplicate) {
        throw new Error(`Quick code "${item.quickCode}" is already assigned to another item`);
      }
    }
    const result = await mongodb.getCollection("menuItems").findOneAndUpdate(
      { id },
      { $set: updateData },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteMenuItem(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("menuItems").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getOrders() {
    await this.ensureConnection();
    const orders = await mongodb.getCollection("orders").find().toArray();
    return orders;
  }
  async getOrder(id) {
    await this.ensureConnection();
    const order = await mongodb.getCollection("orders").findOne({ id });
    return order ?? void 0;
  }
  async getOrdersByTable(tableId) {
    await this.ensureConnection();
    const orders = await mongodb.getCollection("orders").find({ tableId }).toArray();
    return orders;
  }
  async getActiveOrders() {
    await this.ensureConnection();
    const orders = await mongodb.getCollection("orders").find({
      status: { $in: ["sent_to_kitchen", "ready_to_bill", "billed"] }
    }).toArray();
    return orders;
  }
  async getCompletedOrders() {
    await this.ensureConnection();
    const orders = await mongodb.getCollection("orders").find({
      status: { $in: ["paid", "completed"] }
    }).toArray();
    return orders;
  }
  async createOrder(insertOrder) {
    await this.ensureConnection();
    const id = randomUUID();
    const order = {
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
      createdAt: /* @__PURE__ */ new Date(),
      completedAt: null,
      billedAt: null,
      paidAt: null
    };
    await mongodb.getCollection("orders").insertOne(order);
    return order;
  }
  async updateOrderStatus(id, status) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").findOneAndUpdate(
      { id },
      { $set: { status } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async updateOrderTotal(id, total) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").findOneAndUpdate(
      { id },
      { $set: { total } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async completeOrder(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").findOneAndUpdate(
      { id },
      { $set: { status: "completed", completedAt: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async billOrder(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").findOneAndUpdate(
      { id },
      { $set: { status: "billed", billedAt: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async checkoutOrder(id, paymentMode) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").findOneAndUpdate(
      { id },
      {
        $set: {
          status: "paid",
          paymentMode: paymentMode ?? null,
          paidAt: /* @__PURE__ */ new Date(),
          completedAt: /* @__PURE__ */ new Date()
        }
      },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteOrder(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orders").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getOrderItems(orderId) {
    await this.ensureConnection();
    const items = await mongodb.getCollection("orderItems").find({ orderId }).toArray();
    return items;
  }
  async getOrderItem(id) {
    await this.ensureConnection();
    const item = await mongodb.getCollection("orderItems").findOne({ id });
    return item ?? void 0;
  }
  async createOrderItem(item) {
    await this.ensureConnection();
    const id = randomUUID();
    const orderItem = {
      id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes ?? null,
      status: item.status ?? "new",
      isVeg: item.isVeg ?? true
    };
    await mongodb.getCollection("orderItems").insertOne(orderItem);
    return orderItem;
  }
  async updateOrderItemStatus(id, status) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orderItems").findOneAndUpdate(
      { id },
      { $set: { status } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteOrderItem(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("orderItems").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getInventoryItems() {
    await this.ensureConnection();
    const items = await mongodb.getCollection("inventoryItems").find().toArray();
    return items;
  }
  async getInventoryItem(id) {
    await this.ensureConnection();
    const item = await mongodb.getCollection("inventoryItems").findOne({ id });
    return item ?? void 0;
  }
  async createInventoryItem(item) {
    await this.ensureConnection();
    const id = randomUUID();
    const inventoryItem = {
      id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unit,
      minStock: item.minStock ?? "0",
      supplierId: item.supplierId ?? null,
      costPerUnit: item.costPerUnit ?? "0",
      lastUpdated: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("inventoryItems").insertOne(inventoryItem);
    return inventoryItem;
  }
  async updateInventoryItem(id, item) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("inventoryItems").findOneAndUpdate(
      { id },
      { $set: { ...item, lastUpdated: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async updateInventoryQuantity(id, quantity) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("inventoryItems").findOneAndUpdate(
      { id },
      { $set: { currentStock: quantity, lastUpdated: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteInventoryItem(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("inventoryItems").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async deductInventoryForOrder(orderId) {
    await this.ensureConnection();
    const orderItems = await this.getOrderItems(orderId);
    for (const orderItem of orderItems) {
      const recipe = await this.getRecipeByMenuItemId(orderItem.menuItemId);
      if (!recipe) continue;
      const recipeIngredients = await this.getRecipeIngredients(recipe.id);
      for (const ingredient of recipeIngredients) {
        const inventoryItem = await this.getInventoryItem(ingredient.inventoryItemId);
        if (!inventoryItem) continue;
        const quantityToDeduct = parseFloat(ingredient.quantity) * orderItem.quantity;
        const newStock = parseFloat(inventoryItem.currentStock) - quantityToDeduct;
        await this.updateInventoryQuantity(ingredient.inventoryItemId, newStock.toString());
      }
    }
  }
  async getRecipes() {
    await this.ensureConnection();
    const recipes = await mongodb.getCollection("recipes").find().toArray();
    return recipes;
  }
  async getRecipe(id) {
    await this.ensureConnection();
    const recipe = await mongodb.getCollection("recipes").findOne({ id });
    return recipe ?? void 0;
  }
  async getRecipeByMenuItemId(menuItemId) {
    await this.ensureConnection();
    const recipe = await mongodb.getCollection("recipes").findOne({ menuItemId }, {
      sort: { createdAt: -1 }
    });
    return recipe ?? void 0;
  }
  async createRecipe(insertRecipe) {
    await this.ensureConnection();
    const id = randomUUID();
    const recipe = {
      id,
      menuItemId: insertRecipe.menuItemId,
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("recipes").insertOne(recipe);
    return recipe;
  }
  async deleteRecipe(id) {
    await this.ensureConnection();
    await mongodb.getCollection("recipeIngredients").deleteMany({ recipeId: id });
    const result = await mongodb.getCollection("recipes").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getRecipeIngredients(recipeId) {
    await this.ensureConnection();
    const ingredients = await mongodb.getCollection("recipeIngredients").find({ recipeId }).toArray();
    return ingredients;
  }
  async getRecipeIngredient(id) {
    await this.ensureConnection();
    const ingredient = await mongodb.getCollection("recipeIngredients").findOne({ id });
    return ingredient ?? void 0;
  }
  async createRecipeIngredient(insertIngredient) {
    await this.ensureConnection();
    const id = randomUUID();
    const ingredient = {
      id,
      recipeId: insertIngredient.recipeId,
      inventoryItemId: insertIngredient.inventoryItemId,
      quantity: insertIngredient.quantity,
      unit: insertIngredient.unit
    };
    await mongodb.getCollection("recipeIngredients").insertOne(ingredient);
    return ingredient;
  }
  async updateRecipeIngredient(id, data) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("recipeIngredients").findOneAndUpdate(
      { id },
      { $set: data },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteRecipeIngredient(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("recipeIngredients").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getSuppliers() {
    await this.ensureConnection();
    const suppliers = await mongodb.getCollection("suppliers").find().toArray();
    return suppliers;
  }
  async getSupplier(id) {
    await this.ensureConnection();
    const supplier = await mongodb.getCollection("suppliers").findOne({ id });
    return supplier ?? void 0;
  }
  async createSupplier(insertSupplier) {
    await this.ensureConnection();
    const id = randomUUID();
    const supplier = {
      id,
      name: insertSupplier.name,
      contactPerson: insertSupplier.contactPerson ?? null,
      phone: insertSupplier.phone,
      email: insertSupplier.email ?? null,
      address: insertSupplier.address ?? null,
      status: insertSupplier.status ?? "active",
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("suppliers").insertOne(supplier);
    return supplier;
  }
  async updateSupplier(id, data) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("suppliers").findOneAndUpdate(
      { id },
      { $set: data },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteSupplier(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("suppliers").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getPurchaseOrders() {
    await this.ensureConnection();
    const orders = await mongodb.getCollection("purchaseOrders").find().sort({ orderDate: -1 }).toArray();
    return orders;
  }
  async getPurchaseOrder(id) {
    await this.ensureConnection();
    const order = await mongodb.getCollection("purchaseOrders").findOne({ id });
    return order ?? void 0;
  }
  async createPurchaseOrder(insertOrder) {
    await this.ensureConnection();
    const id = randomUUID();
    const order = {
      id,
      orderNumber: insertOrder.orderNumber,
      supplierId: insertOrder.supplierId,
      orderDate: insertOrder.orderDate,
      expectedDeliveryDate: insertOrder.expectedDeliveryDate ?? null,
      actualDeliveryDate: null,
      status: insertOrder.status ?? "pending",
      totalAmount: insertOrder.totalAmount ?? "0",
      notes: insertOrder.notes ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("purchaseOrders").insertOne(order);
    return order;
  }
  async updatePurchaseOrder(id, data) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("purchaseOrders").findOneAndUpdate(
      { id },
      { $set: data },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async receivePurchaseOrder(id) {
    await this.ensureConnection();
    const purchaseOrderItems = await this.getPurchaseOrderItems(id);
    for (const item of purchaseOrderItems) {
      const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
      if (inventoryItem) {
        const newStock = parseFloat(inventoryItem.currentStock) + parseFloat(item.quantity);
        await this.updateInventoryQuantity(item.inventoryItemId, newStock.toString());
      }
    }
    const result = await mongodb.getCollection("purchaseOrders").findOneAndUpdate(
      { id },
      { $set: { status: "received", actualDeliveryDate: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deletePurchaseOrder(id) {
    await this.ensureConnection();
    await mongodb.getCollection("purchaseOrderItems").deleteMany({ purchaseOrderId: id });
    const result = await mongodb.getCollection("purchaseOrders").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getPurchaseOrderItems(purchaseOrderId) {
    await this.ensureConnection();
    const items = await mongodb.getCollection("purchaseOrderItems").find({ purchaseOrderId }).toArray();
    return items;
  }
  async getPurchaseOrderItem(id) {
    await this.ensureConnection();
    const item = await mongodb.getCollection("purchaseOrderItems").findOne({ id });
    return item ?? void 0;
  }
  async createPurchaseOrderItem(insertItem) {
    await this.ensureConnection();
    const id = randomUUID();
    const item = {
      id,
      purchaseOrderId: insertItem.purchaseOrderId,
      inventoryItemId: insertItem.inventoryItemId,
      quantity: insertItem.quantity,
      unit: insertItem.unit,
      costPerUnit: insertItem.costPerUnit,
      totalCost: insertItem.totalCost
    };
    await mongodb.getCollection("purchaseOrderItems").insertOne(item);
    return item;
  }
  async updatePurchaseOrderItem(id, data) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("purchaseOrderItems").findOneAndUpdate(
      { id },
      { $set: data },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deletePurchaseOrderItem(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("purchaseOrderItems").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getWastages() {
    await this.ensureConnection();
    const wastages = await mongodb.getCollection("wastages").find().sort({ createdAt: -1 }).toArray();
    return wastages;
  }
  async getWastage(id) {
    await this.ensureConnection();
    const wastage = await mongodb.getCollection("wastages").findOne({ id });
    return wastage ?? void 0;
  }
  async createWastage(insertWastage) {
    await this.ensureConnection();
    const id = randomUUID();
    const wastage = {
      id,
      inventoryItemId: insertWastage.inventoryItemId,
      quantity: insertWastage.quantity,
      unit: insertWastage.unit,
      reason: insertWastage.reason,
      reportedBy: insertWastage.reportedBy ?? null,
      notes: insertWastage.notes ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    const inventoryItem = await this.getInventoryItem(insertWastage.inventoryItemId);
    if (inventoryItem) {
      const newStock = parseFloat(inventoryItem.currentStock) - parseFloat(insertWastage.quantity);
      await this.updateInventoryQuantity(insertWastage.inventoryItemId, newStock.toString());
    }
    await mongodb.getCollection("wastages").insertOne(wastage);
    return wastage;
  }
  async deleteWastage(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("wastages").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getInvoices() {
    await this.ensureConnection();
    const invoices = await mongodb.getCollection("invoices").find().sort({ createdAt: -1 }).toArray();
    return invoices;
  }
  async getInvoice(id) {
    await this.ensureConnection();
    const invoice = await mongodb.getCollection("invoices").findOne({ id });
    return invoice ?? void 0;
  }
  async getInvoiceByNumber(invoiceNumber) {
    await this.ensureConnection();
    const invoice = await mongodb.getCollection("invoices").findOne({ invoiceNumber });
    return invoice ?? void 0;
  }
  async createInvoice(insertInvoice) {
    await this.ensureConnection();
    const id = randomUUID();
    const invoice = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("invoices").insertOne(invoice);
    return invoice;
  }
  async updateInvoice(id, invoiceData) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("invoices").findOneAndUpdate(
      { id },
      { $set: { ...invoiceData, updatedAt: /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteInvoice(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("invoices").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getReservations() {
    await this.ensureConnection();
    const reservations = await mongodb.getCollection("reservations").find().sort({ timeSlot: 1 }).toArray();
    return reservations;
  }
  async getReservation(id) {
    await this.ensureConnection();
    const reservation = await mongodb.getCollection("reservations").findOne({ id });
    return reservation ?? void 0;
  }
  async getReservationsByTable(tableId) {
    await this.ensureConnection();
    const reservations = await mongodb.getCollection("reservations").find({
      tableId,
      status: "active"
    }).toArray();
    return reservations;
  }
  async createReservation(insertReservation) {
    await this.ensureConnection();
    const id = randomUUID();
    const reservation = {
      id,
      tableId: insertReservation.tableId,
      customerName: insertReservation.customerName,
      customerPhone: insertReservation.customerPhone,
      numberOfPeople: insertReservation.numberOfPeople,
      timeSlot: insertReservation.timeSlot,
      notes: insertReservation.notes ?? null,
      status: insertReservation.status ?? "active",
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("reservations").insertOne(reservation);
    return reservation;
  }
  async updateReservation(id, reservationData) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("reservations").findOneAndUpdate(
      { id },
      { $set: reservationData },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteReservation(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("reservations").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getCustomers() {
    await this.ensureConnection();
    const customers = await mongodb.getCollection("customers").find().sort({ createdAt: -1 }).toArray();
    return customers;
  }
  async getCustomer(id) {
    await this.ensureConnection();
    const customer = await mongodb.getCollection("customers").findOne({ id });
    return customer ?? void 0;
  }
  async getCustomerByPhone(phone) {
    await this.ensureConnection();
    const customer = await mongodb.getCollection("customers").findOne({ phone });
    return customer ?? void 0;
  }
  async createCustomer(insertCustomer) {
    await this.ensureConnection();
    const id = randomUUID();
    const customer = {
      id,
      name: insertCustomer.name,
      phone: insertCustomer.phone,
      email: insertCustomer.email ?? null,
      address: insertCustomer.address ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("customers").insertOne(customer);
    return customer;
  }
  async updateCustomer(id, customerData) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("customers").findOneAndUpdate(
      { id },
      { $set: customerData },
      { returnDocument: "after" }
    );
    return result ?? void 0;
  }
  async deleteCustomer(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("customers").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getFeedbacks() {
    await this.ensureConnection();
    const feedbacks = await mongodb.getCollection("feedbacks").find().sort({ createdAt: -1 }).toArray();
    return feedbacks;
  }
  async getFeedback(id) {
    await this.ensureConnection();
    const feedback = await mongodb.getCollection("feedbacks").findOne({ id });
    return feedback ?? void 0;
  }
  async createFeedback(insertFeedback) {
    await this.ensureConnection();
    const id = randomUUID();
    const feedback = {
      id,
      customerId: insertFeedback.customerId ?? null,
      customerName: insertFeedback.customerName,
      rating: insertFeedback.rating,
      comment: insertFeedback.comment,
      sentiment: insertFeedback.sentiment || "Neutral",
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("feedbacks").insertOne(feedback);
    return feedback;
  }
  async deleteFeedback(id) {
    await this.ensureConnection();
    const result = await mongodb.getCollection("feedbacks").deleteOne({ id });
    return result.deletedCount > 0;
  }
  async getSetting(key) {
    await this.ensureConnection();
    const setting = await mongodb.getCollection("settings").findOne({ key });
    return setting?.value;
  }
  async setSetting(key, value) {
    await this.ensureConnection();
    await mongodb.getCollection("settings").updateOne(
      { key },
      { $set: { key, value } },
      { upsert: true }
    );
  }
  async getInventoryUsages() {
    await this.ensureConnection();
    const usages = await mongodb.getCollection("inventoryUsages").find().sort({ usedAt: -1 }).toArray();
    return usages;
  }
  async getInventoryUsagesByItem(inventoryItemId) {
    await this.ensureConnection();
    const usages = await mongodb.getCollection("inventoryUsages").find({ inventoryItemId }).sort({ usedAt: -1 }).toArray();
    return usages;
  }
  async createInventoryUsage(usage) {
    await this.ensureConnection();
    const id = randomUUID();
    const newUsage = {
      id,
      inventoryItemId: usage.inventoryItemId,
      itemName: usage.itemName,
      quantity: usage.quantity,
      unit: usage.unit,
      usedAt: /* @__PURE__ */ new Date(),
      source: usage.source || "manual",
      notes: usage.notes || null,
      createdAt: /* @__PURE__ */ new Date()
    };
    await mongodb.getCollection("inventoryUsages").insertOne(newUsage);
    return newUsage;
  }
  async getMostUsedItems(limit = 10) {
    await this.ensureConnection();
    const usages = await mongodb.getCollection("inventoryUsages").find().toArray();
    const itemMap = /* @__PURE__ */ new Map();
    for (const usage of usages) {
      const key = usage.inventoryItemId;
      const qty = parseFloat(usage.quantity) || 0;
      if (!itemMap.has(key)) {
        itemMap.set(key, { itemName: usage.itemName, totalQuantity: qty, count: 1 });
      } else {
        const existing = itemMap.get(key);
        existing.totalQuantity += qty;
        existing.count += 1;
      }
    }
    const sorted = Array.from(itemMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, limit).map(([itemId, data]) => ({
      itemId,
      itemName: data.itemName,
      totalQuantity: data.totalQuantity.toString(),
      count: data.count
    }));
    return sorted;
  }
  async seedInventoryAndRecipes() {
    await this.ensureConnection();
    const existingInventory = await this.getInventoryItems();
    if (existingInventory.length > 0) {
      return { inventoryCount: existingInventory.length, recipesCount: 0, suppliersCount: 0 };
    }
    const supplier1 = await this.createSupplier({
      name: "Fresh Foods Inc.",
      contactPerson: "John Smith",
      phone: "+1-555-0101",
      email: "john@freshfoods.com",
      address: "123 Market Street, City, State 12345",
      status: "active"
    });
    const supplier2 = await this.createSupplier({
      name: "Quality Ingredients Co.",
      contactPerson: "Sarah Johnson",
      phone: "+1-555-0202",
      email: "sarah@qualityingredients.com",
      address: "456 Supply Lane, City, State 12345",
      status: "active"
    });
    const inventoryItemsData = [
      { name: "Chicken Breast", category: "Meat & Poultry", currentStock: "50000", unit: "g", minStock: "10000", costPerUnit: "0.015", supplierId: supplier1.id },
      { name: "Baby Corn", category: "Vegetables", currentStock: "20000", unit: "g", minStock: "5000", costPerUnit: "0.008", supplierId: supplier1.id },
      { name: "Cooking Oil", category: "Cooking Essentials", currentStock: "10000", unit: "ml", minStock: "2000", costPerUnit: "0.005", supplierId: supplier2.id },
      { name: "Soy Sauce", category: "Condiments", currentStock: "5000", unit: "ml", minStock: "1000", costPerUnit: "0.010", supplierId: supplier2.id },
      { name: "Spices Mix", category: "Spices", currentStock: "5000", unit: "g", minStock: "1000", costPerUnit: "0.020", supplierId: supplier2.id },
      { name: "Wheat Flour", category: "Baking", currentStock: "30000", unit: "g", minStock: "5000", costPerUnit: "0.003", supplierId: supplier2.id },
      { name: "Cheese", category: "Dairy", currentStock: "15000", unit: "g", minStock: "3000", costPerUnit: "0.012", supplierId: supplier1.id },
      { name: "Mixed Vegetables", category: "Vegetables", currentStock: "25000", unit: "g", minStock: "5000", costPerUnit: "0.006", supplierId: supplier1.id },
      { name: "Burger Buns", category: "Bakery", currentStock: "200", unit: "pcs", minStock: "50", costPerUnit: "0.50", supplierId: supplier1.id },
      { name: "Pizza Dough", category: "Bakery", currentStock: "100", unit: "pcs", minStock: "20", costPerUnit: "1.20", supplierId: supplier1.id },
      { name: "Tomato Sauce", category: "Condiments", currentStock: "8000", unit: "ml", minStock: "2000", costPerUnit: "0.008", supplierId: supplier2.id },
      { name: "Potatoes", category: "Vegetables", currentStock: "40000", unit: "g", minStock: "10000", costPerUnit: "0.002", supplierId: supplier1.id },
      { name: "Lettuce", category: "Vegetables", currentStock: "3000", unit: "g", minStock: "500", costPerUnit: "0.015", supplierId: supplier1.id },
      { name: "Pasta", category: "Pasta & Grains", currentStock: "20000", unit: "g", minStock: "5000", costPerUnit: "0.004", supplierId: supplier2.id },
      { name: "Cream", category: "Dairy", currentStock: "8000", unit: "ml", minStock: "2000", costPerUnit: "0.012", supplierId: supplier1.id },
      { name: "Chocolate", category: "Desserts", currentStock: "5000", unit: "g", minStock: "1000", costPerUnit: "0.025", supplierId: supplier2.id },
      { name: "Vanilla Extract", category: "Flavorings", currentStock: "2000", unit: "ml", minStock: "500", costPerUnit: "0.030", supplierId: supplier2.id },
      { name: "Strawberries", category: "Fruits", currentStock: "3000", unit: "g", minStock: "1000", costPerUnit: "0.020", supplierId: supplier1.id },
      { name: "Coca Cola Syrup", category: "Beverages", currentStock: "10000", unit: "ml", minStock: "2000", costPerUnit: "0.008", supplierId: supplier2.id }
    ];
    const inventoryItems = [];
    for (const itemData of inventoryItemsData) {
      const item = await this.createInventoryItem(itemData);
      inventoryItems.push(item);
    }
    const inventoryMap = new Map(inventoryItems.map((item) => [item.name, item]));
    const menuItems = await this.getMenuItems();
    let recipesCreated = 0;
    const recipeData = {
      "Chicken Burger": {
        ingredients: ["Chicken Breast", "Burger Buns", "Lettuce"],
        quantities: ["150", "1", "30"],
        units: ["g", "pcs", "g"]
      },
      "Veggie Pizza": {
        ingredients: ["Pizza Dough", "Cheese", "Mixed Vegetables", "Tomato Sauce"],
        quantities: ["1", "200", "150", "100"],
        units: ["pcs", "g", "g", "ml"]
      },
      "French Fries": {
        ingredients: ["Potatoes", "Cooking Oil"],
        quantities: ["300", "50"],
        units: ["g", "ml"]
      },
      "Coca Cola": {
        ingredients: ["Coca Cola Syrup"],
        quantities: ["30"],
        units: ["ml"]
      },
      "Caesar Salad": {
        ingredients: ["Lettuce", "Cheese", "Chicken Breast"],
        quantities: ["100", "50", "80"],
        units: ["g", "g", "g"]
      },
      "Pasta Alfredo": {
        ingredients: ["Pasta", "Cream", "Cheese"],
        quantities: ["200", "150", "80"],
        units: ["g", "ml", "g"]
      },
      "Chocolate Cake": {
        ingredients: ["Wheat Flour", "Chocolate", "Cream"],
        quantities: ["150", "100", "50"],
        units: ["g", "g", "ml"]
      },
      "Ice Cream": {
        ingredients: ["Cream", "Vanilla Extract", "Strawberries"],
        quantities: ["150", "10", "50"],
        units: ["ml", "ml", "g"]
      }
    };
    for (const menuItem of menuItems) {
      const recipeInfo = recipeData[menuItem.name];
      if (!recipeInfo) continue;
      const recipe = await this.createRecipe({
        menuItemId: menuItem.id
      });
      for (let i = 0; i < recipeInfo.ingredients.length; i++) {
        const ingredientName = recipeInfo.ingredients[i];
        const inventoryItem = inventoryMap.get(ingredientName);
        if (!inventoryItem) continue;
        await this.createRecipeIngredient({
          recipeId: recipe.id,
          inventoryItemId: inventoryItem.id,
          quantity: recipeInfo.quantities[i],
          unit: recipeInfo.units[i]
        });
      }
      recipesCreated++;
    }
    return {
      inventoryCount: inventoryItems.length,
      recipesCount: recipesCreated,
      suppliersCount: 2
    };
  }
};

// server/storage.ts
async function initializeStorage() {
  const storage2 = new MongoStorage();
  const floors = await storage2.getFloors();
  if (floors.length === 0) {
    console.log("\u{1F331} Seeding initial data...");
    const defaultFloor = await storage2.createFloor({
      name: "Ground Floor",
      displayOrder: 0
    });
    const tableNumbers = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const seats = [4, 6, 4, 2, 8, 4, 2, 6, 4, 4, 2, 4];
    for (let i = 0; i < tableNumbers.length; i++) {
      await storage2.createTable({
        tableNumber: tableNumbers[i],
        seats: seats[i],
        status: "free",
        floorId: defaultFloor.id
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
      { name: "Ice Cream", category: "Desserts", price: "79.00", cost: "30.00", available: true, isVeg: true, variants: ["Vanilla", "Chocolate", "Strawberry"] }
    ];
    for (const item of menuData) {
      await storage2.createMenuItem({
        ...item,
        image: null,
        description: null
      });
    }
    console.log("\u2705 Initial data seeded successfully");
  }
  return storage2;
}
var storagePromise = initializeStorage();
var storage = new MongoStorage();

// shared/schema.ts
import { z } from "zod";
var insertUserSchema = z.object({
  username: z.string(),
  password: z.string()
});
var insertFloorSchema = z.object({
  name: z.string(),
  displayOrder: z.number().default(0)
});
var insertTableSchema = z.object({
  tableNumber: z.string(),
  seats: z.number(),
  status: z.string().default("free"),
  floorId: z.string().nullable().optional()
});
var insertMenuItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.string(),
  cost: z.string(),
  available: z.boolean().default(true),
  isVeg: z.boolean().default(true),
  variants: z.array(z.string()).nullable().optional(),
  image: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  quickCode: z.string().nullable().optional()
});
var insertOrderSchema = z.object({
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
  expectedPickupTime: z.coerce.date().nullable().optional()
});
var insertOrderItemSchema = z.object({
  orderId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  quantity: z.number(),
  price: z.string(),
  notes: z.string().nullable().optional(),
  status: z.string().default("new"),
  isVeg: z.boolean().default(true)
});
var insertInventoryItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  currentStock: z.string(),
  unit: z.string(),
  minStock: z.string().default("0"),
  supplierId: z.string().nullable().optional(),
  costPerUnit: z.string().default("0"),
  image: z.string().nullable().optional()
});
var insertRecipeSchema = z.object({
  menuItemId: z.string()
});
var insertRecipeIngredientSchema = z.object({
  recipeId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string()
});
var insertSupplierSchema = z.object({
  name: z.string(),
  contactPerson: z.string().nullable().optional(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.string().default("active")
});
var insertPurchaseOrderSchema = z.object({
  orderNumber: z.string(),
  supplierId: z.string(),
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  status: z.string().default("pending"),
  totalAmount: z.string().default("0"),
  notes: z.string().nullable().optional()
});
var insertPurchaseOrderItemSchema = z.object({
  purchaseOrderId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string(),
  costPerUnit: z.string(),
  totalCost: z.string()
});
var insertWastageSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.string(),
  unit: z.string(),
  reason: z.string(),
  reportedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});
var insertInvoiceSchema = z.object({
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
  notes: z.string().nullable().optional()
});
var insertReservationSchema = z.object({
  tableId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  numberOfPeople: z.number(),
  timeSlot: z.coerce.date(),
  notes: z.string().nullable().optional(),
  status: z.string().default("active")
});
var insertCustomerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional()
});
var insertFeedbackSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerName: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  sentiment: z.enum(["Positive", "Neutral", "Negative"]).default("Neutral")
});
var insertInventoryUsageSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string(),
  source: z.string().default("manual"),
  notes: z.string().nullable().optional()
});

// server/routes.ts
import { z as z2 } from "zod";

// server/mongodbService.ts
import { MongoClient as MongoClient2 } from "mongodb";
async function fetchMenuItemsFromMongoDB(mongoUri, databaseName) {
  let client = null;
  try {
    let dbName;
    if (databaseName) {
      dbName = databaseName;
    } else {
      dbName = extractDatabaseName(mongoUri);
    }
    client = new MongoClient2(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const allItems = [];
    const categorySet = /* @__PURE__ */ new Set();
    for (const collection of collections) {
      const collectionName = collection.name;
      if (collectionName === "system.indexes" || collectionName.startsWith("system.")) {
        continue;
      }
      const coll = db.collection(collectionName);
      const items = await coll.find({}).toArray();
      for (const item of items) {
        const category = item.category || collectionName;
        categorySet.add(category);
        const menuItem = {
          name: item.name,
          category,
          price: item.price?.toString() || "0",
          cost: item.price ? (item.price * 0.4).toFixed(2) : "0",
          available: item.isAvailable !== void 0 ? item.isAvailable : true,
          isVeg: item.isVeg !== void 0 ? item.isVeg : true,
          variants: null,
          image: item.image || null,
          description: item.description || null
        };
        allItems.push(menuItem);
      }
    }
    return {
      items: allItems,
      categories: Array.from(categorySet).sort()
    };
  } catch (error) {
    console.error("Error fetching from MongoDB:", error);
    throw new Error(`Failed to fetch menu items from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (client) {
      await client.close();
    }
  }
}
function extractDatabaseName(mongoUri) {
  const appNameMatch = mongoUri.match(/appName=([^&]+)/i);
  if (appNameMatch && appNameMatch[1]) {
    return appNameMatch[1].toLowerCase();
  }
  const pathMatch = mongoUri.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?&]+)/);
  if (pathMatch && pathMatch[1] && pathMatch[1] !== "") {
    return pathMatch[1];
  }
  return "test";
}

// server/utils/invoiceGenerator.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
function generateInvoicePDF(data) {
  const { invoice, order, orderItems, restaurantName = "Restaurant POS", restaurantAddress = "", restaurantPhone = "", restaurantGSTIN = "" } = data;
  if (!invoice || !order || !orderItems) {
    throw new Error("Missing required data for PDF generation");
  }
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(restaurantName, pageWidth / 2, yPosition, { align: "center" });
  if (restaurantAddress) {
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(restaurantAddress, pageWidth / 2, yPosition, { align: "center" });
  }
  if (restaurantPhone) {
    yPosition += 5;
    doc.text(`Phone: ${restaurantPhone}`, pageWidth / 2, yPosition, { align: "center" });
  }
  if (restaurantGSTIN) {
    yPosition += 5;
    doc.text(`GSTIN: ${restaurantGSTIN}`, pageWidth / 2, yPosition, { align: "center" });
  }
  yPosition += 10;
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  if (order.orderType === "delivery") {
    doc.text("DELIVERY INVOICE", pageWidth / 2, yPosition, { align: "center" });
  } else if (order.orderType === "pickup") {
    doc.text("PICKUP INVOICE", pageWidth / 2, yPosition, { align: "center" });
  } else {
    doc.text("DINE-IN INVOICE", pageWidth / 2, yPosition, { align: "center" });
  }
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const invoiceDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt || Date.now());
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 15, yPosition);
  doc.text(`Date: ${invoiceDate.toLocaleString()}`, pageWidth - 15, yPosition, { align: "right" });
  yPosition += 7;
  if (order.orderType === "dine-in" && invoice.tableNumber) {
    doc.text(`Table: ${invoice.tableNumber}`, 15, yPosition);
    if (invoice.floorName) {
      doc.text(`Floor: ${invoice.floorName}`, 60, yPosition);
    }
  } else if ((order.orderType === "delivery" || order.orderType === "pickup") && invoice.customerName) {
    doc.text(`Customer: ${invoice.customerName}`, 15, yPosition);
    if (invoice.customerPhone) {
      doc.text(`Phone: ${invoice.customerPhone}`, pageWidth - 15, yPosition, { align: "right" });
    }
    if (order.orderType === "delivery" && order.customerAddress) {
      yPosition += 7;
      doc.text(`Address: ${order.customerAddress}`, 15, yPosition);
    }
  }
  yPosition += 10;
  const tableData = orderItems.map((item) => [
    item.name + (item.isVeg ? " \u{1F331}" : ""),
    item.quantity.toString(),
    `\u20B9${parseFloat(item.price).toFixed(2)}`,
    `\u20B9${(parseFloat(item.price) * item.quantity).toFixed(2)}`
  ]);
  autoTable(doc, {
    startY: yPosition,
    head: [["Item", "Qty", "Price", "Total"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 35, halign: "right" }
    }
  });
  yPosition = doc.lastAutoTable.finalY + 10;
  const subtotal = parseFloat(invoice.subtotal);
  const tax = parseFloat(invoice.tax);
  const discount = parseFloat(invoice.discount || "0");
  const total = parseFloat(invoice.total);
  doc.setFontSize(11);
  const summaryX = pageWidth - 70;
  doc.text("Subtotal:", summaryX, yPosition);
  doc.text(`\u20B9${subtotal.toFixed(2)}`, pageWidth - 15, yPosition, { align: "right" });
  yPosition += 7;
  doc.text("Tax (5%):", summaryX, yPosition);
  doc.text(`\u20B9${tax.toFixed(2)}`, pageWidth - 15, yPosition, { align: "right" });
  if (discount > 0) {
    yPosition += 7;
    doc.text("Discount:", summaryX, yPosition);
    doc.text(`-\u20B9${discount.toFixed(2)}`, pageWidth - 15, yPosition, { align: "right" });
  }
  yPosition += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand Total:", summaryX, yPosition);
  doc.text(`\u20B9${total.toFixed(2)}`, pageWidth - 15, yPosition, { align: "right" });
  yPosition += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const paymentText = invoice.splitPayments ? `Split Payment (${JSON.parse(invoice.splitPayments).length} ways)` : `Payment Mode: ${invoice.paymentMode?.toUpperCase() || "CASH"}`;
  doc.text(paymentText, summaryX, yPosition);
  doc.text("PAID", pageWidth - 15, yPosition, { align: "right" });
  if (order.orderType === "delivery") {
    yPosition += 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("This is a delivery order. Please ensure items are delivered to the customer address.", 15, yPosition);
  } else if (order.orderType === "pickup") {
    yPosition += 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("This is a pickup order. Customer will collect the items from the restaurant.", 15, yPosition);
  }
  yPosition = doc.internal.pageSize.getHeight() - 30;
  doc.setLineWidth(0.3);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 5;
  doc.setFontSize(8);
  doc.text("This is a computer-generated invoice and does not require a signature.", pageWidth / 2, yPosition, { align: "center" });
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}

// server/utils/kotGenerator.ts
import { jsPDF as jsPDF2 } from "jspdf";
import autoTable2 from "jspdf-autotable";
function generateKOTPDF(data) {
  const { order, orderItems, tableNumber, floorName, restaurantName = "Restaurant POS" } = data;
  if (!order || !orderItems || orderItems.length === 0) {
    throw new Error("Missing required data for KOT generation");
  }
  const doc = new jsPDF2();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(restaurantName, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;
  doc.setFontSize(18);
  doc.text("KITCHEN ORDER TICKET", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const orderDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || Date.now());
  doc.text(`Order ID: ${order.id.substring(0, 8)}`, 15, yPosition);
  doc.text(`Date: ${orderDate.toLocaleString()}`, pageWidth - 15, yPosition, { align: "right" });
  yPosition += 8;
  doc.setFont("helvetica", "bold");
  if (order.orderType === "dine-in" && tableNumber) {
    doc.text(`ORDER TYPE: DINE-IN`, 15, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Table: ${tableNumber}`, 15, yPosition);
    if (floorName) {
      doc.text(`Floor: ${floorName}`, 60, yPosition);
    }
  } else if (order.orderType === "delivery") {
    doc.text(`ORDER TYPE: DELIVERY`, 15, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "normal");
    if (order.customerName) {
      doc.text(`Customer: ${order.customerName}`, 15, yPosition);
    }
    if (order.customerPhone) {
      yPosition += 7;
      doc.text(`Phone: ${order.customerPhone}`, 15, yPosition);
    }
    if (order.customerAddress) {
      yPosition += 7;
      doc.text(`Address: ${order.customerAddress}`, 15, yPosition);
    }
  } else if (order.orderType === "pickup") {
    doc.text(`ORDER TYPE: PICKUP`, 15, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "normal");
    if (order.customerName) {
      doc.text(`Customer: ${order.customerName}`, 15, yPosition);
    }
    if (order.customerPhone) {
      yPosition += 7;
      doc.text(`Phone: ${order.customerPhone}`, 15, yPosition);
    }
  }
  yPosition += 12;
  const tableData = orderItems.map((item) => [
    item.name + (item.isVeg ? " \u{1F331}" : " \u{1F356}"),
    item.quantity.toString(),
    item.notes || "-"
  ]);
  autoTable2(doc, {
    startY: yPosition,
    head: [["Item", "Qty", "Notes"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [231, 76, 60],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 11
    },
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 25, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 50 }
    }
  });
  yPosition = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text(`Total Items: ${orderItems.reduce((sum, item) => sum + item.quantity, 0)}`, 15, yPosition);
  if (order.orderType === "delivery") {
    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("\u26A0\uFE0F DELIVERY ORDER - PACK CAREFULLY", 15, yPosition);
  } else if (order.orderType === "pickup") {
    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("\u26A0\uFE0F PICKUP ORDER - NOTIFY CUSTOMER WHEN READY", 15, yPosition);
  }
  yPosition = doc.internal.pageSize.getHeight() - 25;
  doc.setLineWidth(0.3);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Please prepare items as per order specifications", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 5;
  doc.setFontSize(8);
  doc.text(`Printed: ${(/* @__PURE__ */ new Date()).toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" });
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}

// server/digital-menu-sync.ts
import { ObjectId } from "mongodb";
var DigitalMenuSyncService = class {
  storage;
  syncInterval = null;
  processedOrderIds = /* @__PURE__ */ new Set();
  orderStatusMap = /* @__PURE__ */ new Map();
  orderPaymentStatusMap = /* @__PURE__ */ new Map();
  isRunning = false;
  broadcastFn = null;
  constructor(storage2) {
    this.storage = storage2;
  }
  setBroadcastFunction(fn) {
    this.broadcastFn = fn;
  }
  async start(intervalMs = 5e3) {
    if (this.isRunning) {
      console.log("\u26A0\uFE0F  Digital menu sync service is already running");
      return;
    }
    this.isRunning = true;
    console.log("\u{1F504} Starting digital menu sync service...");
    await this.loadSyncState();
    await this.syncOrders();
    this.syncInterval = setInterval(async () => {
      await this.syncOrders();
    }, intervalMs);
    console.log(`\u2705 Digital menu sync service started (polling every ${intervalMs / 1e3}s)`);
  }
  async loadSyncState() {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("digital_menu_customer_orders");
      const customerDocs = await collection.find({
        "orders": { $exists: true, $ne: [] }
      }).toArray();
      let syncedCount = 0;
      for (const customerDoc of customerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        for (const order of customerDoc.orders) {
          if (order.syncedToPOS === true) {
            const orderId = order._id?.toString() || `${customerDoc._id.toString()}_${order.orderDate}`;
            this.processedOrderIds.add(orderId);
            this.orderStatusMap.set(orderId, order.status);
            this.orderPaymentStatusMap.set(orderId, order.paymentStatus || "pending");
            syncedCount++;
          }
        }
      }
      console.log(`\u{1F4CA} Loaded ${syncedCount} synced orders from MongoDB`);
    } catch (error) {
      console.error("\u274C Error loading sync state:", error);
    }
  }
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log("\u{1F6D1} Digital menu sync service stopped");
    }
  }
  async syncOrders() {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("digital_menu_customer_orders");
      const customerDocs = await collection.find({
        "orders": { $exists: true, $ne: [] }
      }).toArray();
      let synced = 0;
      for (const customerDoc of customerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        for (const digitalOrder of customerDoc.orders) {
          if (digitalOrder.syncedToPOS === true) continue;
          if (digitalOrder.status !== "pending" && digitalOrder.status !== "confirmed") continue;
          const orderId = digitalOrder._id?.toString() || `${customerDoc._id.toString()}_${digitalOrder.orderDate}`;
          if (this.processedOrderIds.has(orderId)) continue;
          try {
            this.processedOrderIds.add(orderId);
            this.orderStatusMap.set(orderId, digitalOrder.status);
            this.orderPaymentStatusMap.set(orderId, digitalOrder.paymentStatus || "pending");
            const orderWithCustomer = {
              ...digitalOrder,
              _id: digitalOrder._id || orderId,
              customerId: customerDoc.customerId,
              customerName: customerDoc.customerName,
              customerPhone: customerDoc.customerPhone
            };
            const posOrderId = await this.convertAndCreatePOSOrder(orderWithCustomer);
            synced++;
            console.log(`\u2705 Synced digital menu order ${orderId} for ${customerDoc.customerName}`);
            await collection.updateOne(
              {
                _id: customerDoc._id,
                "orders._id": digitalOrder._id
              },
              {
                $set: {
                  "orders.$.syncedToPOS": true,
                  "orders.$.syncedAt": /* @__PURE__ */ new Date(),
                  "orders.$.posOrderId": posOrderId
                }
              }
            );
            if (this.broadcastFn) {
              this.broadcastFn("digital_menu_order_synced", {
                orderId,
                customerName: customerDoc.customerName,
                status: digitalOrder.status
              });
            }
          } catch (error) {
            console.error(`\u274C Failed to sync order ${orderId}:`, error);
            this.processedOrderIds.delete(orderId);
            this.orderStatusMap.delete(orderId);
            this.orderPaymentStatusMap.delete(orderId);
          }
        }
      }
      const syncedCustomerDocs = await collection.find({
        "orders": { $exists: true, $ne: [] }
      }).toArray();
      let updated = 0;
      for (const customerDoc of syncedCustomerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        for (const digitalOrder of customerDoc.orders) {
          if (digitalOrder.syncedToPOS !== true) continue;
          const orderId = digitalOrder._id?.toString() || `${customerDoc._id.toString()}_${digitalOrder.orderDate}`;
          const previousStatus = this.orderStatusMap.get(orderId);
          const previousPaymentStatus = this.orderPaymentStatusMap.get(orderId);
          const currentPaymentStatus = digitalOrder.paymentStatus || "pending";
          const statusChanged = previousStatus && previousStatus !== digitalOrder.status;
          const paymentStatusChanged = previousPaymentStatus && previousPaymentStatus !== currentPaymentStatus;
          const needsCheckout = (currentPaymentStatus === "invoice_generated" || currentPaymentStatus === "invoice generated") && digitalOrder.posOrderId;
          if (needsCheckout && digitalOrder.posOrderId) {
            try {
              const posOrder = await this.storage.getOrder(digitalOrder.posOrderId);
              if (posOrder && posOrder.status !== "paid" && posOrder.status !== "billed") {
                console.log(`\u{1F4B3} Order ${orderId} has invoice_generated payment status but not checked out - processing now`);
                const orderWithCustomer = {
                  ...digitalOrder,
                  customerId: customerDoc.customerId,
                  customerName: customerDoc.customerName,
                  customerPhone: customerDoc.customerPhone
                };
                await this.updatePOSOrderStatus(orderWithCustomer);
                updated++;
                continue;
              }
            } catch (error) {
              console.error(`\u274C Failed to check/process order ${orderId}:`, error);
            }
          }
          if (statusChanged || paymentStatusChanged) {
            try {
              const orderWithCustomer = {
                ...digitalOrder,
                customerId: customerDoc.customerId,
                customerName: customerDoc.customerName,
                customerPhone: customerDoc.customerPhone
              };
              await this.updatePOSOrderStatus(orderWithCustomer);
              this.orderStatusMap.set(orderId, digitalOrder.status);
              this.orderPaymentStatusMap.set(orderId, currentPaymentStatus);
              updated++;
              if (statusChanged) {
                console.log(`\u{1F504} Updated digital menu order ${orderId} status: ${previousStatus} \u2192 ${digitalOrder.status}`);
              }
              if (paymentStatusChanged) {
                console.log(`\u{1F4B3} Updated digital menu order ${orderId} paymentStatus: ${previousPaymentStatus} \u2192 ${currentPaymentStatus}`);
              }
              if (this.broadcastFn) {
                this.broadcastFn("digital_menu_order_updated", {
                  orderId,
                  customerName: customerDoc.customerName,
                  previousStatus,
                  newStatus: digitalOrder.status,
                  previousPaymentStatus,
                  newPaymentStatus: currentPaymentStatus
                });
              }
            } catch (error) {
              console.error(`\u274C Failed to update order ${orderId} status:`, error);
            }
          } else if (!previousStatus || !previousPaymentStatus) {
            this.orderStatusMap.set(orderId, digitalOrder.status);
            this.orderPaymentStatusMap.set(orderId, currentPaymentStatus);
          }
        }
      }
      if (synced > 0 || updated > 0) {
        console.log(`\u{1F4CA} Digital menu sync: ${synced} new, ${updated} updated`);
        if (this.broadcastFn) {
          this.broadcastFn("digital_menu_synced", { newOrders: synced, updatedOrders: updated });
        }
      }
      return synced + updated;
    } catch (error) {
      console.error("\u274C Error during digital menu sync:", error);
      return 0;
    }
  }
  async convertAndCreatePOSOrder(digitalOrder) {
    let tableId = null;
    if (digitalOrder.tableNumber) {
      const table = await this.findTableByNumberAndFloor(
        digitalOrder.tableNumber,
        digitalOrder.floorNumber
      );
      if (table) {
        tableId = table.id;
        if (table.status === "free") {
          await this.storage.updateTableStatus(table.id, "occupied");
          const updatedTable = await this.storage.getTable(table.id);
          if (updatedTable && this.broadcastFn) {
            this.broadcastFn("table_updated", updatedTable);
          }
        }
      } else {
        const locationInfo = digitalOrder.floorNumber ? `${digitalOrder.tableNumber} on floor ${digitalOrder.floorNumber}` : digitalOrder.tableNumber;
        console.warn(`\u26A0\uFE0F  Table ${locationInfo} not found in POS system`);
      }
    }
    const orderStatus = digitalOrder.paymentStatus === "paid" ? "billed" : "sent_to_kitchen";
    const posOrder = await this.storage.createOrder({
      tableId,
      orderType: "dine-in",
      status: orderStatus,
      total: "0",
      customerName: digitalOrder.customerName,
      customerPhone: digitalOrder.customerPhone,
      customerAddress: null,
      paymentMode: digitalOrder.paymentMethod || null,
      waiterId: null,
      deliveryPersonId: null,
      expectedPickupTime: null
    });
    if (this.broadcastFn) {
      this.broadcastFn("order_created", posOrder);
      console.log(`[WebSocket] Broadcast order_created for digital menu order ${posOrder.id}`);
    }
    if (tableId) {
      await this.storage.updateTableOrder(tableId, posOrder.id);
      const updatedTable = await this.storage.getTable(tableId);
      if (updatedTable && this.broadcastFn) {
        this.broadcastFn("table_updated", updatedTable);
      }
    }
    let calculatedSubtotal = 0;
    for (const item of digitalOrder.items || []) {
      const menuItem = await this.findMenuItemByName(item.menuItemName);
      const notes = [
        item.notes,
        item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      ].filter(Boolean).join(" | ") || null;
      const itemPrice = (item.price || 0).toFixed(2);
      calculatedSubtotal += (item.price || 0) * (item.quantity || 0);
      const createdItem = await this.storage.createOrderItem({
        orderId: posOrder.id,
        menuItemId: menuItem?.id || "unknown",
        name: item.menuItemName,
        quantity: item.quantity,
        price: itemPrice,
        notes,
        status: "new",
        isVeg: menuItem?.isVeg ?? true
      });
      if (this.broadcastFn) {
        this.broadcastFn("order_item_added", { orderId: posOrder.id, item: createdItem });
        console.log(`[WebSocket] Broadcast order_item_added for item ${createdItem.name}`);
      }
    }
    const orderTotal = (digitalOrder.total || 0).toFixed(2);
    const calculatedTotal = (calculatedSubtotal + (digitalOrder.tax || 0)).toFixed(2);
    if (Math.abs(parseFloat(orderTotal) - parseFloat(calculatedTotal)) > 0.01) {
      console.warn(`\u26A0\uFE0F  Order total mismatch for ${digitalOrder.customerName}: Digital Menu=${orderTotal}, Calculated=${calculatedTotal}`);
    }
    await this.storage.updateOrderTotal(posOrder.id, orderTotal);
    if (digitalOrder.customerPhone) {
      await this.updateCustomerTableStatus(digitalOrder.customerPhone, "occupied");
    }
    return posOrder.id;
  }
  async findTableByNumberAndFloor(tableNumber, floorNumber) {
    const tables = await this.storage.getTables();
    if (floorNumber) {
      const floors = await this.storage.getFloors();
      const floor = floors.find(
        (f) => f.name.toLowerCase() === floorNumber.toLowerCase()
      );
      if (floor) {
        const matchingTable = tables.find(
          (t) => t.tableNumber === tableNumber && t.floorId === floor.id
        );
        if (matchingTable) {
          return matchingTable;
        }
      }
      console.warn(`\u26A0\uFE0F  Floor "${floorNumber}" not found, searching all floors for table ${tableNumber}`);
    }
    const matchingTables = tables.filter((t) => t.tableNumber === tableNumber);
    if (matchingTables.length > 1) {
      console.warn(`\u26A0\uFE0F  Multiple tables with number "${tableNumber}" found on different floors. Using first match.`);
    }
    return matchingTables[0];
  }
  async updatePOSOrderStatus(digitalOrder) {
    try {
      if (!digitalOrder.posOrderId) {
        console.warn(`\u26A0\uFE0F  No POS order ID linked to digital menu order ${digitalOrder._id}`);
        return;
      }
      const posOrder = await this.storage.getOrder(digitalOrder.posOrderId);
      if (!posOrder) {
        console.warn(`\u26A0\uFE0F  POS order ${digitalOrder.posOrderId} not found`);
        return;
      }
      const paymentStatus = digitalOrder.paymentStatus || "";
      const orderStatus = digitalOrder.status || "";
      if (paymentStatus === "invoice_generated" || paymentStatus === "invoice generated" || orderStatus === "invoice_generated" || orderStatus === "invoice generated") {
        await this.autoCheckoutAndGenerateInvoice(digitalOrder, posOrder);
        return;
      }
      const statusMapping = {
        "pending": "new",
        "confirmed": "new",
        "preparing": "preparing",
        "completed": "served",
        "cancelled": "served"
        // Mark as served to remove from active
      };
      const newItemStatus = statusMapping[digitalOrder.status] || "new";
      const orderItems = await this.storage.getOrderItems(posOrder.id);
      for (const item of orderItems) {
        if (item.status !== newItemStatus) {
          await this.storage.updateOrderItemStatus(item.id, newItemStatus);
        }
      }
      console.log(`\u2705 Updated POS order ${posOrder.id} items to status: ${newItemStatus} (from digital menu status: ${digitalOrder.status})`);
    } catch (error) {
      console.error(`\u274C Failed to update POS order status:`, error);
    }
  }
  async autoCheckoutAndGenerateInvoice(digitalOrder, posOrder) {
    try {
      console.log(`\u{1F4B3} Auto-generating invoice for digital menu order ${digitalOrder._id}`);
      const orderItems = await this.storage.getOrderItems(posOrder.id);
      const subtotal = orderItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      const tax = subtotal * 0.05;
      const total = subtotal + tax;
      const paymentMode = (digitalOrder.paymentMethod || "cash").toLowerCase();
      const checkedOutOrder = await this.storage.checkoutOrder(posOrder.id, paymentMode);
      if (!checkedOutOrder) {
        console.error(`\u274C Failed to checkout order ${posOrder.id}`);
        return;
      }
      let tableInfo = null;
      if (checkedOutOrder.tableId) {
        tableInfo = await this.storage.getTable(checkedOutOrder.tableId);
        await this.storage.updateTableOrder(checkedOutOrder.tableId, null);
        await this.storage.updateTableStatus(checkedOutOrder.tableId, "free");
        const updatedTable = await this.storage.getTable(checkedOutOrder.tableId);
        if (updatedTable && this.broadcastFn) {
          this.broadcastFn("table_updated", updatedTable);
        }
      }
      if (checkedOutOrder.customerPhone) {
        await this.updateCustomerTableStatus(checkedOutOrder.customerPhone, "free");
      }
      const invoices = await this.storage.getInvoices();
      const invoiceNumber = `INV-${String(invoices.length + 1).padStart(4, "0")}`;
      const invoiceItemsData = orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        isVeg: item.isVeg,
        notes: item.notes || void 0
      }));
      const invoice = await this.storage.createInvoice({
        invoiceNumber,
        orderId: checkedOutOrder.id,
        tableNumber: tableInfo?.tableNumber || null,
        floorName: tableInfo?.floorId ? (await this.storage.getFloor(tableInfo.floorId))?.name || null : null,
        customerName: checkedOutOrder.customerName,
        customerPhone: checkedOutOrder.customerPhone,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: "0",
        total: total.toFixed(2),
        paymentMode,
        splitPayments: null,
        status: "Paid",
        items: JSON.stringify(invoiceItemsData),
        notes: null
      });
      if (this.broadcastFn) {
        this.broadcastFn("order_paid", checkedOutOrder);
        this.broadcastFn("invoice_created", invoice);
      }
      console.log(`\u2705 Auto-generated invoice ${invoiceNumber} for digital menu order ${digitalOrder._id}`);
    } catch (error) {
      console.error(`\u274C Failed to auto-generate invoice:`, error);
    }
  }
  async markOrderAsSynced(orderId, posOrderId) {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("digital_menu_customer_orders");
      const result = await collection.updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            syncedToPOS: true,
            syncedAt: /* @__PURE__ */ new Date(),
            posOrderId
          }
        }
      );
      if (result.modifiedCount === 0) {
        console.warn(`\u26A0\uFE0F  Failed to mark order ${orderId} as synced - no document matched`);
      }
    } catch (error) {
      console.error(`\u274C Failed to mark order ${orderId} as synced:`, error);
    }
  }
  async findMenuItemByName(name) {
    const menuItems = await this.storage.getMenuItems();
    return menuItems.find(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
  }
  async updateCustomerTableStatus(customerPhone, tableStatus) {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("customers");
      const result = await collection.updateOne(
        { phoneNumber: customerPhone },
        {
          $set: {
            tableStatus,
            updatedAt: /* @__PURE__ */ new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        console.log(`\u2705 Updated customer ${customerPhone} tableStatus to: ${tableStatus}`);
      }
    } catch (error) {
      console.error(`\u274C Failed to update customer tableStatus:`, error);
    }
  }
  async syncTableStatusFromPOSOrder(posOrderId) {
    try {
      const posOrder = await this.storage.getOrder(posOrderId);
      if (!posOrder || !posOrder.customerPhone) {
        return;
      }
      const orderItems = await this.storage.getOrderItems(posOrderId);
      if (orderItems.length === 0) {
        return;
      }
      const allServed = orderItems.every((item) => item.status === "served");
      const anyReady = orderItems.some((item) => item.status === "ready");
      const anyPreparing = orderItems.some((item) => item.status === "preparing");
      let tableStatus = "occupied";
      if (allServed) {
        tableStatus = "served";
      } else if (anyReady && !anyPreparing && orderItems.every((item) => item.status === "ready" || item.status === "served")) {
        tableStatus = "ready";
      } else if (anyPreparing || anyReady) {
        tableStatus = "preparing";
      }
      await this.updateCustomerTableStatus(posOrder.customerPhone, tableStatus);
    } catch (error) {
      console.error(`\u274C Failed to sync table status from POS order:`, error);
    }
  }
  async getDigitalMenuOrders() {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("digital_menu_customer_orders");
      const orders = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return orders.map((order) => ({
        ...order,
        _id: order._id.toString()
      }));
    } catch (error) {
      console.error("\u274C Error fetching digital menu orders:", error);
      return [];
    }
  }
  async getDigitalMenuCustomers() {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection("customers");
      const customers = await collection.find({ loginStatus: "loggedin" }).toArray();
      return customers.map((customer) => ({
        ...customer,
        _id: customer._id.toString()
      }));
    } catch (error) {
      console.error("\u274C Error fetching digital menu customers:", error);
      return [];
    }
  }
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      processedOrders: this.processedOrderIds.size
    };
  }
};

// server/routes.ts
var orderActionSchema = z2.object({
  print: z2.boolean().optional().default(false)
});
var checkoutSchema = z2.object({
  paymentMode: z2.string().optional(),
  print: z2.boolean().optional().default(false),
  splitPayments: z2.array(z2.object({
    person: z2.number(),
    amount: z2.number(),
    paymentMode: z2.string()
  })).optional()
});
var wss;
function broadcastUpdate(type, data) {
  if (!wss) {
    console.log("[WebSocket] No WSS instance, cannot broadcast");
    return;
  }
  const message = JSON.stringify({ type, data });
  const clientCount = Array.from(wss.clients).filter((c) => c.readyState === WebSocket.OPEN).length;
  console.log(`[WebSocket] Broadcasting ${type} to ${clientCount} clients`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
async function registerRoutes(app2) {
  app2.get("/api/floors", async (req, res) => {
    const floors = await storage.getFloors();
    res.json(floors);
  });
  app2.get("/api/floors/:id", async (req, res) => {
    const floor = await storage.getFloor(req.params.id);
    if (!floor) {
      return res.status(404).json({ error: "Floor not found" });
    }
    res.json(floor);
  });
  app2.post("/api/floors", async (req, res) => {
    const result = insertFloorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const floor = await storage.createFloor(result.data);
    broadcastUpdate("floor_created", floor);
    res.json(floor);
  });
  app2.patch("/api/floors/:id", async (req, res) => {
    const floor = await storage.updateFloor(req.params.id, req.body);
    if (!floor) {
      return res.status(404).json({ error: "Floor not found" });
    }
    broadcastUpdate("floor_updated", floor);
    res.json(floor);
  });
  app2.delete("/api/floors/:id", async (req, res) => {
    const success = await storage.deleteFloor(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Floor not found" });
    }
    broadcastUpdate("floor_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.get("/api/tables", async (req, res) => {
    const tables = await storage.getTables();
    res.json(tables);
  });
  app2.get("/api/tables/:id", async (req, res) => {
    const table = await storage.getTable(req.params.id);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    res.json(table);
  });
  app2.post("/api/tables", async (req, res) => {
    const result = insertTableSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const table = await storage.createTable(result.data);
    broadcastUpdate("table_created", table);
    res.json(table);
  });
  app2.patch("/api/tables/:id", async (req, res) => {
    const table = await storage.updateTable(req.params.id, req.body);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });
  app2.delete("/api/tables/:id", async (req, res) => {
    const success = await storage.deleteTable(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.patch("/api/tables/:id/status", async (req, res) => {
    const { status } = req.body;
    const table = await storage.updateTableStatus(req.params.id, status);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });
  app2.patch("/api/tables/:id/order", async (req, res) => {
    const { orderId } = req.body;
    const table = await storage.updateTableOrder(req.params.id, orderId);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });
  app2.get("/api/menu", async (req, res) => {
    const items = await storage.getMenuItems();
    res.json(items);
  });
  app2.get("/api/menu/categories", async (req, res) => {
    const categoriesJson = await storage.getSetting("menu_categories");
    const categories = categoriesJson ? JSON.parse(categoriesJson) : [];
    res.json({ categories });
  });
  app2.get("/api/menu/:id", async (req, res) => {
    const item = await storage.getMenuItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    res.json(item);
  });
  app2.post("/api/menu", async (req, res) => {
    const result = insertMenuItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const item = await storage.createMenuItem(result.data);
    broadcastUpdate("menu_updated", item);
    res.json(item);
  });
  app2.patch("/api/menu/:id", async (req, res) => {
    const item = await storage.updateMenuItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    broadcastUpdate("menu_updated", item);
    res.json(item);
  });
  app2.delete("/api/menu/:id", async (req, res) => {
    const success = await storage.deleteMenuItem(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    broadcastUpdate("menu_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.post("/api/menu/generate-quick-codes", async (req, res) => {
    try {
      const items = await storage.getMenuItems();
      const usedCodes = /* @__PURE__ */ new Set();
      const itemsNeedingCodes = [];
      for (const item of items) {
        if (item.quickCode) {
          usedCodes.add(item.quickCode);
        } else {
          itemsNeedingCodes.push(item);
        }
      }
      const letters = "abcdefghijklmnopqrstuvwxyz";
      let updated = 0;
      for (const item of itemsNeedingCodes) {
        let found = false;
        for (let letterIdx = 0; letterIdx < letters.length && !found; letterIdx++) {
          for (let num = 1; num <= 99 && !found; num++) {
            const code = `${letters[letterIdx]}${num}`;
            if (!usedCodes.has(code)) {
              usedCodes.add(code);
              await storage.updateMenuItem(item.id, { quickCode: code });
              updated++;
              found = true;
            }
          }
        }
      }
      res.json({ success: true, updated, message: `Generated quick codes for ${updated} menu items` });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate quick codes" });
    }
  });
  app2.post("/api/menu/seed-sample-recipes", async (req, res) => {
    try {
      const recipes = [
        {
          menuItemName: "Thai Basil Paneer (Starter)",
          ingredients: [
            { name: "Paneer", quantity: "150", unit: "g" },
            { name: "Thai Basil", quantity: "15", unit: "g" },
            { name: "Red Chili", quantity: "2", unit: "pcs" },
            { name: "Garlic", quantity: "6", unit: "cloves" },
            { name: "Cooking Oil", quantity: "30", unit: "ml" },
            { name: "Soy Sauce", quantity: "20", unit: "ml" }
          ]
        },
        {
          menuItemName: "Thai Basil Chicken (Starter)",
          ingredients: [
            { name: "Chicken Breast", quantity: "150", unit: "g" },
            { name: "Thai Basil", quantity: "15", unit: "g" },
            { name: "Red Chili", quantity: "2", unit: "pcs" },
            { name: "Garlic", quantity: "6", unit: "cloves" },
            { name: "Cooking Oil", quantity: "30", unit: "ml" },
            { name: "Soy Sauce", quantity: "20", unit: "ml" }
          ]
        },
        {
          menuItemName: "Thai Basil Prawns (Starter)",
          ingredients: [
            { name: "Prawns", quantity: "150", unit: "g" },
            { name: "Thai Basil", quantity: "15", unit: "g" },
            { name: "Red Chili", quantity: "2", unit: "pcs" },
            { name: "Garlic", quantity: "6", unit: "cloves" },
            { name: "Cooking Oil", quantity: "30", unit: "ml" },
            { name: "Soy Sauce", quantity: "20", unit: "ml" }
          ]
        },
        {
          menuItemName: "Thai Curry With Steam Rice Paneer",
          ingredients: [
            { name: "Paneer", quantity: "200", unit: "g" },
            { name: "Coconut Milk", quantity: "200", unit: "ml" },
            { name: "Lemongrass", quantity: "10", unit: "g" },
            { name: "Garlic", quantity: "8", unit: "cloves" },
            { name: "Ginger", quantity: "15", unit: "g" },
            { name: "Green Chili", quantity: "2", unit: "pcs" },
            { name: "Lime", quantity: "0.5", unit: "pcs" },
            { name: "Fish Sauce", quantity: "15", unit: "ml" },
            { name: "Cooking Oil", quantity: "40", unit: "ml" }
          ]
        },
        {
          menuItemName: "Thai Curry With Steam Rice Chicken",
          ingredients: [
            { name: "Chicken Breast", quantity: "200", unit: "g" },
            { name: "Coconut Milk", quantity: "200", unit: "ml" },
            { name: "Lemongrass", quantity: "10", unit: "g" },
            { name: "Garlic", quantity: "8", unit: "cloves" },
            { name: "Ginger", quantity: "15", unit: "g" },
            { name: "Green Chili", quantity: "2", unit: "pcs" },
            { name: "Lime", quantity: "0.5", unit: "pcs" },
            { name: "Fish Sauce", quantity: "15", unit: "ml" },
            { name: "Cooking Oil", quantity: "40", unit: "ml" }
          ]
        }
      ];
      const existingRecipes = await storage.getRecipes();
      for (const recipe of recipes) {
        const menuItem = (await storage.getMenuItems()).find((m) => m.name === recipe.menuItemName);
        if (menuItem) {
          const oldRecipe = existingRecipes.find((r) => r.menuItemId === menuItem.id);
          if (oldRecipe) {
            await storage.deleteRecipe(oldRecipe.id);
            console.log(`\u{1F5D1}\uFE0F Deleted old recipe for: ${menuItem.name}`);
          }
        }
      }
      let addedRecipes = 0;
      const inventoryItems = await storage.getInventoryItems();
      const inventoryMap = new Map(inventoryItems.map((item) => [item.name.toLowerCase(), item]));
      for (const recipe of recipes) {
        const menuItem = (await storage.getMenuItems()).find((m) => m.name === recipe.menuItemName);
        if (!menuItem) {
          console.log(`Menu item not found: ${recipe.menuItemName}`);
          continue;
        }
        const recipeData = {
          menuItemId: menuItem.id,
          name: `Recipe for ${menuItem.name}`,
          ingredients: []
        };
        for (const ing of recipe.ingredients) {
          const invItem = inventoryMap.get(ing.name.toLowerCase());
          if (invItem) {
            recipeData.ingredients.push({
              inventoryItemId: invItem.id,
              quantity: parseFloat(ing.quantity),
              unit: ing.unit
            });
          }
        }
        if (recipe.ingredients.length > 0) {
          const createdRecipe = await storage.createRecipe({ menuItemId: menuItem.id });
          console.log(`Created recipe for: ${menuItem.name} with ID: ${createdRecipe.id}`);
          let addedIngredients = 0;
          for (const ing of recipe.ingredients) {
            const invItem = inventoryMap.get(ing.name.toLowerCase());
            if (invItem) {
              try {
                await storage.createRecipeIngredient({
                  recipeId: createdRecipe.id,
                  inventoryItemId: invItem.id,
                  quantity: String(ing.quantity),
                  unit: ing.unit
                });
                addedIngredients++;
                console.log(`  \u2705 Added ingredient: ${ing.name} (ID: ${invItem.id}) - ${ing.quantity}${ing.unit}`);
              } catch (ingError) {
                console.error(`  \u274C Failed to add ingredient ${ing.name}:`, ingError);
              }
            } else {
              console.warn(`  \u26A0\uFE0F  Ingredient not found in inventory: ${ing.name}`);
            }
          }
          if (addedIngredients > 0) {
            addedRecipes++;
            console.log(`\u2705 Recipe fully populated for: ${menuItem.name} (${addedIngredients} ingredients)`);
          } else {
            console.warn(`\u26A0\uFE0F  No ingredients were added to recipe for ${menuItem.name}`);
          }
        } else {
          console.warn(`\u26A0\uFE0F  No ingredients found for recipe ${recipe.menuItemName}`);
        }
      }
      res.json({ success: true, addedRecipes, message: `Seeded ${addedRecipes} sample recipes with all ingredients` });
    } catch (error) {
      console.error("Error seeding recipes:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to seed recipes" });
    }
  });
  app2.get("/api/orders", async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });
  app2.get("/api/orders/active", async (req, res) => {
    const orders = await storage.getActiveOrders();
    res.json(orders);
  });
  app2.get("/api/orders/completed", async (req, res) => {
    const orders = await storage.getCompletedOrders();
    res.json(orders);
  });
  app2.get("/api/orders/:id/invoice/pdf", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const invoices = await storage.getInvoices();
      const invoice = invoices.find((inv) => inv.orderId === req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found for this order" });
      }
      const orderItems = await storage.getOrderItems(req.params.id);
      const pdfBuffer = generateInvoicePDF({
        invoice,
        order,
        orderItems,
        restaurantName: "Restaurant POS",
        restaurantAddress: "123 Main Street, City, State 12345",
        restaurantPhone: "+1 (555) 123-4567",
        restaurantGSTIN: "GSTIN1234567890"
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF invoice" });
    }
  });
  app2.get("/api/orders/:id/kot/pdf", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const orderItems = await storage.getOrderItems(req.params.id);
      if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ error: "No items in order" });
      }
      let tableInfo = null;
      if (order.tableId) {
        tableInfo = await storage.getTable(order.tableId);
      }
      const pdfBuffer = generateKOTPDF({
        order,
        orderItems,
        tableNumber: tableInfo?.tableNumber || void 0,
        floorName: tableInfo?.floorId ? (await storage.getFloor(tableInfo.floorId))?.name || void 0 : void 0,
        restaurantName: "Restaurant POS"
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="KOT-${order.id.substring(0, 8)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating KOT PDF:", error);
      res.status(500).json({ error: "Failed to generate KOT PDF" });
    }
  });
  app2.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  });
  app2.get("/api/orders/:id/items", async (req, res) => {
    const items = await storage.getOrderItems(req.params.id);
    res.json(items);
  });
  app2.post("/api/orders", async (req, res) => {
    const result = insertOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const order = await storage.createOrder(result.data);
    if (order.tableId) {
      await storage.updateTableOrder(order.tableId, order.id);
      await storage.updateTableStatus(order.tableId, "occupied");
    }
    broadcastUpdate("order_created", order);
    res.json(order);
  });
  app2.post("/api/orders/:id/items", async (req, res) => {
    const result = insertOrderItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    console.log("[Server] Creating order item for order:", req.params.id);
    const item = await storage.createOrderItem(result.data);
    const orderItems = await storage.getOrderItems(req.params.id);
    const total = orderItems.reduce((sum, item2) => {
      return sum + parseFloat(item2.price) * item2.quantity;
    }, 0);
    await storage.updateOrderTotal(req.params.id, total.toFixed(2));
    const order = await storage.getOrder(req.params.id);
    if (order && order.tableId) {
      const hasNew = orderItems.some((i) => i.status === "new");
      const hasPreparing = orderItems.some((i) => i.status === "preparing");
      const allReady = orderItems.every((i) => i.status === "ready" || i.status === "served");
      const allServed = orderItems.every((i) => i.status === "served");
      if (allServed) {
        await storage.updateTableStatus(order.tableId, "served");
      } else if (allReady) {
        await storage.updateTableStatus(order.tableId, "ready");
      } else if (hasPreparing) {
        await storage.updateTableStatus(order.tableId, "preparing");
      } else if (hasNew) {
        await storage.updateTableStatus(order.tableId, "occupied");
      }
      const updatedTable = await storage.getTable(order.tableId);
      if (updatedTable) {
        broadcastUpdate("table_updated", updatedTable);
      }
    }
    console.log("[Server] Broadcasting order_item_added for orderId:", req.params.id);
    broadcastUpdate("order_item_added", { orderId: req.params.id, item });
    res.json(item);
  });
  app2.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    const order = await storage.updateOrderStatus(req.params.id, status);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    broadcastUpdate("order_updated", order);
    res.json(order);
  });
  app2.post("/api/orders/:id/complete", async (req, res) => {
    const order = await storage.completeOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.tableId) {
      await storage.updateTableOrder(order.tableId, null);
      await storage.updateTableStatus(order.tableId, "free");
    }
    broadcastUpdate("order_completed", order);
    res.json(order);
  });
  app2.post("/api/orders/:id/kot", async (req, res) => {
    const result = orderActionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    console.log("[Server] Sending order to kitchen:", req.params.id);
    const order = await storage.updateOrderStatus(req.params.id, "sent_to_kitchen");
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    console.log("[Server] Broadcasting order_updated for KOT, orderId:", order.id, "status:", order.status);
    broadcastUpdate("order_updated", order);
    res.json({ order, shouldPrint: result.data.print });
  });
  app2.post("/api/orders/:id/save", async (req, res) => {
    const result = orderActionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const order = await storage.updateOrderStatus(req.params.id, "saved");
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    let invoice = null;
    if (result.data.print) {
      const orderItems = await storage.getOrderItems(req.params.id);
      const subtotal = orderItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      const tax = subtotal * 0.05;
      const total = subtotal + tax;
      let tableInfo = null;
      if (order.tableId) {
        tableInfo = await storage.getTable(order.tableId);
      }
      const invoiceCount = (await storage.getInvoices()).length;
      const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;
      const invoiceItemsData = orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        isVeg: item.isVeg,
        notes: item.notes || void 0
      }));
      invoice = await storage.createInvoice({
        invoiceNumber,
        orderId: order.id,
        tableNumber: tableInfo?.tableNumber || null,
        floorName: tableInfo?.floorId ? (await storage.getFloor(tableInfo.floorId))?.name || null : null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: "0",
        total: total.toFixed(2),
        paymentMode: order.paymentMode || "cash",
        splitPayments: null,
        status: "Saved",
        items: JSON.stringify(invoiceItemsData),
        notes: null
      });
      broadcastUpdate("invoice_created", invoice);
    }
    broadcastUpdate("order_updated", order);
    res.json({ order, invoice, shouldPrint: result.data.print });
  });
  app2.post("/api/orders/:id/bill", async (req, res) => {
    const result = orderActionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const order = await storage.billOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const orderItems = await storage.getOrderItems(req.params.id);
    const subtotal = orderItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    let tableInfo = null;
    if (order.tableId) {
      tableInfo = await storage.getTable(order.tableId);
    }
    const invoiceCount = (await storage.getInvoices()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;
    const invoiceItemsData = orderItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      isVeg: item.isVeg,
      notes: item.notes || void 0
    }));
    const invoice = await storage.createInvoice({
      invoiceNumber,
      orderId: order.id,
      tableNumber: tableInfo?.tableNumber || null,
      floorName: tableInfo?.floorId ? (await storage.getFloor(tableInfo.floorId))?.name || null : null,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: "0",
      total: total.toFixed(2),
      paymentMode: order.paymentMode || "cash",
      splitPayments: null,
      status: "Billed",
      items: JSON.stringify(invoiceItemsData),
      notes: null
    });
    broadcastUpdate("order_updated", order);
    broadcastUpdate("invoice_created", invoice);
    res.json({ order, invoice, shouldPrint: result.data.print });
  });
  app2.post("/api/orders/:id/checkout", async (req, res) => {
    const result = checkoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const orderItems = await storage.getOrderItems(req.params.id);
    const subtotal = orderItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    if (result.data.splitPayments && result.data.splitPayments.length > 0) {
      const splitSum = result.data.splitPayments.reduce((sum, split) => sum + split.amount, 0);
      const tolerance = 0.01;
      if (Math.abs(splitSum - total) > tolerance) {
        return res.status(400).json({
          error: "Split payment amounts must equal the total bill",
          splitSum,
          total
        });
      }
      for (const split of result.data.splitPayments) {
        if (split.amount <= 0) {
          return res.status(400).json({ error: "Split payment amounts must be positive" });
        }
      }
    }
    const checkedOutOrder = await storage.checkoutOrder(req.params.id, result.data.paymentMode);
    if (!checkedOutOrder) {
      return res.status(500).json({ error: "Failed to checkout order" });
    }
    let tableInfo = null;
    if (checkedOutOrder.tableId) {
      tableInfo = await storage.getTable(checkedOutOrder.tableId);
      await storage.updateTableOrder(checkedOutOrder.tableId, null);
      await storage.updateTableStatus(checkedOutOrder.tableId, "free");
    }
    if (checkedOutOrder.customerPhone) {
      await digitalMenuSync.updateCustomerTableStatus(checkedOutOrder.customerPhone, "free");
    }
    const invoiceCount = (await storage.getInvoices()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;
    const invoiceItemsData = orderItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      isVeg: item.isVeg,
      notes: item.notes || void 0
    }));
    const invoice = await storage.createInvoice({
      invoiceNumber,
      orderId: checkedOutOrder.id,
      tableNumber: tableInfo?.tableNumber || null,
      floorName: tableInfo?.floorId ? (await storage.getFloor(tableInfo.floorId))?.name || null : null,
      customerName: checkedOutOrder.customerName,
      customerPhone: checkedOutOrder.customerPhone,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: "0",
      total: total.toFixed(2),
      paymentMode: result.data.paymentMode || "cash",
      splitPayments: result.data.splitPayments ? JSON.stringify(result.data.splitPayments) : null,
      status: "Paid",
      items: JSON.stringify(invoiceItemsData),
      notes: null
    });
    try {
      await storage.deductInventoryForOrder(checkedOutOrder.id);
      broadcastUpdate("inventory_updated", { orderId: checkedOutOrder.id });
    } catch (error) {
      console.error("Error deducting inventory for order:", error);
    }
    broadcastUpdate("order_paid", checkedOutOrder);
    broadcastUpdate("invoice_created", invoice);
    res.json({ order: checkedOutOrder, invoice, shouldPrint: result.data.print });
  });
  app2.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const order = await storage.getOrder(invoice.orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const orderItems = await storage.getOrderItems(invoice.orderId);
      const pdfBuffer = generateInvoicePDF({
        invoice,
        order,
        orderItems,
        restaurantName: "Restaurant POS",
        restaurantAddress: "123 Main Street, City, State 12345",
        restaurantPhone: "+1 (555) 123-4567",
        restaurantGSTIN: "GSTIN1234567890"
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      res.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });
  app2.patch("/api/order-items/:id/status", async (req, res) => {
    const { status } = req.body;
    const item = await storage.updateOrderItemStatus(req.params.id, status);
    if (!item) {
      return res.status(404).json({ error: "Order item not found" });
    }
    const order = await storage.getOrder(item.orderId);
    if (order && order.tableId) {
      const allItems = await storage.getOrderItems(item.orderId);
      const hasNew = allItems.some((i) => i.status === "new");
      const hasPreparing = allItems.some((i) => i.status === "preparing");
      const allReady = allItems.every((i) => i.status === "ready" || i.status === "served");
      const allServed = allItems.every((i) => i.status === "served");
      let newTableStatus = null;
      if (allServed) {
        newTableStatus = "served";
        await storage.updateTableStatus(order.tableId, "served");
      } else if (allReady) {
        newTableStatus = "ready";
        await storage.updateTableStatus(order.tableId, "ready");
      } else if (hasPreparing) {
        newTableStatus = "preparing";
        await storage.updateTableStatus(order.tableId, "preparing");
      } else if (hasNew) {
        newTableStatus = "occupied";
        await storage.updateTableStatus(order.tableId, "occupied");
      }
      if (newTableStatus) {
        const updatedTable = await storage.getTable(order.tableId);
        if (updatedTable) {
          broadcastUpdate("table_updated", updatedTable);
        }
      }
    }
    if (order && order.customerPhone) {
      await digitalMenuSync.syncTableStatusFromPOSOrder(item.orderId);
    }
    broadcastUpdate("order_item_updated", item);
    res.json(item);
  });
  app2.delete("/api/order-items/:id", async (req, res) => {
    const item = await storage.getOrderItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Order item not found" });
    }
    const success = await storage.deleteOrderItem(req.params.id);
    if (!success) {
      return res.status(500).json({ error: "Failed to delete order item" });
    }
    const orderItems = await storage.getOrderItems(item.orderId);
    const total = orderItems.reduce((sum, orderItem) => {
      return sum + parseFloat(orderItem.price) * orderItem.quantity;
    }, 0);
    await storage.updateOrderTotal(item.orderId, total.toFixed(2));
    broadcastUpdate("order_item_deleted", { id: req.params.id, orderId: item.orderId });
    res.json({ success: true });
  });
  app2.get("/api/inventory", async (req, res) => {
    const items = await storage.getInventoryItems();
    res.json(items);
  });
  app2.post("/api/inventory", async (req, res) => {
    const result = insertInventoryItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const item = await storage.createInventoryItem(result.data);
    res.json(item);
  });
  app2.patch("/api/inventory/:id", async (req, res) => {
    const { quantity } = req.body;
    const item = await storage.updateInventoryQuantity(req.params.id, quantity);
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json(item);
  });
  app2.get("/api/invoices", async (req, res) => {
    const invoices = await storage.getInvoices();
    res.json(invoices);
  });
  app2.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });
  app2.get("/api/invoices/number/:invoiceNumber", async (req, res) => {
    const invoice = await storage.getInvoiceByNumber(req.params.invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });
  app2.post("/api/invoices", async (req, res) => {
    const result = insertInvoiceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const invoice = await storage.createInvoice(result.data);
    broadcastUpdate("invoice_created", invoice);
    res.json(invoice);
  });
  app2.patch("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.updateInvoice(req.params.id, req.body);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    broadcastUpdate("invoice_updated", invoice);
    res.json(invoice);
  });
  app2.delete("/api/invoices/:id", async (req, res) => {
    const success = await storage.deleteInvoice(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    broadcastUpdate("invoice_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.get("/api/reservations", async (req, res) => {
    const reservations = await storage.getReservations();
    res.json(reservations);
  });
  app2.get("/api/reservations/:id", async (req, res) => {
    const reservation = await storage.getReservation(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    res.json(reservation);
  });
  app2.get("/api/reservations/table/:tableId", async (req, res) => {
    const reservations = await storage.getReservationsByTable(req.params.tableId);
    res.json(reservations);
  });
  app2.post("/api/reservations", async (req, res) => {
    console.log("=== SERVER: CREATE RESERVATION ===");
    console.log("Received body:", req.body);
    console.log("Body type:", typeof req.body);
    console.log("Body keys:", Object.keys(req.body));
    console.log("timeSlot value:", req.body.timeSlot);
    console.log("timeSlot type:", typeof req.body.timeSlot);
    const result = insertReservationSchema.safeParse(req.body);
    console.log("Validation result:", result.success);
    if (!result.success) {
      console.error("Validation errors:", JSON.stringify(result.error, null, 2));
      return res.status(400).json({ error: result.error });
    }
    console.log("Validated data:", result.data);
    const existingReservations = await storage.getReservationsByTable(result.data.tableId);
    if (existingReservations.length > 0) {
      return res.status(409).json({ error: "This table already has an active reservation" });
    }
    const reservation = await storage.createReservation(result.data);
    console.log("Created reservation:", reservation);
    const table = await storage.getTable(reservation.tableId);
    if (table && table.status === "free") {
      const updatedTable = await storage.updateTableStatus(reservation.tableId, "reserved");
      if (updatedTable) {
        broadcastUpdate("table_updated", updatedTable);
      }
    }
    broadcastUpdate("reservation_created", reservation);
    res.json(reservation);
  });
  app2.patch("/api/reservations/:id", async (req, res) => {
    const existingReservation = await storage.getReservation(req.params.id);
    if (!existingReservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    const oldTableId = existingReservation.tableId;
    const newTableId = req.body.tableId || oldTableId;
    const tableChanged = oldTableId !== newTableId;
    if (tableChanged) {
      const newTableReservations = await storage.getReservationsByTable(newTableId);
      if (newTableReservations.length > 0) {
        return res.status(409).json({ error: "The destination table already has an active reservation" });
      }
    }
    const reservation = await storage.updateReservation(req.params.id, req.body);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    if (tableChanged) {
      const oldTableReservations = await storage.getReservationsByTable(oldTableId);
      if (oldTableReservations.length === 0) {
        const oldTable = await storage.getTable(oldTableId);
        if (oldTable && oldTable.status === "reserved" && !oldTable.currentOrderId) {
          const updatedOldTable = await storage.updateTableStatus(oldTableId, "free");
          if (updatedOldTable) {
            broadcastUpdate("table_updated", updatedOldTable);
          }
        }
      }
      const newTable = await storage.getTable(newTableId);
      if (newTable && newTable.status === "free") {
        const updatedNewTable = await storage.updateTableStatus(newTableId, "reserved");
        if (updatedNewTable) {
          broadcastUpdate("table_updated", updatedNewTable);
        }
      }
    }
    if (req.body.status === "cancelled") {
      const tableReservations = await storage.getReservationsByTable(reservation.tableId);
      if (tableReservations.length === 0) {
        const table = await storage.getTable(reservation.tableId);
        if (table && table.status === "reserved" && !table.currentOrderId) {
          const updatedTable = await storage.updateTableStatus(reservation.tableId, "free");
          if (updatedTable) {
            broadcastUpdate("table_updated", updatedTable);
          }
        }
      }
    }
    broadcastUpdate("reservation_updated", reservation);
    res.json(reservation);
  });
  app2.delete("/api/reservations/:id", async (req, res) => {
    const reservation = await storage.getReservation(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    const success = await storage.deleteReservation(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Failed to delete reservation" });
    }
    const tableReservations = await storage.getReservationsByTable(reservation.tableId);
    if (tableReservations.length === 0) {
      const table = await storage.getTable(reservation.tableId);
      if (table && table.status === "reserved" && !table.currentOrderId) {
        const updatedTable = await storage.updateTableStatus(reservation.tableId, "free");
        if (updatedTable) {
          broadcastUpdate("table_updated", updatedTable);
        }
      }
    }
    broadcastUpdate("reservation_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.post("/api/admin/clear-data", async (req, res) => {
    try {
      const { types = ["all"] } = req.body;
      const cleared = [];
      if (types.includes("orderItems") || types.includes("all")) {
        const orders = await storage.getOrders();
        for (const order of orders) {
          const orderItems = await storage.getOrderItems(order.id);
          for (const item of orderItems) {
            await storage.deleteOrderItem(item.id);
          }
        }
        cleared.push("orderItems");
      }
      if (types.includes("invoices") || types.includes("all")) {
        const invoices = await storage.getInvoices();
        for (const invoice of invoices) {
          await storage.deleteInvoice(invoice.id);
        }
        cleared.push("invoices");
      }
      if (types.includes("orders") || types.includes("all")) {
        const orders = await storage.getOrders();
        for (const order of orders) {
          await storage.deleteOrder(order.id);
        }
        cleared.push("orders");
      }
      broadcastUpdate("data_cleared", { types: cleared });
      res.json({ success: true, cleared });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });
  app2.get("/api/customers", async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });
  app2.get("/api/customers/:id/stats", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const orders = await storage.getOrders();
    const customerOrders = orders.filter((o) => o.customerPhone === customer.phone);
    const totalOrders = customerOrders.length;
    const invoices = await storage.getInvoices();
    const customerInvoices = invoices.filter((inv) => {
      const order = customerOrders.find((o) => o.id === inv.orderId);
      return !!order;
    });
    const actualTotalSpent = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);
    const lastOrder = customerOrders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    res.json({
      totalOrders,
      totalSpent: actualTotalSpent,
      lastVisit: lastOrder ? lastOrder.createdAt : customer.createdAt
    });
  });
  app2.get("/api/customers/phone/:phone", async (req, res) => {
    const customer = await storage.getCustomerByPhone(req.params.phone);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  });
  app2.get("/api/customers/:id", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  });
  app2.post("/api/customers", async (req, res) => {
    const result = insertCustomerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const existingCustomer = await storage.getCustomerByPhone(result.data.phone);
    if (existingCustomer) {
      return res.status(409).json({ error: "Customer with this phone number already exists", customer: existingCustomer });
    }
    const customer = await storage.createCustomer(result.data);
    broadcastUpdate("customer_created", customer);
    res.json(customer);
  });
  app2.patch("/api/customers/:id", async (req, res) => {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    broadcastUpdate("customer_updated", customer);
    res.json(customer);
  });
  app2.delete("/api/customers/:id", async (req, res) => {
    const success = await storage.deleteCustomer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Customer not found" });
    }
    broadcastUpdate("customer_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.get("/api/feedbacks", async (req, res) => {
    const feedbacks = await storage.getFeedbacks();
    res.json(feedbacks);
  });
  app2.get("/api/feedbacks/:id", async (req, res) => {
    const feedback = await storage.getFeedback(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json(feedback);
  });
  app2.post("/api/feedbacks", async (req, res) => {
    const result = insertFeedbackSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const feedback = await storage.createFeedback(result.data);
    broadcastUpdate("feedback_created", feedback);
    res.json(feedback);
  });
  app2.delete("/api/feedbacks/:id", async (req, res) => {
    const success = await storage.deleteFeedback(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    broadcastUpdate("feedback_deleted", { id: req.params.id });
    res.json({ success: true });
  });
  app2.get("/api/settings/mongodb-uri", async (req, res) => {
    const uri = await storage.getSetting("mongodb_uri");
    res.json({ uri: uri || null, hasUri: !!uri });
  });
  app2.post("/api/settings/mongodb-uri", async (req, res) => {
    const { uri } = req.body;
    if (!uri || typeof uri !== "string") {
      return res.status(400).json({ error: "MongoDB URI is required" });
    }
    await storage.setSetting("mongodb_uri", uri);
    res.json({ success: true });
  });
  app2.post("/api/menu/sync-from-mongodb", async (req, res) => {
    try {
      const mongoUri = await storage.getSetting("mongodb_uri");
      if (!mongoUri) {
        return res.status(400).json({ error: "MongoDB URI not configured. Please set it first." });
      }
      const { databaseName } = req.body;
      const { items, categories } = await fetchMenuItemsFromMongoDB(mongoUri, databaseName);
      const existingItems = await storage.getMenuItems();
      for (const existing of existingItems) {
        await storage.deleteMenuItem(existing.id);
      }
      const createdItems = [];
      for (const item of items) {
        const created = await storage.createMenuItem(item);
        createdItems.push(created);
      }
      await storage.setSetting("menu_categories", JSON.stringify(categories));
      broadcastUpdate("menu_synced", { count: createdItems.length });
      res.json({
        success: true,
        itemsImported: createdItems.length,
        items: createdItems
      });
    } catch (error) {
      console.error("Error syncing from MongoDB:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to sync from MongoDB"
      });
    }
  });
  app2.get("/api/inventory", async (req, res) => {
    try {
      let items = await storage.getInventoryItems();
      if (req.query.search) {
        const search = req.query.search.toString().toLowerCase();
        items = items.filter(
          (item) => item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search)
        );
      }
      if (req.query.category) {
        const category = req.query.category.toString();
        items = items.filter((item) => item.category === category);
      }
      if (req.query.sortBy) {
        const sortBy = req.query.sortBy.toString();
        if (sortBy === "name") {
          items.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === "stock") {
          items.sort((a, b) => parseFloat(a.currentStock) - parseFloat(b.currentStock));
        } else if (sortBy === "lowStock") {
          items = items.filter((item) => parseFloat(item.currentStock) <= parseFloat(item.minStock));
        }
      }
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inventory" });
    }
  });
  app2.get("/api/inventory/:id", async (req, res) => {
    try {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inventory item" });
    }
  });
  app2.post("/api/inventory", async (req, res) => {
    try {
      const result = insertInventoryItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const item = await storage.createInventoryItem(result.data);
      broadcastUpdate("inventory_created", item);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create inventory item" });
    }
  });
  app2.patch("/api/inventory/:id", async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      broadcastUpdate("inventory_updated", item);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update inventory item" });
    }
  });
  app2.delete("/api/inventory/:id", async (req, res) => {
    try {
      const success = await storage.deleteInventoryItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      broadcastUpdate("inventory_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete inventory item" });
    }
  });
  app2.get("/api/recipes/menu-item/:menuItemId", async (req, res) => {
    try {
      const recipe = await storage.getRecipeByMenuItemId(req.params.menuItemId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found for this menu item" });
      }
      const ingredients = await storage.getRecipeIngredients(recipe.id);
      const ingredientsWithDetails = await Promise.all(
        ingredients.map(async (ingredient) => {
          const inventoryItem = await storage.getInventoryItem(ingredient.inventoryItemId);
          return {
            ...ingredient,
            inventoryItem
          };
        })
      );
      res.json({
        recipe,
        ingredients: ingredientsWithDetails
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch recipe" });
    }
  });
  app2.post("/api/recipes", async (req, res) => {
    try {
      const result = insertRecipeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const recipe = await storage.createRecipe(result.data);
      broadcastUpdate("recipe_created", recipe);
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create recipe" });
    }
  });
  app2.post("/api/recipes/:recipeId/ingredients", async (req, res) => {
    try {
      const bodySchema = insertRecipeIngredientSchema.omit({ recipeId: true });
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const ingredient = await storage.createRecipeIngredient({
        ...result.data,
        recipeId: req.params.recipeId
      });
      broadcastUpdate("recipe_ingredient_added", ingredient);
      res.json(ingredient);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add recipe ingredient" });
    }
  });
  app2.patch("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
    try {
      const ingredient = await storage.updateRecipeIngredient(req.params.id, req.body);
      if (!ingredient) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      broadcastUpdate("recipe_ingredient_updated", ingredient);
      res.json(ingredient);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update recipe ingredient" });
    }
  });
  app2.delete("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
    try {
      const success = await storage.deleteRecipeIngredient(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      broadcastUpdate("recipe_ingredient_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete recipe ingredient" });
    }
  });
  app2.delete("/api/recipes/:id", async (req, res) => {
    try {
      const success = await storage.deleteRecipe(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      broadcastUpdate("recipe_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete recipe" });
    }
  });
  app2.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
    }
  });
  app2.post("/api/suppliers", async (req, res) => {
    try {
      const result = insertSupplierSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const supplier = await storage.createSupplier(result.data);
      broadcastUpdate("supplier_created", supplier);
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create supplier" });
    }
  });
  app2.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(req.params.id, req.body);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      broadcastUpdate("supplier_updated", supplier);
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update supplier" });
    }
  });
  app2.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const success = await storage.deleteSupplier(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      broadcastUpdate("supplier_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete supplier" });
    }
  });
  app2.get("/api/purchase-orders", async (req, res) => {
    try {
      const orders = await storage.getPurchaseOrders();
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getPurchaseOrderItems(order.id);
          const itemsWithDetails = await Promise.all(
            items.map(async (item) => {
              const inventoryItem = await storage.getInventoryItem(item.inventoryItemId);
              return {
                ...item,
                inventoryItem
              };
            })
          );
          const supplier = await storage.getSupplier(order.supplierId);
          return {
            ...order,
            items: itemsWithDetails,
            supplier
          };
        })
      );
      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase orders" });
    }
  });
  app2.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      const items = await storage.getPurchaseOrderItems(order.id);
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const inventoryItem = await storage.getInventoryItem(item.inventoryItemId);
          return {
            ...item,
            inventoryItem
          };
        })
      );
      const supplier = await storage.getSupplier(order.supplierId);
      res.json({
        ...order,
        items: itemsWithDetails,
        supplier
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase order" });
    }
  });
  app2.post("/api/purchase-orders", async (req, res) => {
    try {
      const result = insertPurchaseOrderSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const order = await storage.createPurchaseOrder(result.data);
      broadcastUpdate("purchase_order_created", order);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create purchase order" });
    }
  });
  app2.post("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const result = insertPurchaseOrderItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const item = await storage.createPurchaseOrderItem({
        ...result.data,
        purchaseOrderId: req.params.id
      });
      broadcastUpdate("purchase_order_item_added", item);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add purchase order item" });
    }
  });
  app2.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const order = await storage.updatePurchaseOrder(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      broadcastUpdate("purchase_order_updated", order);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update purchase order" });
    }
  });
  app2.post("/api/purchase-orders/:id/receive", async (req, res) => {
    try {
      const order = await storage.receivePurchaseOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      broadcastUpdate("purchase_order_received", order);
      broadcastUpdate("inventory_updated", { purchaseOrderId: req.params.id });
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to receive purchase order" });
    }
  });
  app2.delete("/api/purchase-orders/:id", async (req, res) => {
    try {
      const success = await storage.deletePurchaseOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      broadcastUpdate("purchase_order_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete purchase order" });
    }
  });
  app2.get("/api/wastage", async (req, res) => {
    try {
      const wastages = await storage.getWastages();
      const wastagesWithDetails = await Promise.all(
        wastages.map(async (wastage) => {
          const inventoryItem = await storage.getInventoryItem(wastage.inventoryItemId);
          return {
            ...wastage,
            inventoryItem
          };
        })
      );
      res.json(wastagesWithDetails);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch wastage records" });
    }
  });
  app2.post("/api/wastage", async (req, res) => {
    try {
      const result = insertWastageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const inventoryItem = await storage.getInventoryItem(result.data.inventoryItemId);
      if (!inventoryItem) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      const newStock = parseFloat(inventoryItem.currentStock) - parseFloat(result.data.quantity);
      if (newStock < 0) {
        return res.status(400).json({ error: "Insufficient stock for wastage entry" });
      }
      await storage.updateInventoryQuantity(result.data.inventoryItemId, newStock.toString());
      const wastage = await storage.createWastage(result.data);
      broadcastUpdate("wastage_created", wastage);
      broadcastUpdate("inventory_updated", { wastageId: wastage.id });
      res.json(wastage);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create wastage record" });
    }
  });
  app2.delete("/api/wastage/:id", async (req, res) => {
    try {
      const success = await storage.deleteWastage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Wastage record not found" });
      }
      broadcastUpdate("wastage_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete wastage record" });
    }
  });
  app2.get("/api/inventory-usage", async (req, res) => {
    try {
      const usages = await storage.getInventoryUsages();
      res.json(usages);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inventory usage" });
    }
  });
  app2.get("/api/inventory-usage/item/:itemId", async (req, res) => {
    try {
      const usages = await storage.getInventoryUsagesByItem(req.params.itemId);
      res.json(usages);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch item usage" });
    }
  });
  app2.get("/api/inventory-usage/most-used", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const mostUsed = await storage.getMostUsedItems(limit);
      res.json(mostUsed);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch most used items" });
    }
  });
  app2.post("/api/inventory-usage", async (req, res) => {
    try {
      const result = insertInventoryUsageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const usage = await storage.createInventoryUsage(result.data);
      broadcastUpdate("inventory_usage_created", usage);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create inventory usage record" });
    }
  });
  app2.post("/api/inventory/seed", async (req, res) => {
    try {
      if (typeof storage.seedInventoryAndRecipes !== "function") {
        return res.status(400).json({ error: "Seeding is only available with MongoDB storage" });
      }
      const result = await storage.seedInventoryAndRecipes();
      broadcastUpdate("inventory_seeded", result);
      res.json({
        success: true,
        message: "Inventory and recipes seeded successfully",
        ...result
      });
    } catch (error) {
      console.error("Error seeding inventory:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to seed inventory" });
    }
  });
  const digitalMenuSync = new DigitalMenuSyncService(storage);
  digitalMenuSync.setBroadcastFunction(broadcastUpdate);
  app2.post("/api/digital-menu/sync-start", async (req, res) => {
    try {
      const intervalMs = req.body.intervalMs || 5e3;
      await digitalMenuSync.start(intervalMs);
      res.json({ success: true, message: "Digital menu sync service started" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start sync service" });
    }
  });
  app2.post("/api/digital-menu/sync-stop", async (req, res) => {
    try {
      digitalMenuSync.stop();
      res.json({ success: true, message: "Digital menu sync service stopped" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to stop sync service" });
    }
  });
  app2.post("/api/digital-menu/sync-now", async (req, res) => {
    try {
      const synced = await digitalMenuSync.syncOrders();
      broadcastUpdate("digital_menu_synced", { count: synced });
      res.json({ success: true, syncedOrders: synced });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync orders" });
    }
  });
  app2.get("/api/digital-menu/status", async (req, res) => {
    try {
      const status = digitalMenuSync.getSyncStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get sync status" });
    }
  });
  app2.get("/api/digital-menu/orders", async (req, res) => {
    try {
      const orders = await digitalMenuSync.getDigitalMenuOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch digital menu orders" });
    }
  });
  app2.get("/api/digital-menu/customers", async (req, res) => {
    try {
      const customers = await digitalMenuSync.getDigitalMenuCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch digital menu customers" });
    }
  });
  digitalMenuSync.start(5e3);
  const httpServer = createServer(app2);
  wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
  wss.on("connection", (ws) => {
    ws.on("error", console.error);
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    hmr: false
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    allowedHosts: true,
    hmr: false
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
