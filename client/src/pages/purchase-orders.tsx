import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, CheckCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PurchaseOrder, Supplier, InventoryItem, PurchaseOrderItem } from "@shared/schema";

const poFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

const poItemFormSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  quantity: z.string().min(1, "Quantity is required"),
  costPerUnit: z.string().min(1, "Cost per unit is required"),
});

type POFormData = z.infer<typeof poFormSchema>;
type POItemFormData = z.infer<typeof poItemFormSchema>;

interface ExtendedPurchaseOrder extends PurchaseOrder {
  supplier?: Supplier;
  items?: (PurchaseOrderItem & { inventoryItem?: InventoryItem })[];
}

export default function PurchaseOrdersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [currentPO, setCurrentPO] = useState<ExtendedPurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<ExtendedPurchaseOrder | null>(null);
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<ExtendedPurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // WebSocket integration
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'purchase_order_updated' || data.type === 'purchase_order_created' || data.type === 'purchase_order_deleted') {
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      }
    };
    
    return () => ws.close();
  }, []);

  const poForm = useForm<POFormData>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      supplierId: "",
      orderDate: format(new Date(), "yyyy-MM-dd"),
      expectedDeliveryDate: "",
      notes: "",
    },
  });

  const itemForm = useForm<POItemFormData>({
    resolver: zodResolver(poItemFormSchema),
    defaultValues: {
      inventoryItemId: "",
      quantity: "",
      costPerUnit: "",
    },
  });

  const createPOMutation = useMutation({
    mutationFn: async (data: POFormData) => {
      const orderCount = orders.length;
      const orderNumber = `PO-${String(orderCount + 1).padStart(4, '0')}`;
      const res = await apiRequest("POST", "/api/purchase-orders", {
        ...data,
        orderNumber,
      });
      return await res.json();
    },
    onSuccess: (newPO) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setCurrentPO(newPO);
      setIsCreateDialogOpen(false);
      setIsAddItemDialogOpen(true);
      toast({
        title: "Success",
        description: "Purchase order created. Now add items.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: POItemFormData) => {
      if (!currentPO) return;
      const inventoryItem = inventoryItems.find(i => i.id === data.inventoryItemId);
      if (!inventoryItem) throw new Error("Inventory item not found");

      const quantity = parseFloat(data.quantity);
      const costPerUnit = parseFloat(data.costPerUnit);
      const totalCost = quantity * costPerUnit;

      const res = await apiRequest("POST", `/api/purchase-orders/${currentPO.id}/items`, {
        inventoryItemId: data.inventoryItemId,
        quantity: data.quantity,
        unit: inventoryItem.unit,
        costPerUnit: data.costPerUnit,
        totalCost: totalCost.toString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item added to purchase order",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const receivePOMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/purchase-orders/${id}/receive`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Success",
        description: "Purchase order received and inventory updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to receive purchase order",
        variant: "destructive",
      });
    },
  });

  const deletePOMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/purchase-orders/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Success",
        description: "Purchase order deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete purchase order",
        variant: "destructive",
      });
    },
  });

  const onCreatePO = (data: POFormData) => {
    createPOMutation.mutate(data);
  };

  const onAddItem = (data: POItemFormData) => {
    addItemMutation.mutate(data);
  };

  const handleViewPO = async (po: ExtendedPurchaseOrder) => {
    const res = await fetch(`/api/purchase-orders/${po.id}`);
    const data = await res.json();
    setViewingPO(data);
    setIsViewDialogOpen(true);
  };

  const handleReceivePO = (id: string) => {
    if (confirm("Mark this purchase order as received and update inventory?")) {
      receivePOMutation.mutate(id);
    }
  };

  const handleDeletePO = (id: string) => {
    if (confirm("Are you sure you want to delete this purchase order?")) {
      deletePOMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Pending</Badge>;
      case "received":
        return <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Received</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="Purchase Orders" />

      <div className="p-6 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Purchase Orders:</span>
            <span className="font-semibold" data-testid="text-total-pos">{orders.length}</span>
          </div>
          <Button
            onClick={() => {
              poForm.reset();
              setIsCreateDialogOpen(true);
            }}
            data-testid="button-create-po"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Purchase Order
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No purchase orders found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => {
                const supplier = suppliers.find(s => s.id === po.supplierId);
                
                return (
                  <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                    <TableCell className="font-medium">{po.orderNumber}</TableCell>
                    <TableCell>{supplier?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(po.orderDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell className="text-right font-semibold">₹{parseFloat(po.totalAmount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPO(po)}
                          data-testid={`button-view-${po.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status !== "received" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReceivePO(po.id)}
                            data-testid={`button-receive-${po.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePO(po.id)}
                          data-testid={`button-delete-${po.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <Form {...poForm}>
            <form onSubmit={poForm.handleSubmit(onCreatePO)} className="space-y-4">
              <FormField
                control={poForm.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-supplier">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={poForm.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-order-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={poForm.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-delivery-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={poForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPOMutation.isPending}
                  data-testid="button-submit"
                >
                  {createPOMutation.isPending ? "Creating..." : "Create & Add Items"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Items to PO {currentPO?.orderNumber}</DialogTitle>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onAddItem)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory Item</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-inventory-item">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventoryItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="costPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost/Unit</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-cost-per-unit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddItemDialogOpen(false);
                    setCurrentPO(null);
                    itemForm.reset();
                  }}
                  data-testid="button-done"
                >
                  Done
                </Button>
                <Button
                  type="submit"
                  disabled={addItemMutation.isPending}
                  data-testid="button-add-item"
                >
                  {addItemMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>
          {viewingPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">PO Number</div>
                  <div className="font-semibold">{viewingPO.orderNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-semibold">{viewingPO.supplier?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Order Date</div>
                  <div>{format(new Date(viewingPO.orderDate), "MMM dd, yyyy")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div>{getStatusBadge(viewingPO.status)}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Items</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Cost/Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPO.items?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.inventoryItem?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right">₹{item.costPerUnit}</TableCell>
                        <TableCell className="text-right">₹{item.totalCost}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">Total Amount</div>
                <div className="text-xl font-bold">₹{parseFloat(viewingPO.totalAmount).toLocaleString()}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
