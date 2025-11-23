import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  insertFloorSchema,
  insertTableSchema,
  insertMenuItemSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertInventoryItemSchema,
  insertRecipeSchema,
  insertRecipeIngredientSchema,
  insertSupplierSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertWastageSchema,
  insertInvoiceSchema,
  insertReservationSchema,
  insertCustomerSchema,
  insertFeedbackSchema,
  insertInventoryUsageSchema,
} from "@shared/schema";
import { z } from "zod";
import { fetchMenuItemsFromMongoDB } from "./mongodbService";
import { generateInvoicePDF } from "./utils/invoiceGenerator";
import { generateKOTPDF } from "./utils/kotGenerator";
import { DigitalMenuSyncService } from "./digital-menu-sync";

const orderActionSchema = z.object({
  print: z.boolean().optional().default(false),
});

const checkoutSchema = z.object({
  paymentMode: z.string().optional(),
  print: z.boolean().optional().default(false),
  splitPayments: z.array(z.object({
    person: z.number(),
    amount: z.number(),
    paymentMode: z.string(),
  })).optional(),
});

let wss: WebSocketServer;

function broadcastUpdate(type: string, data: any) {
  if (!wss) {
    console.log('[WebSocket] No WSS instance, cannot broadcast');
    return;
  }
  const message = JSON.stringify({ type, data });
  const clientCount = Array.from(wss.clients).filter(c => c.readyState === WebSocket.OPEN).length;
  console.log(`[WebSocket] Broadcasting ${type} to ${clientCount} clients`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/floors", async (req, res) => {
    const floors = await storage.getFloors();
    res.json(floors);
  });

  app.get("/api/floors/:id", async (req, res) => {
    const floor = await storage.getFloor(req.params.id);
    if (!floor) {
      return res.status(404).json({ error: "Floor not found" });
    }
    res.json(floor);
  });

  app.post("/api/floors", async (req, res) => {
    const result = insertFloorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const floor = await storage.createFloor(result.data);
    broadcastUpdate("floor_created", floor);
    res.json(floor);
  });

  app.patch("/api/floors/:id", async (req, res) => {
    const floor = await storage.updateFloor(req.params.id, req.body);
    if (!floor) {
      return res.status(404).json({ error: "Floor not found" });
    }
    broadcastUpdate("floor_updated", floor);
    res.json(floor);
  });

  app.delete("/api/floors/:id", async (req, res) => {
    const success = await storage.deleteFloor(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Floor not found" });
    }
    broadcastUpdate("floor_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/tables", async (req, res) => {
    const tables = await storage.getTables();
    res.json(tables);
  });

  app.get("/api/tables/:id", async (req, res) => {
    const table = await storage.getTable(req.params.id);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    res.json(table);
  });

  app.post("/api/tables", async (req, res) => {
    const result = insertTableSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const table = await storage.createTable(result.data);
    broadcastUpdate("table_created", table);
    res.json(table);
  });

  app.patch("/api/tables/:id", async (req, res) => {
    const table = await storage.updateTable(req.params.id, req.body);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });

  app.delete("/api/tables/:id", async (req, res) => {
    const success = await storage.deleteTable(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.patch("/api/tables/:id/status", async (req, res) => {
    const { status } = req.body;
    const table = await storage.updateTableStatus(req.params.id, status);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });

  app.patch("/api/tables/:id/order", async (req, res) => {
    const { orderId } = req.body;
    const table = await storage.updateTableOrder(req.params.id, orderId);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }
    broadcastUpdate("table_updated", table);
    res.json(table);
  });

  app.get("/api/menu", async (req, res) => {
    const items = await storage.getMenuItems();
    res.json(items);
  });

  app.get("/api/menu/categories", async (req, res) => {
    const categoriesJson = await storage.getSetting("menu_categories");
    const categories = categoriesJson ? JSON.parse(categoriesJson) : [];
    res.json({ categories });
  });

  app.get("/api/menu/:id", async (req, res) => {
    const item = await storage.getMenuItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    res.json(item);
  });

  app.post("/api/menu", async (req, res) => {
    const result = insertMenuItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const item = await storage.createMenuItem(result.data);
    broadcastUpdate("menu_updated", item);
    res.json(item);
  });

  app.patch("/api/menu/:id", async (req, res) => {
    const item = await storage.updateMenuItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    broadcastUpdate("menu_updated", item);
    res.json(item);
  });

  app.delete("/api/menu/:id", async (req, res) => {
    const success = await storage.deleteMenuItem(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    broadcastUpdate("menu_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.post("/api/menu/generate-quick-codes", async (req, res) => {
    try {
      const items = await storage.getMenuItems();
      const usedCodes = new Set<string>();
      const itemsNeedingCodes: typeof items = [];

      // First pass: collect existing codes and items that need codes
      for (const item of items) {
        if (item.quickCode) {
          usedCodes.add(item.quickCode);
        } else {
          itemsNeedingCodes.push(item);
        }
      }

      // Generate unique codes for items that need them
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

  app.post("/api/menu/seed-sample-recipes", async (req, res) => {
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
            { name: "Soy Sauce", quantity: "20", unit: "ml" },
          ],
        },
        {
          menuItemName: "Thai Basil Chicken (Starter)",
          ingredients: [
            { name: "Chicken Breast", quantity: "150", unit: "g" },
            { name: "Thai Basil", quantity: "15", unit: "g" },
            { name: "Red Chili", quantity: "2", unit: "pcs" },
            { name: "Garlic", quantity: "6", unit: "cloves" },
            { name: "Cooking Oil", quantity: "30", unit: "ml" },
            { name: "Soy Sauce", quantity: "20", unit: "ml" },
          ],
        },
        {
          menuItemName: "Thai Basil Prawns (Starter)",
          ingredients: [
            { name: "Prawns", quantity: "150", unit: "g" },
            { name: "Thai Basil", quantity: "15", unit: "g" },
            { name: "Red Chili", quantity: "2", unit: "pcs" },
            { name: "Garlic", quantity: "6", unit: "cloves" },
            { name: "Cooking Oil", quantity: "30", unit: "ml" },
            { name: "Soy Sauce", quantity: "20", unit: "ml" },
          ],
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
            { name: "Cooking Oil", quantity: "40", unit: "ml" },
          ],
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
            { name: "Cooking Oil", quantity: "40", unit: "ml" },
          ],
        },
      ];

      // First, delete all existing recipes for these menu items to avoid duplicates
      const existingRecipes = await storage.getRecipes();
      for (const recipe of recipes) {
        const menuItem = (await storage.getMenuItems()).find(m => m.name === recipe.menuItemName);
        if (menuItem) {
          const oldRecipe = existingRecipes.find(r => r.menuItemId === menuItem.id);
          if (oldRecipe) {
            await storage.deleteRecipe(oldRecipe.id);
            console.log(`🗑️ Deleted old recipe for: ${menuItem.name}`);
          }
        }
      }

      let addedRecipes = 0;
      const inventoryItems = await storage.getInventoryItems();
      const inventoryMap = new Map(inventoryItems.map(item => [item.name.toLowerCase(), item]));

      for (const recipe of recipes) {
        const menuItem = (await storage.getMenuItems()).find(m => m.name === recipe.menuItemName);
        if (!menuItem) {
          console.log(`Menu item not found: ${recipe.menuItemName}`);
          continue;
        }

        const recipeData = {
          menuItemId: menuItem.id,
          name: `Recipe for ${menuItem.name}`,
          ingredients: [] as any[],
        };

        for (const ing of recipe.ingredients) {
          const invItem = inventoryMap.get(ing.name.toLowerCase());
          if (invItem) {
            recipeData.ingredients.push({
              inventoryItemId: invItem.id,
              quantity: parseFloat(ing.quantity),
              unit: ing.unit,
            });
          }
        }

        if (recipe.ingredients.length > 0) {
          const createdRecipe = await storage.createRecipe({ menuItemId: menuItem.id });
          console.log(`Created recipe for: ${menuItem.name} with ID: ${createdRecipe.id}`);
          
          let addedIngredients = 0;
          // Now add ingredients to the recipe
          for (const ing of recipe.ingredients) {
            const invItem = inventoryMap.get(ing.name.toLowerCase());
            if (invItem) {
              try {
                await storage.createRecipeIngredient({
                  recipeId: createdRecipe.id,
                  inventoryItemId: invItem.id,
                  quantity: String(ing.quantity),
                  unit: ing.unit,
                });
                addedIngredients++;
                console.log(`  ✅ Added ingredient: ${ing.name} (ID: ${invItem.id}) - ${ing.quantity}${ing.unit}`);
              } catch (ingError) {
                console.error(`  ❌ Failed to add ingredient ${ing.name}:`, ingError);
              }
            } else {
              console.warn(`  ⚠️  Ingredient not found in inventory: ${ing.name}`);
            }
          }
          
          if (addedIngredients > 0) {
            addedRecipes++;
            console.log(`✅ Recipe fully populated for: ${menuItem.name} (${addedIngredients} ingredients)`);
          } else {
            console.warn(`⚠️  No ingredients were added to recipe for ${menuItem.name}`);
          }
        } else {
          console.warn(`⚠️  No ingredients found for recipe ${recipe.menuItemName}`);
        }
      }

      res.json({ success: true, addedRecipes, message: `Seeded ${addedRecipes} sample recipes with all ingredients` });
    } catch (error) {
      console.error("Error seeding recipes:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to seed recipes" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.get("/api/orders/active", async (req, res) => {
    const orders = await storage.getActiveOrders();
    res.json(orders);
  });

  app.get("/api/orders/completed", async (req, res) => {
    const orders = await storage.getCompletedOrders();
    res.json(orders);
  });

  app.get("/api/orders/:id/invoice/pdf", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const invoices = await storage.getInvoices();
      const invoice = invoices.find(inv => inv.orderId === req.params.id);
      
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

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF invoice" });
    }
  });

  app.get("/api/orders/:id/kot/pdf", async (req, res) => {
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
        tableNumber: tableInfo?.tableNumber || undefined,
        floorName: tableInfo?.floorId ? (await storage.getFloor(tableInfo.floorId))?.name || undefined : undefined,
        restaurantName: "Restaurant POS"
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="KOT-${order.id.substring(0, 8)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating KOT PDF:", error);
      res.status(500).json({ error: "Failed to generate KOT PDF" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    const items = await storage.getOrderItems(req.params.id);
    res.json(items);
  });

  app.post("/api/orders", async (req, res) => {
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

  app.post("/api/orders/:id/items", async (req, res) => {
    const result = insertOrderItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    console.log('[Server] Creating order item for order:', req.params.id);
    const item = await storage.createOrderItem(result.data);

    const orderItems = await storage.getOrderItems(req.params.id);
    const total = orderItems.reduce((sum, item) => {
      return sum + parseFloat(item.price) * item.quantity;
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

    console.log('[Server] Broadcasting order_item_added for orderId:', req.params.id);
    broadcastUpdate("order_item_added", { orderId: req.params.id, item });
    res.json(item);
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    const order = await storage.updateOrderStatus(req.params.id, status);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    broadcastUpdate("order_updated", order);
    res.json(order);
  });

  app.post("/api/orders/:id/complete", async (req, res) => {
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

  app.post("/api/orders/:id/kot", async (req, res) => {
    const result = orderActionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    console.log('[Server] Sending order to kitchen:', req.params.id);
    const order = await storage.updateOrderStatus(req.params.id, "sent_to_kitchen");
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    console.log('[Server] Broadcasting order_updated for KOT, orderId:', order.id, 'status:', order.status);
    broadcastUpdate("order_updated", order);
    res.json({ order, shouldPrint: result.data.print });
  });

  app.post("/api/orders/:id/save", async (req, res) => {
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
      const subtotal = orderItems.reduce((sum, item) => 
        sum + parseFloat(item.price) * item.quantity, 0
      );
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      let tableInfo = null;
      if (order.tableId) {
        tableInfo = await storage.getTable(order.tableId);
      }

      const invoiceCount = (await storage.getInvoices()).length;
      const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, '0')}`;

      const invoiceItemsData = orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        isVeg: item.isVeg,
        notes: item.notes || undefined
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
        notes: null,
      });

      broadcastUpdate("invoice_created", invoice);
    }

    broadcastUpdate("order_updated", order);
    res.json({ order, invoice, shouldPrint: result.data.print });
  });

  app.post("/api/orders/:id/bill", async (req, res) => {
    const result = orderActionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const order = await storage.billOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderItems = await storage.getOrderItems(req.params.id);
    
    const subtotal = orderItems.reduce((sum, item) => 
      sum + parseFloat(item.price) * item.quantity, 0
    );
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    let tableInfo = null;
    if (order.tableId) {
      tableInfo = await storage.getTable(order.tableId);
    }

    const invoiceCount = (await storage.getInvoices()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, '0')}`;

    const invoiceItemsData = orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      isVeg: item.isVeg,
      notes: item.notes || undefined
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
      notes: null,
    });

    broadcastUpdate("order_updated", order);
    broadcastUpdate("invoice_created", invoice);
    res.json({ order, invoice, shouldPrint: result.data.print });
  });

  app.post("/api/orders/:id/checkout", async (req, res) => {
    const result = checkoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderItems = await storage.getOrderItems(req.params.id);
    
    const subtotal = orderItems.reduce((sum, item) => 
      sum + parseFloat(item.price) * item.quantity, 0
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

    // Update customer's table status to "free" for digital menu orders
    if (checkedOutOrder.customerPhone) {
      await digitalMenuSync.updateCustomerTableStatus(checkedOutOrder.customerPhone, 'free');
    }

    const invoiceCount = (await storage.getInvoices()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, '0')}`;

    const invoiceItemsData = orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      isVeg: item.isVeg,
      notes: item.notes || undefined
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
      notes: null,
    });

    // Auto-deduct inventory for order
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

  app.get("/api/invoices/:id/pdf", async (req, res) => {
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
        restaurantGSTIN: "GSTIN1234567890",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      res.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });

  app.patch("/api/order-items/:id/status", async (req, res) => {
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

    // Sync table status to digital menu customer if this is a digital menu order
    if (order && order.customerPhone) {
      await digitalMenuSync.syncTableStatusFromPOSOrder(item.orderId);
    }

    broadcastUpdate("order_item_updated", item);
    res.json(item);
  });

  app.delete("/api/order-items/:id", async (req, res) => {
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

  app.get("/api/inventory", async (req, res) => {
    const items = await storage.getInventoryItems();
    res.json(items);
  });

  app.post("/api/inventory", async (req, res) => {
    const result = insertInventoryItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const item = await storage.createInventoryItem(result.data);
    res.json(item);
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    const { quantity } = req.body;
    const item = await storage.updateInventoryQuantity(req.params.id, quantity);
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json(item);
  });

  app.get("/api/invoices", async (req, res) => {
    const invoices = await storage.getInvoices();
    res.json(invoices);
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.get("/api/invoices/number/:invoiceNumber", async (req, res) => {
    const invoice = await storage.getInvoiceByNumber(req.params.invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.post("/api/invoices", async (req, res) => {
    const result = insertInvoiceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const invoice = await storage.createInvoice(result.data);
    broadcastUpdate("invoice_created", invoice);
    res.json(invoice);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.updateInvoice(req.params.id, req.body);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    broadcastUpdate("invoice_updated", invoice);
    res.json(invoice);
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    const success = await storage.deleteInvoice(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    broadcastUpdate("invoice_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/reservations", async (req, res) => {
    const reservations = await storage.getReservations();
    res.json(reservations);
  });

  app.get("/api/reservations/:id", async (req, res) => {
    const reservation = await storage.getReservation(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    res.json(reservation);
  });

  app.get("/api/reservations/table/:tableId", async (req, res) => {
    const reservations = await storage.getReservationsByTable(req.params.tableId);
    res.json(reservations);
  });

  app.post("/api/reservations", async (req, res) => {
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

  app.patch("/api/reservations/:id", async (req, res) => {
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

  app.delete("/api/reservations/:id", async (req, res) => {
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

  app.post("/api/admin/clear-data", async (req, res) => {
    try {
      const { types = ['all'] } = req.body;
      const cleared: string[] = [];

      if (types.includes('orderItems') || types.includes('all')) {
        const orders = await storage.getOrders();
        for (const order of orders) {
          const orderItems = await storage.getOrderItems(order.id);
          for (const item of orderItems) {
            await storage.deleteOrderItem(item.id);
          }
        }
        cleared.push('orderItems');
      }

      if (types.includes('invoices') || types.includes('all')) {
        const invoices = await storage.getInvoices();
        for (const invoice of invoices) {
          await storage.deleteInvoice(invoice.id);
        }
        cleared.push('invoices');
      }

      if (types.includes('orders') || types.includes('all')) {
        const orders = await storage.getOrders();
        for (const order of orders) {
          await storage.deleteOrder(order.id);
        }
        cleared.push('orders');
      }

      broadcastUpdate("data_cleared", { types: cleared });
      res.json({ success: true, cleared });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.get("/api/customers/:id/stats", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const orders = await storage.getOrders();
    const customerOrders = orders.filter(o => o.customerPhone === customer.phone);
    const totalOrders = customerOrders.length;

    const invoices = await storage.getInvoices();
    const customerInvoices = invoices.filter(inv => {
      const order = customerOrders.find(o => o.id === inv.orderId);
      return !!order;
    });
    const actualTotalSpent = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

    const lastOrder = customerOrders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    res.json({
      totalOrders,
      totalSpent: actualTotalSpent,
      lastVisit: lastOrder ? lastOrder.createdAt : customer.createdAt,
    });
  });

  app.get("/api/customers/phone/:phone", async (req, res) => {
    const customer = await storage.getCustomerByPhone(req.params.phone);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  });

  app.get("/api/customers/:id", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  });

  app.post("/api/customers", async (req, res) => {
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

  app.patch("/api/customers/:id", async (req, res) => {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    broadcastUpdate("customer_updated", customer);
    res.json(customer);
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const success = await storage.deleteCustomer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Customer not found" });
    }
    broadcastUpdate("customer_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/feedbacks", async (req, res) => {
    const feedbacks = await storage.getFeedbacks();
    res.json(feedbacks);
  });

  app.get("/api/feedbacks/:id", async (req, res) => {
    const feedback = await storage.getFeedback(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json(feedback);
  });

  app.post("/api/feedbacks", async (req, res) => {
    const result = insertFeedbackSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const feedback = await storage.createFeedback(result.data);
    broadcastUpdate("feedback_created", feedback);
    res.json(feedback);
  });

  app.delete("/api/feedbacks/:id", async (req, res) => {
    const success = await storage.deleteFeedback(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    broadcastUpdate("feedback_deleted", { id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/settings/mongodb-uri", async (req, res) => {
    const uri = await storage.getSetting("mongodb_uri");
    res.json({ uri: uri || null, hasUri: !!uri });
  });

  app.post("/api/settings/mongodb-uri", async (req, res) => {
    const { uri } = req.body;
    if (!uri || typeof uri !== "string") {
      return res.status(400).json({ error: "MongoDB URI is required" });
    }
    await storage.setSetting("mongodb_uri", uri);
    res.json({ success: true });
  });

  app.post("/api/menu/sync-from-mongodb", async (req, res) => {
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

  // ==================== INVENTORY MANAGEMENT API ROUTES ====================

  // Inventory Items
  app.get("/api/inventory", async (req, res) => {
    try {
      let items = await storage.getInventoryItems();
      
      // Apply search filter
      if (req.query.search) {
        const search = req.query.search.toString().toLowerCase();
        items = items.filter(item => 
          item.name.toLowerCase().includes(search) ||
          item.category.toLowerCase().includes(search)
        );
      }
      
      // Apply category filter
      if (req.query.category) {
        const category = req.query.category.toString();
        items = items.filter(item => item.category === category);
      }
      
      // Apply sorting
      if (req.query.sortBy) {
        const sortBy = req.query.sortBy.toString();
        if (sortBy === 'name') {
          items.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'stock') {
          items.sort((a, b) => parseFloat(a.currentStock) - parseFloat(b.currentStock));
        } else if (sortBy === 'lowStock') {
          items = items.filter(item => parseFloat(item.currentStock) <= parseFloat(item.minStock));
        }
      }
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inventory" });
    }
  });

  app.get("/api/inventory/:id", async (req, res) => {
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

  app.post("/api/inventory", async (req, res) => {
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

  app.patch("/api/inventory/:id", async (req, res) => {
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

  app.delete("/api/inventory/:id", async (req, res) => {
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

  // Recipes & Ingredients
  app.get("/api/recipes/menu-item/:menuItemId", async (req, res) => {
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
            inventoryItem,
          };
        })
      );
      
      res.json({
        recipe,
        ingredients: ingredientsWithDetails,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
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

  app.post("/api/recipes/:recipeId/ingredients", async (req, res) => {
    try {
      const bodySchema = insertRecipeIngredientSchema.omit({ recipeId: true });
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const ingredient = await storage.createRecipeIngredient({
        ...result.data,
        recipeId: req.params.recipeId,
      });
      broadcastUpdate("recipe_ingredient_added", ingredient);
      res.json(ingredient);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add recipe ingredient" });
    }
  });

  app.patch("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
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

  app.delete("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
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

  app.delete("/api/recipes/:id", async (req, res) => {
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

  // Suppliers
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
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

  app.patch("/api/suppliers/:id", async (req, res) => {
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

  app.delete("/api/suppliers/:id", async (req, res) => {
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

  // Purchase Orders
  app.get("/api/purchase-orders", async (req, res) => {
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
                inventoryItem,
              };
            })
          );
          const supplier = await storage.getSupplier(order.supplierId);
          return {
            ...order,
            items: itemsWithDetails,
            supplier,
          };
        })
      );
      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
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
            inventoryItem,
          };
        })
      );
      const supplier = await storage.getSupplier(order.supplierId);
      
      res.json({
        ...order,
        items: itemsWithDetails,
        supplier,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
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

  app.post("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const result = insertPurchaseOrderItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      const item = await storage.createPurchaseOrderItem({
        ...result.data,
        purchaseOrderId: req.params.id,
      });
      broadcastUpdate("purchase_order_item_added", item);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add purchase order item" });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
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

  app.post("/api/purchase-orders/:id/receive", async (req, res) => {
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

  app.delete("/api/purchase-orders/:id", async (req, res) => {
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

  // Wastage
  app.get("/api/wastage", async (req, res) => {
    try {
      const wastages = await storage.getWastages();
      const wastagesWithDetails = await Promise.all(
        wastages.map(async (wastage) => {
          const inventoryItem = await storage.getInventoryItem(wastage.inventoryItemId);
          return {
            ...wastage,
            inventoryItem,
          };
        })
      );
      res.json(wastagesWithDetails);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch wastage records" });
    }
  });

  app.post("/api/wastage", async (req, res) => {
    try {
      const result = insertWastageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      // Auto-deduct from inventory
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

  app.delete("/api/wastage/:id", async (req, res) => {
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

  // Inventory Usage Tracking
  app.get("/api/inventory-usage", async (req, res) => {
    try {
      const usages = await storage.getInventoryUsages();
      res.json(usages);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inventory usage" });
    }
  });

  app.get("/api/inventory-usage/item/:itemId", async (req, res) => {
    try {
      const usages = await storage.getInventoryUsagesByItem(req.params.itemId);
      res.json(usages);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch item usage" });
    }
  });

  app.get("/api/inventory-usage/most-used", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const mostUsed = await storage.getMostUsedItems(limit);
      res.json(mostUsed);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch most used items" });
    }
  });

  app.post("/api/inventory-usage", async (req, res) => {
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

  // Seed Inventory and Recipes (admin endpoint)
  app.post("/api/inventory/seed", async (req, res) => {
    try {
      if (typeof storage.seedInventoryAndRecipes !== 'function') {
        return res.status(400).json({ error: "Seeding is only available with MongoDB storage" });
      }
      
      const result = await storage.seedInventoryAndRecipes();
      broadcastUpdate("inventory_seeded", result);
      res.json({
        success: true,
        message: "Inventory and recipes seeded successfully",
        ...result,
      });
    } catch (error) {
      console.error("Error seeding inventory:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to seed inventory" });
    }
  });

  // ==================== END INVENTORY MANAGEMENT API ROUTES ====================

  const digitalMenuSync = new DigitalMenuSyncService(storage);
  digitalMenuSync.setBroadcastFunction(broadcastUpdate);
  
  app.post("/api/digital-menu/sync-start", async (req, res) => {
    try {
      const intervalMs = req.body.intervalMs || 5000;
      await digitalMenuSync.start(intervalMs);
      res.json({ success: true, message: "Digital menu sync service started" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start sync service" });
    }
  });

  app.post("/api/digital-menu/sync-stop", async (req, res) => {
    try {
      digitalMenuSync.stop();
      res.json({ success: true, message: "Digital menu sync service stopped" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to stop sync service" });
    }
  });

  app.post("/api/digital-menu/sync-now", async (req, res) => {
    try {
      const synced = await digitalMenuSync.syncOrders();
      broadcastUpdate("digital_menu_synced", { count: synced });
      res.json({ success: true, syncedOrders: synced });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync orders" });
    }
  });

  app.get("/api/digital-menu/status", async (req, res) => {
    try {
      const status = digitalMenuSync.getSyncStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get sync status" });
    }
  });

  app.get("/api/digital-menu/orders", async (req, res) => {
    try {
      const orders = await digitalMenuSync.getDigitalMenuOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch digital menu orders" });
    }
  });

  app.get("/api/digital-menu/customers", async (req, res) => {
    try {
      const customers = await digitalMenuSync.getDigitalMenuCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch digital menu customers" });
    }
  });

  digitalMenuSync.start(5000);

  const httpServer = createServer(app);

  wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });

  wss.on("connection", (ws) => {
    ws.on("error", console.error);
  });

  return httpServer;
}
