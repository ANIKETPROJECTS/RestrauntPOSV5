import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Wastage, InventoryItem } from "@shared/schema";

const wastageFormSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  quantity: z.string().min(1, "Quantity is required"),
  reason: z.string().min(1, "Reason is required"),
  reportedBy: z.string().optional(),
  notes: z.string().optional(),
});

type WastageFormData = z.infer<typeof wastageFormSchema>;

interface ExtendedWastage extends Wastage {
  inventoryItem?: InventoryItem;
}

export default function WastagePage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: wastages = [], isLoading } = useQuery<ExtendedWastage[]>({
    queryKey: ["/api/wastage"],
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
      if (data.type === 'wastage_created' || data.type === 'wastage_deleted') {
        queryClient.invalidateQueries({ queryKey: ["/api/wastage"] });
      }
      if (data.type === 'inventory_updated') {
        queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      }
    };
    
    return () => ws.close();
  }, []);

  const form = useForm<WastageFormData>({
    resolver: zodResolver(wastageFormSchema),
    defaultValues: {
      inventoryItemId: "",
      quantity: "",
      reason: "",
      reportedBy: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WastageFormData) => {
      const res = await apiRequest("POST", "/api/wastage", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wastage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Wastage recorded and inventory updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record wastage",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/wastage/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wastage"] });
      toast({
        title: "Success",
        description: "Wastage record deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete wastage record",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WastageFormData) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this wastage record?")) {
      deleteMutation.mutate(id);
    }
  };

  // Watch for inventory item selection to auto-fill unit
  const selectedItemId = form.watch("inventoryItemId");
  const selectedItem = inventoryItems.find(item => item.id === selectedItemId);

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="Wastage Tracking" />

      <div className="p-6 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Wastage Records:</span>
            <span className="font-semibold" data-testid="text-total-wastages">{wastages.length}</span>
          </div>
          <Button
            onClick={() => {
              form.reset();
              setIsAddDialogOpen(true);
            }}
            data-testid="button-add-wastage"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Wastage
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : wastages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No wastage records found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wastages.map((wastage) => (
                <TableRow key={wastage.id} data-testid={`row-wastage-${wastage.id}`}>
                  <TableCell>{format(new Date(wastage.createdAt), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="font-medium">{wastage.inventoryItem?.name || "-"}</TableCell>
                  <TableCell className="text-right">{wastage.quantity}</TableCell>
                  <TableCell>{wastage.unit}</TableCell>
                  <TableCell>{wastage.reason}</TableCell>
                  <TableCell>{wastage.reportedBy || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(wastage.id)}
                      data-testid={`button-delete-${wastage.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Wastage Record</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                            {item.name} ({item.currentStock} {item.unit} available)
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
                  control={form.control}
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

                <div>
                  <FormLabel>Unit</FormLabel>
                  <Input
                    value={selectedItem?.unit || "-"}
                    disabled
                    className="bg-muted"
                    data-testid="input-unit"
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Expired, spoiled, damaged, etc."
                        rows={3}
                        data-testid="input-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reported By (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Staff name" data-testid="input-reported-by" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional notes"
                        rows={2}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Recording..." : "Record Wastage"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
