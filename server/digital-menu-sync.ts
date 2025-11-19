import { mongodb } from './mongodb';
import { type DigitalMenuOrder, type DigitalMenuCustomer } from '@shared/schema';
import { type IStorage } from './storage';
import { ObjectId } from 'mongodb';

export class DigitalMenuSyncService {
  private storage: IStorage;
  private syncInterval: NodeJS.Timeout | null = null;
  private processedOrderIds: Set<string> = new Set();
  private orderStatusMap: Map<string, string> = new Map();
  private orderPaymentStatusMap: Map<string, string> = new Map();
  private isRunning = false;
  private broadcastFn: ((type: string, data: any) => void) | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  setBroadcastFunction(fn: (type: string, data: any) => void) {
    this.broadcastFn = fn;
  }

  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Digital menu sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting digital menu sync service...');
    
    // Load existing sync state from MongoDB
    await this.loadSyncState();
    
    await this.syncOrders();
    
    this.syncInterval = setInterval(async () => {
      await this.syncOrders();
    }, intervalMs);

    console.log(`✅ Digital menu sync service started (polling every ${intervalMs / 1000}s)`);
  }

  private async loadSyncState(): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<any>('digital_menu_customer_orders');
      
      const customerDocs = await collection.find({
        'orders': { $exists: true, $ne: [] }
      }).toArray();
      
      let syncedCount = 0;
      for (const customerDoc of customerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        
        for (const order of customerDoc.orders) {
          if (order.syncedToPOS === true) {
            const orderId = order._id?.toString() || `${customerDoc._id.toString()}_${order.orderDate}`;
            this.processedOrderIds.add(orderId);
            this.orderStatusMap.set(orderId, order.status);
            this.orderPaymentStatusMap.set(orderId, order.paymentStatus || 'pending');
            syncedCount++;
          }
        }
      }
      
      console.log(`📊 Loaded ${syncedCount} synced orders from MongoDB`);
    } catch (error) {
      console.error('❌ Error loading sync state:', error);
    }
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('🛑 Digital menu sync service stopped');
    }
  }

  async syncOrders(): Promise<number> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<any>('digital_menu_customer_orders');
      
      // Digital menu stores orders in nested structure: { customerName, orders: [...] }
      // Need to find customer documents with unsynced orders
      const customerDocs = await collection.find({
        'orders': { $exists: true, $ne: [] }
      }).toArray();

      let synced = 0;
      
      for (const customerDoc of customerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        
        for (const digitalOrder of customerDoc.orders) {
          // Skip if already synced
          if (digitalOrder.syncedToPOS === true) continue;
          
          // Only sync pending or confirmed orders
          if (digitalOrder.status !== 'pending' && digitalOrder.status !== 'confirmed') continue;
          
          const orderId = digitalOrder._id?.toString() || `${customerDoc._id.toString()}_${digitalOrder.orderDate}`;
          
          if (this.processedOrderIds.has(orderId)) continue;
          
          try {
            // CRITICAL: Add to processedOrderIds IMMEDIATELY to prevent duplicate processing in race conditions
            this.processedOrderIds.add(orderId);
            this.orderStatusMap.set(orderId, digitalOrder.status);
            this.orderPaymentStatusMap.set(orderId, digitalOrder.paymentStatus || 'pending');
            
            // Add customer info to order for processing
            const orderWithCustomer = {
              ...digitalOrder,
              _id: digitalOrder._id || orderId,
              customerId: customerDoc.customerId,
              customerName: customerDoc.customerName,
              customerPhone: customerDoc.customerPhone
            };
            
            const posOrderId = await this.convertAndCreatePOSOrder(orderWithCustomer);
            synced++;
            console.log(`✅ Synced digital menu order ${orderId} for ${customerDoc.customerName}`);
            
            // Mark this specific order as synced in the nested array and save POS order ID
            await collection.updateOne(
              { 
                _id: customerDoc._id,
                'orders._id': digitalOrder._id 
              },
              { 
                $set: { 
                  'orders.$.syncedToPOS': true,
                  'orders.$.syncedAt': new Date(),
                  'orders.$.posOrderId': posOrderId
                } 
              }
            );
            
            if (this.broadcastFn) {
              this.broadcastFn('digital_menu_order_synced', { 
                orderId, 
                customerName: customerDoc.customerName,
                status: digitalOrder.status 
              });
            }
          } catch (error) {
            console.error(`❌ Failed to sync order ${orderId}:`, error);
            // Remove from processedOrderIds so it can be retried in next sync cycle
            this.processedOrderIds.delete(orderId);
            this.orderStatusMap.delete(orderId);
            this.orderPaymentStatusMap.delete(orderId);
          }
        }
      }

      // Check for status updates in existing synced orders
      const syncedCustomerDocs = await collection.find({
        'orders': { $exists: true, $ne: [] }
      }).toArray();

      let updated = 0;
      for (const customerDoc of syncedCustomerDocs) {
        if (!customerDoc.orders || !Array.isArray(customerDoc.orders)) continue;
        
        for (const digitalOrder of customerDoc.orders) {
          if (digitalOrder.syncedToPOS !== true) continue;
          
          const orderId = digitalOrder._id?.toString() || `${customerDoc._id.toString()}_${digitalOrder.orderDate}`;
          const previousStatus = this.orderStatusMap.get(orderId);
          const previousPaymentStatus = this.orderPaymentStatusMap.get(orderId);
          const currentPaymentStatus = digitalOrder.paymentStatus || 'pending';
          
          // Check for changes in either status or paymentStatus
          const statusChanged = previousStatus && previousStatus !== digitalOrder.status;
          const paymentStatusChanged = previousPaymentStatus && previousPaymentStatus !== currentPaymentStatus;
          
          // Special case: If payment status is "invoice_generated" but order hasn't been checked out yet
          // This handles cases where the payment status changed while the service was down
          const needsCheckout = (currentPaymentStatus === 'invoice_generated' || currentPaymentStatus === 'invoice generated') && 
                                digitalOrder.posOrderId;
          
          if (needsCheckout && digitalOrder.posOrderId) {
            // Verify if the order needs checkout by checking the POS order status
            try {
              const posOrder = await this.storage.getOrder(digitalOrder.posOrderId);
              if (posOrder && posOrder.status !== 'paid' && posOrder.status !== 'billed') {
                console.log(`💳 Order ${orderId} has invoice_generated payment status but not checked out - processing now`);
                const orderWithCustomer = {
                  ...digitalOrder,
                  customerId: customerDoc.customerId,
                  customerName: customerDoc.customerName,
                  customerPhone: customerDoc.customerPhone
                };
                await this.updatePOSOrderStatus(orderWithCustomer);
                updated++;
                continue; // Skip the normal change detection logic
              }
            } catch (error) {
              console.error(`❌ Failed to check/process order ${orderId}:`, error);
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
                console.log(`🔄 Updated digital menu order ${orderId} status: ${previousStatus} → ${digitalOrder.status}`);
              }
              if (paymentStatusChanged) {
                console.log(`💳 Updated digital menu order ${orderId} paymentStatus: ${previousPaymentStatus} → ${currentPaymentStatus}`);
              }
              
              if (this.broadcastFn) {
                this.broadcastFn('digital_menu_order_updated', { 
                  orderId, 
                  customerName: customerDoc.customerName,
                  previousStatus,
                  newStatus: digitalOrder.status,
                  previousPaymentStatus,
                  newPaymentStatus: currentPaymentStatus
                });
              }
            } catch (error) {
              console.error(`❌ Failed to update order ${orderId} status:`, error);
            }
          } else if (!previousStatus || !previousPaymentStatus) {
            this.orderStatusMap.set(orderId, digitalOrder.status);
            this.orderPaymentStatusMap.set(orderId, currentPaymentStatus);
          }
        }
      }

      if (synced > 0 || updated > 0) {
        console.log(`📊 Digital menu sync: ${synced} new, ${updated} updated`);
        if (this.broadcastFn) {
          this.broadcastFn('digital_menu_synced', { newOrders: synced, updatedOrders: updated });
        }
      }

      return synced + updated;
    } catch (error) {
      console.error('❌ Error during digital menu sync:', error);
      return 0;
    }
  }

  private async convertAndCreatePOSOrder(digitalOrder: DigitalMenuOrder): Promise<string> {
    let tableId: string | null = null;

    if (digitalOrder.tableNumber) {
      const table = await this.findTableByNumberAndFloor(
        digitalOrder.tableNumber,
        digitalOrder.floorNumber
      );
      
      if (table) {
        tableId = table.id;
        
        if (table.status === 'free') {
          await this.storage.updateTableStatus(table.id, 'occupied');
          
          // Broadcast table update for real-time UI sync
          const updatedTable = await this.storage.getTable(table.id);
          if (updatedTable && this.broadcastFn) {
            this.broadcastFn('table_updated', updatedTable);
          }
        }
      } else {
        const locationInfo = digitalOrder.floorNumber 
          ? `${digitalOrder.tableNumber} on floor ${digitalOrder.floorNumber}`
          : digitalOrder.tableNumber;
        console.warn(`⚠️  Table ${locationInfo} not found in POS system`);
      }
    }

    // Map digital menu payment status to POS order status
    // Use 'sent_to_kitchen' for unpaid orders so they appear in Kitchen Display
    const orderStatus = digitalOrder.paymentStatus === 'paid' ? 'billed' : 'sent_to_kitchen';

    const posOrder = await this.storage.createOrder({
      tableId: tableId,
      orderType: 'dine-in',
      status: orderStatus,
      total: '0',
      customerName: digitalOrder.customerName,
      customerPhone: digitalOrder.customerPhone,
      customerAddress: null,
      paymentMode: digitalOrder.paymentMethod || null,
      waiterId: null,
      deliveryPersonId: null,
      expectedPickupTime: null,
    });

    // Broadcast order_created event so Kitchen Display updates in real-time
    if (this.broadcastFn) {
      this.broadcastFn('order_created', posOrder);
      console.log(`[WebSocket] Broadcast order_created for digital menu order ${posOrder.id}`);
    }

    if (tableId) {
      await this.storage.updateTableOrder(tableId, posOrder.id);
      
      // Broadcast table update with currentOrderId for real-time UI sync
      const updatedTable = await this.storage.getTable(tableId);
      if (updatedTable && this.broadcastFn) {
        this.broadcastFn('table_updated', updatedTable);
      }
    }

    let calculatedSubtotal = 0;

    for (const item of digitalOrder.items || []) {
      const menuItem = await this.findMenuItemByName(item.menuItemName);
      
      const notes = [
        item.notes,
        item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      ].filter(Boolean).join(' | ') || null;

      const itemPrice = (item.price || 0).toFixed(2);
      calculatedSubtotal += (item.price || 0) * (item.quantity || 0);

      const createdItem = await this.storage.createOrderItem({
        orderId: posOrder.id,
        menuItemId: menuItem?.id || 'unknown',
        name: item.menuItemName,
        quantity: item.quantity,
        price: itemPrice,
        notes: notes,
        status: 'new',
        isVeg: menuItem?.isVeg ?? true,
      });

      // Broadcast order_item_added event so Kitchen Display shows items in real-time
      if (this.broadcastFn) {
        this.broadcastFn('order_item_added', { orderId: posOrder.id, item: createdItem });
        console.log(`[WebSocket] Broadcast order_item_added for item ${createdItem.name}`);
      }
    }

    const orderTotal = (digitalOrder.total || 0).toFixed(2);
    const calculatedTotal = (calculatedSubtotal + (digitalOrder.tax || 0)).toFixed(2);
    
    if (Math.abs(parseFloat(orderTotal) - parseFloat(calculatedTotal)) > 0.01) {
      console.warn(`⚠️  Order total mismatch for ${digitalOrder.customerName}: Digital Menu=${orderTotal}, Calculated=${calculatedTotal}`);
    }

    await this.storage.updateOrderTotal(posOrder.id, orderTotal);

    // Update customer's initial table status to "occupied" when order is first created
    if (digitalOrder.customerPhone) {
      await this.updateCustomerTableStatus(digitalOrder.customerPhone, 'occupied');
    }

    // Return POS order ID for linking
    return posOrder.id;
  }

  private async findTableByNumberAndFloor(tableNumber: string, floorNumber?: string): Promise<any | undefined> {
    const tables = await this.storage.getTables();
    
    if (floorNumber) {
      const floors = await this.storage.getFloors();
      const floor = floors.find(f => 
        f.name.toLowerCase() === floorNumber.toLowerCase()
      );
      
      if (floor) {
        const matchingTable = tables.find(t => 
          t.tableNumber === tableNumber && t.floorId === floor.id
        );
        
        if (matchingTable) {
          return matchingTable;
        }
      }
      
      console.warn(`⚠️  Floor "${floorNumber}" not found, searching all floors for table ${tableNumber}`);
    }
    
    const matchingTables = tables.filter(t => t.tableNumber === tableNumber);
    
    if (matchingTables.length > 1) {
      console.warn(`⚠️  Multiple tables with number "${tableNumber}" found on different floors. Using first match.`);
    }
    
    return matchingTables[0];
  }

  private async updatePOSOrderStatus(digitalOrder: any): Promise<void> {
    try {
      // Get the stored POS order ID from the digital menu order
      if (!digitalOrder.posOrderId) {
        console.warn(`⚠️  No POS order ID linked to digital menu order ${digitalOrder._id}`);
        return;
      }

      // Fetch the POS order
      const posOrder = await this.storage.getOrder(digitalOrder.posOrderId);
      if (!posOrder) {
        console.warn(`⚠️  POS order ${digitalOrder.posOrderId} not found`);
        return;
      }

      // Check if paymentStatus or status is "invoice_generated" - auto-checkout and generate invoice
      const paymentStatus = digitalOrder.paymentStatus || '';
      const orderStatus = digitalOrder.status || '';
      
      if (paymentStatus === 'invoice_generated' || paymentStatus === 'invoice generated' ||
          orderStatus === 'invoice_generated' || orderStatus === 'invoice generated') {
        await this.autoCheckoutAndGenerateInvoice(digitalOrder, posOrder);
        return;
      }

      // Map digital menu status to POS order item status
      const statusMapping: Record<string, string> = {
        'pending': 'new',
        'confirmed': 'new',
        'preparing': 'preparing',
        'completed': 'served',
        'cancelled': 'served' // Mark as served to remove from active
      };

      const newItemStatus = statusMapping[digitalOrder.status] || 'new';

      // Update all order items for this order
      const orderItems = await this.storage.getOrderItems(posOrder.id);
      for (const item of orderItems) {
        if (item.status !== newItemStatus) {
          await this.storage.updateOrderItemStatus(item.id, newItemStatus as any);
        }
      }

      console.log(`✅ Updated POS order ${posOrder.id} items to status: ${newItemStatus} (from digital menu status: ${digitalOrder.status})`);
    } catch (error) {
      console.error(`❌ Failed to update POS order status:`, error);
    }
  }

  private async autoCheckoutAndGenerateInvoice(digitalOrder: any, posOrder: any): Promise<void> {
    try {
      console.log(`💳 Auto-generating invoice for digital menu order ${digitalOrder._id}`);

      // Get order items and calculate totals
      const orderItems = await this.storage.getOrderItems(posOrder.id);
      const subtotal = orderItems.reduce((sum, item) => 
        sum + parseFloat(item.price) * item.quantity, 0
      );
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      // Get payment method from digital menu order, default to cash
      const paymentMode = (digitalOrder.paymentMethod || 'cash').toLowerCase();

      // Checkout the order
      const checkedOutOrder = await this.storage.checkoutOrder(posOrder.id, paymentMode);
      if (!checkedOutOrder) {
        console.error(`❌ Failed to checkout order ${posOrder.id}`);
        return;
      }

      // Update table status to free and remove order link
      let tableInfo = null;
      if (checkedOutOrder.tableId) {
        tableInfo = await this.storage.getTable(checkedOutOrder.tableId);
        await this.storage.updateTableOrder(checkedOutOrder.tableId, null);
        await this.storage.updateTableStatus(checkedOutOrder.tableId, 'free');
        
        // Broadcast table update for real-time UI sync
        const updatedTable = await this.storage.getTable(checkedOutOrder.tableId);
        if (updatedTable && this.broadcastFn) {
          this.broadcastFn('table_updated', updatedTable);
        }
      }

      // Update customer's table status to "free" in MongoDB
      if (checkedOutOrder.customerPhone) {
        await this.updateCustomerTableStatus(checkedOutOrder.customerPhone, 'free');
      }

      // Generate invoice number
      const invoices = await this.storage.getInvoices();
      const invoiceNumber = `INV-${String(invoices.length + 1).padStart(4, '0')}`;

      // Prepare invoice items data
      const invoiceItemsData = orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        isVeg: item.isVeg,
        notes: item.notes || undefined
      }));

      // Create invoice
      const invoice = await this.storage.createInvoice({
        invoiceNumber,
        orderId: checkedOutOrder.id,
        tableNumber: tableInfo?.tableNumber || null,
        floorName: tableInfo?.floorId ? (await this.storage.getFloor(tableInfo.floorId))?.name || null : null,
        customerName: checkedOutOrder.customerName,
        customerPhone: checkedOutOrder.customerPhone,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: '0',
        total: total.toFixed(2),
        paymentMode: paymentMode,
        splitPayments: null,
        status: 'Paid',
        items: JSON.stringify(invoiceItemsData),
        notes: null,
      });

      // Broadcast updates
      if (this.broadcastFn) {
        this.broadcastFn('order_paid', checkedOutOrder);
        this.broadcastFn('invoice_created', invoice);
      }

      console.log(`✅ Auto-generated invoice ${invoiceNumber} for digital menu order ${digitalOrder._id}`);
    } catch (error) {
      console.error(`❌ Failed to auto-generate invoice:`, error);
    }
  }

  private async markOrderAsSynced(orderId: string, posOrderId: string): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection('digital_menu_customer_orders');
      
      // Convert string ID to ObjectId for proper MongoDB matching
      const result = await collection.updateOne(
        { _id: new ObjectId(orderId) },
        { 
          $set: { 
            syncedToPOS: true,
            syncedAt: new Date(),
            posOrderId: posOrderId
          } 
        }
      );

      if (result.modifiedCount === 0) {
        console.warn(`⚠️  Failed to mark order ${orderId} as synced - no document matched`);
      }
    } catch (error) {
      console.error(`❌ Failed to mark order ${orderId} as synced:`, error);
    }
  }

  private async findMenuItemByName(name: string): Promise<any | undefined> {
    const menuItems = await this.storage.getMenuItems();
    return menuItems.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    );
  }

  async updateCustomerTableStatus(customerPhone: string, tableStatus: string): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection('customers');
      
      const result = await collection.updateOne(
        { phoneNumber: customerPhone },
        { 
          $set: { 
            tableStatus: tableStatus,
            updatedAt: new Date()
          } 
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`✅ Updated customer ${customerPhone} tableStatus to: ${tableStatus}`);
      }
    } catch (error) {
      console.error(`❌ Failed to update customer tableStatus:`, error);
    }
  }

  async syncTableStatusFromPOSOrder(posOrderId: string): Promise<void> {
    try {
      // Get the POS order
      const posOrder = await this.storage.getOrder(posOrderId);
      if (!posOrder || !posOrder.customerPhone) {
        return;
      }

      // Get all order items for this order
      const orderItems = await this.storage.getOrderItems(posOrderId);
      if (orderItems.length === 0) {
        return;
      }

      // Determine the overall table status based on order item statuses
      const allServed = orderItems.every(item => item.status === 'served');
      const anyReady = orderItems.some(item => item.status === 'ready');
      const anyPreparing = orderItems.some(item => item.status === 'preparing');
      
      let tableStatus = 'occupied';
      if (allServed) {
        tableStatus = 'served';
      } else if (anyReady && !anyPreparing && orderItems.every(item => item.status === 'ready' || item.status === 'served')) {
        tableStatus = 'ready';
      } else if (anyPreparing || anyReady) {
        tableStatus = 'preparing';
      }

      // Update customer's tableStatus in MongoDB
      await this.updateCustomerTableStatus(posOrder.customerPhone, tableStatus);
    } catch (error) {
      console.error(`❌ Failed to sync table status from POS order:`, error);
    }
  }

  async getDigitalMenuOrders(): Promise<DigitalMenuOrder[]> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuOrder>('digital_menu_customer_orders');
      const orders = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return orders.map(order => ({
        ...order,
        _id: order._id.toString()
      }));
    } catch (error) {
      console.error('❌ Error fetching digital menu orders:', error);
      return [];
    }
  }

  async getDigitalMenuCustomers(): Promise<DigitalMenuCustomer[]> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuCustomer>('customers');
      const customers = await collection.find({ loginStatus: 'loggedin' }).toArray();
      return customers.map(customer => ({
        ...customer,
        _id: customer._id.toString()
      }));
    } catch (error) {
      console.error('❌ Error fetching digital menu customers:', error);
      return [];
    }
  }

  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      processedOrders: this.processedOrderIds.size,
    };
  }
}
