import { useState, useEffect } from "react";
import { Search, Send, Users, User, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import CategorySidebar from "@/components/CategorySidebar";
import MenuItemCard from "@/components/MenuItemCard";
import OrderCart from "@/components/OrderCart";
import CustomerSelectionDialog from "@/components/CustomerSelectionDialog";
import PrintableInvoice from "@/components/PrintableInvoice";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuItem, Customer, Invoice, Order, OrderItem as SchemaOrderItem } from "@shared/schema";

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  isFromDatabase?: boolean;
  isVeg?: boolean;
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [serviceType, setServiceType] = useState<"dine-in" | "delivery" | "pickup">("dine-in");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showSplitBillDialog, setShowSplitBillDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi">("cash");
  const [splitCount, setSplitCount] = useState<number>(2);
  const [splitAmounts, setSplitAmounts] = useState<number[]>([]);
  const [splitPaymentModes, setSplitPaymentModes] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [currentTableId, setCurrentTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<string>("");
  const [floorName, setFloorName] = useState<string>("");
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [pendingKotAction, setPendingKotAction] = useState<"none" | "kot" | "kot-print">("none");
  const [printableInvoice, setPrintableInvoice] = useState<Invoice | null>(null);
  const [printableOrder, setPrintableOrder] = useState<Order | null>(null);
  const [printableOrderItems, setPrintableOrderItems] = useState<SchemaOrderItem[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [selectedTableFromDropdown, setSelectedTableFromDropdown] = useState<string>("");
  const [showMobileCart, setShowMobileCart] = useState(false);
  const { toast} = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("tableId");
    const tableNum = params.get("tableNumber");
    const floor = params.get("floorName");
    const orderId = params.get("orderId");
    const type = params.get("type") as "dine-in" | "delivery" | "pickup" | null;
    
    if (tableId && tableNum) {
      setCurrentTableId(tableId);
      setTableNumber(tableNum);
      setFloorName(floor || "");
      setServiceType(type || "dine-in");
    } else if (type === "delivery") {
      setServiceType("delivery");
    } else if (type === "pickup") {
      setServiceType("pickup");
    }

    if (orderId) {
      setCurrentOrderId(orderId);
      fetchExistingOrder(orderId);
    }
  }, []);

  const fetchExistingOrder = async (orderId: string) => {
    try {
      const itemsRes = await fetch(`/api/orders/${orderId}/items`);
      const items = await itemsRes.json();
      
      const formattedItems = items.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        notes: item.notes || undefined,
        isFromDatabase: true,
        isVeg: item.isVeg,
      }));
      
      setOrderItems(formattedItems);
    } catch (error) {
      console.error("Failed to fetch existing order:", error);
      toast({
        title: "Error",
        description: "Failed to load existing order",
        variant: "destructive",
      });
    }
  };

  const { data: menuItems = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu"],
  });

  const { data: categoriesData } = useQuery<{ categories: string[] }>({
    queryKey: ["/api/menu/categories"],
  });

  const { data: floors = [] } = useQuery<any[]>({
    queryKey: ["/api/floors"],
  });

  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["/api/tables"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: { 
      tableId: string | null; 
      orderType: string;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
    }) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return await res.json();
    },
    onSuccess: (order: any) => {
      setCurrentOrderId(order.id);
    },
  });

  const addOrderItemMutation = useMutation({
    mutationFn: async (data: { orderId: string; item: any }) => {
      const res = await apiRequest("POST", `/api/orders/${data.orderId}/items`, data.item);
      return await res.json();
    },
  });

  const downloadKOTPDF = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/kot/pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate KOT PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `KOT-${orderId.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "KOT PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download KOT PDF",
        variant: "destructive",
      });
    }
  };

  const kotMutation = useMutation({
    mutationFn: async ({ orderId, print }: { orderId: string; print: boolean }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/kot`, { print });
      const kotData = await res.json();
      
      if (print) {
        await downloadKOTPDF(orderId);
      }
      
      return kotData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ orderId, print }: { orderId: string; print: boolean }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/save`, { print });
      const saveData = await res.json();
      
      if (print && saveData.invoice) {
        await downloadPDF(orderId, saveData.invoice.invoiceNumber);
      }
      
      return saveData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const downloadPDF = async (orderId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/invoice/pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download invoice PDF",
        variant: "destructive",
      });
    }
  };

  const billMutation = useMutation({
    mutationFn: async ({ orderId, print }: { orderId: string; print: boolean }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/bill`, { print });
      const billData = await res.json();
      
      if (print && billData.invoice) {
        await downloadPDF(orderId, billData.invoice.invoiceNumber);
      }
      
      return billData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ orderId, paymentMode, splitPayments, print }: { 
      orderId: string; 
      paymentMode: string; 
      splitPayments?: Array<{ person: number; amount: number; paymentMode: string }>; 
      print: boolean 
    }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/checkout`, { paymentMode, splitPayments, print });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/complete`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
    },
  });

  const fetchedCategories = categoriesData?.categories || [];
  const defaultCategories = ["Burgers", "Pizza", "Fast Food", "Beverages", "Desserts", "Salads", "Pasta"];
  const categoryList = fetchedCategories.length > 0 ? fetchedCategories : defaultCategories;
  
  const categories = [
    { id: "all", name: "All Items" },
    ...categoryList.map(cat => ({ id: cat, name: cat }))
  ];

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const handleQuickCodeEntry = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !quickCode.trim()) return;
    
    const codes = quickCode.split(',').map(code => code.trim()).filter(code => code.length > 0);
    const notFoundCodes: string[] = [];
    const unavailableCodes: string[] = [];
    const addedItems: string[] = [];
    
    codes.forEach(code => {
      const normalizedCode = code.toLowerCase();
      const menuItem = menuItems.find((item) => 
        item.quickCode && item.quickCode.toLowerCase() === normalizedCode
      );
      
      if (!menuItem) {
        notFoundCodes.push(code);
        return;
      }
      
      if (!menuItem.available) {
        unavailableCodes.push(menuItem.name);
        return;
      }
      
      handleAddItem(menuItem.id);
      addedItems.push(menuItem.name);
    });
    
    setQuickCode("");
    
    if (addedItems.length > 0) {
      toast({
        title: `${addedItems.length} item${addedItems.length > 1 ? 's' : ''} added`,
        description: addedItems.join(', '),
      });
    }
    
    if (notFoundCodes.length > 0) {
      toast({
        title: "Items not found",
        description: `No items found with quick codes: ${notFoundCodes.join(', ')}`,
        variant: "destructive",
      });
    }
    
    if (unavailableCodes.length > 0) {
      toast({
        title: "Items unavailable",
        description: `Out of stock: ${unavailableCodes.join(', ')}`,
        variant: "destructive",
      });
    }
  };

  const handleAddItem = (itemId: string) => {
    const menuItem = menuItems.find((item) => item.id === itemId);
    if (!menuItem) return;

    const existingItem = orderItems.find((item) => item.menuItemId === itemId && !item.isFromDatabase);
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          id: Math.random().toString(36).substring(7),
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: parseFloat(menuItem.price),
          quantity: 1,
          notes: undefined,
          isFromDatabase: false,
          isVeg: menuItem.isVeg,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    const item = orderItems.find((i) => i.id === id);
    if (item?.isFromDatabase) {
      toast({
        title: "Cannot modify",
        description: "This item has already been sent to kitchen. Add a new order for changes.",
        variant: "destructive",
      });
      return;
    }
    
    if (quantity === 0) {
      setOrderItems(orderItems.filter((item) => item.id !== id));
    } else {
      setOrderItems(orderItems.map((item) => (item.id === id ? { ...item, quantity } : item)));
    }
  };

  const handleRemoveItem = (id: string) => {
    const item = orderItems.find((i) => i.id === id);
    if (item?.isFromDatabase) {
      toast({
        title: "Cannot remove",
        description: "This item has already been sent to kitchen. It cannot be removed from this view.",
        variant: "destructive",
      });
      return;
    }
    setOrderItems(orderItems.filter((item) => item.id !== id));
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    const item = orderItems.find((i) => i.id === id);
    if (item?.isFromDatabase) {
      toast({
        title: "Cannot modify",
        description: "This item has already been sent to kitchen. Add a new order for changes.",
        variant: "destructive",
      });
      return;
    }
    setOrderItems(orderItems.map((item) => (item.id === id ? { ...item, notes } : item)));
  };

  const createOrderWithItems = async () => {
    let orderId = currentOrderId;
    
    if (!orderId) {
      const orderData: any = {
        tableId: currentTableId,
        orderType: serviceType,
      };
      
      if ((serviceType === "delivery" || serviceType === "pickup") && selectedCustomer) {
        orderData.customerName = selectedCustomer.name;
        orderData.customerPhone = selectedCustomer.phone;
        orderData.customerAddress = selectedCustomer.address;
      }
      
      const order = await createOrderMutation.mutateAsync(orderData);
      orderId = order.id;
    }

    for (const item of orderItems) {
      if (!item.isFromDatabase) {
        await addOrderItemMutation.mutateAsync({
          orderId: orderId!,
          item: {
            orderId: orderId!,
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            price: item.price.toFixed(2),
            notes: item.notes || null,
            status: "new",
            isVeg: item.isVeg ?? true,
          },
        });
      }
    }
    
    return orderId;
  };

  const handleKOT = async (print: boolean) => {
    if (orderItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items before sending to kitchen",
        variant: "destructive",
      });
      return;
    }

    if (serviceType === "dine-in" && !currentTableId) {
      toast({
        title: "Table not selected",
        description: "Please select a floor and table before sending KOT",
        variant: "destructive",
      });
      return;
    }

    if (print && (serviceType === "delivery" || serviceType === "pickup")) {
      setPendingKotAction("kot-print");
      setShowCheckoutDialog(true);
      return;
    }

    try {
      const orderId = await createOrderWithItems();
      await kotMutation.mutateAsync({ orderId: orderId!, print });
      
      toast({
        title: print ? "KOT Sent & Printed!" : "KOT Sent!",
        description: "Order sent to kitchen successfully",
      });
      
      const updatedItems = orderItems.map(item => {
        if (!item.isFromDatabase) {
          return { ...item, isFromDatabase: true };
        }
        return item;
      });
      setOrderItems(updatedItems);
      
      if (currentTableId) {
        navigate("/tables");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send KOT",
        variant: "destructive",
      });
    }
  };

  const handleSave = async (print: boolean) => {
    if (orderItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items before saving",
        variant: "destructive",
      });
      return;
    }

    if (serviceType === "dine-in" && !currentTableId) {
      toast({
        title: "Table not selected",
        description: "Please select a floor and table before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      const orderId = await createOrderWithItems();
      if (print) {
        await billMutation.mutateAsync({ orderId: orderId!, print: true });
        toast({
          title: "Order Billed & Printed!",
          description: "Order saved and bill printed successfully",
        });
      } else {
        await saveMutation.mutateAsync({ orderId: orderId!, print: false });
        toast({
          title: "Order Saved!",
          description: "Order saved successfully",
        });
      }
      
      const updatedItems = orderItems.map(item => {
        if (!item.isFromDatabase) {
          return { ...item, isFromDatabase: true };
        }
        return item;
      });
      setOrderItems(updatedItems);
      
      if (currentTableId) {
        navigate("/tables");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save order",
        variant: "destructive",
      });
    }
  };

  const handleSendKOT = () => handleKOT(false);
  const handleKOTPrint = () => handleKOT(true);
  const handleSaveOrder = () => handleSave(false);
  const handleSavePrint = () => handleSave(true);

  const handleCheckout = () => {
    if (orderItems.length === 0 && !currentOrderId) {
      toast({
        title: "No order",
        description: "Please add items or send KOT first",
        variant: "destructive",
      });
      return;
    }
    setCheckoutMode(true);
  };

  const handleCancelCheckout = () => {
    setCheckoutMode(false);
  };

  const handlePaymentMethodSelect = (method: "cash" | "card" | "upi") => {
    setPaymentMethod(method);
  };

  const handleConfirmPayment = async () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    try {
      let orderId = currentOrderId;
      
      if (!orderId && pendingKotAction !== "none") {
        orderId = await createOrderWithItems();
      }

      if (!orderId) {
        toast({
          title: "No active order",
          description: "Please send KOT or save order first before checkout",
          variant: "destructive",
        });
        return;
      }

      const checkoutResponse = await checkoutMutation.mutateAsync({ 
        orderId: orderId, 
        paymentMode: paymentMethod,
        splitPayments: undefined,
        print: false 
      });

      if (pendingKotAction !== "none") {
        const shouldPrint = pendingKotAction === "kot-print";
        
        if (shouldPrint && checkoutResponse.invoice) {
          try {
            const pdfUrl = `/api/invoices/${checkoutResponse.invoice.id}/pdf`;
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Failed to download invoice');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${checkoutResponse.invoice.invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } catch (error) {
            console.error('Failed to download invoice PDF:', error);
            toast({
              title: "Warning",
              description: "Invoice PDF download failed, but order was completed successfully",
              variant: "destructive",
            });
          }
        }
        
        await billMutation.mutateAsync({ orderId: orderId!, print: false });
        
        await kotMutation.mutateAsync({ orderId: orderId!, print: false });
        
        toast({
          title: "Order completed!",
          description: shouldPrint ? "Invoice downloaded successfully" : "Order marked as completed",
        });
        
        setPendingKotAction("none");
      }

      setCheckoutMode(false);
      setOrderItems([]);
      setCurrentOrderId(null);
      setCurrentTableId(null);
      setTableNumber("");
      setFloorName("");
      setSelectedCustomer(null);
      
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      toast({
        title: "Payment successful",
        description: `Payment of ₹${total.toFixed(2)} via ${paymentMethod.toUpperCase()} completed`,
      });
      
      navigate("/");
    } catch (error: any) {
      console.error("Checkout failed:", error);
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    }
  };

  const handleSplitBill = () => {
    if (orderItems.length === 0 && !currentOrderId) {
      toast({
        title: "No order",
        description: "Please add items or send KOT first",
        variant: "destructive",
      });
      return;
    }
    setSplitMode("equal");
    setSplitCount(2);
    const equalAmount = total / 2;
    setSplitAmounts([equalAmount, equalAmount]);
    setSplitPaymentModes(["cash", "cash"]);
    setShowSplitBillDialog(true);
  };

  const handleSplitCountChange = (count: number) => {
    setSplitCount(count);
    if (splitMode === "equal") {
      const equalAmount = total / count;
      setSplitAmounts(Array(count).fill(equalAmount));
    } else {
      const remaining = total - splitAmounts.reduce((sum, amt, idx) => idx < count - 1 ? sum + amt : sum, 0);
      const newAmounts = [...splitAmounts.slice(0, count - 1), remaining];
      while (newAmounts.length < count) {
        newAmounts.push(0);
      }
      setSplitAmounts(newAmounts);
    }
    
    const newPaymentModes = [...splitPaymentModes];
    while (newPaymentModes.length < count) {
      newPaymentModes.push("cash");
    }
    setSplitPaymentModes(newPaymentModes.slice(0, count));
  };

  const handleSplitModeChange = (mode: "equal" | "custom") => {
    setSplitMode(mode);
    if (mode === "equal") {
      const equalAmount = total / splitCount;
      setSplitAmounts(Array(splitCount).fill(equalAmount));
    }
  };

  const handleSplitPaymentModeChange = (index: number, mode: string) => {
    const newModes = [...splitPaymentModes];
    newModes[index] = mode;
    setSplitPaymentModes(newModes);
  };

  const handleCustomAmountChange = (index: number, value: number) => {
    const newAmounts = [...splitAmounts];
    newAmounts[index] = value;
    setSplitAmounts(newAmounts);
  };

  const handleConfirmCheckout = async () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    try {
      let orderId = currentOrderId;
      
      if (!orderId && pendingKotAction !== "none") {
        orderId = await createOrderWithItems();
      }

      if (!orderId) {
        toast({
          title: "No active order",
          description: "Please send KOT or save order first before checkout",
          variant: "destructive",
        });
        return;
      }

      const splitPaymentsData = splitAmounts.length > 0 && splitAmounts.length === splitCount
        ? splitAmounts.map((amount, index) => ({
            person: index + 1,
            amount,
            paymentMode: splitPaymentModes[index] || paymentMethod,
          }))
        : undefined;

      const checkoutResponse = await checkoutMutation.mutateAsync({ 
        orderId: orderId, 
        paymentMode: paymentMethod,
        splitPayments: splitPaymentsData,
        print: false 
      });

      if (pendingKotAction !== "none") {
        const shouldPrint = pendingKotAction === "kot-print";
        
        if (shouldPrint && checkoutResponse.invoice) {
          try {
            const pdfUrl = `/api/invoices/${checkoutResponse.invoice.id}/pdf`;
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Failed to download invoice');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${checkoutResponse.invoice.invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } catch (error) {
            console.error('Failed to download invoice PDF:', error);
            toast({
              title: "Warning",
              description: "Invoice PDF download failed, but order was completed successfully",
              variant: "destructive",
            });
          }
        }
        
        await billMutation.mutateAsync({ orderId: orderId!, print: false });
        
        await kotMutation.mutateAsync({ orderId: orderId!, print: false });
        
        toast({
          title: "Order completed!",
          description: shouldPrint 
            ? "Payment confirmed, invoice downloaded, and KOT sent to kitchen!"
            : "Payment confirmed and KOT sent to kitchen!",
        });
      } else {
        toast({
          title: "Order completed!",
          description: splitPaymentsData 
            ? `Total: ₹${total.toFixed(2)} - Split ${splitCount} ways`
            : `Total: ₹${total.toFixed(2)} - Payment: ${paymentMethod.toUpperCase()}`,
        });
      }

      setOrderItems([]);
      setCurrentOrderId(null);
      setShowCheckoutDialog(false);
      setSplitAmounts([]);
      setSplitPaymentModes([]);
      setPendingKotAction("none");

      if (currentTableId) {
        navigate("/tables");
      } else {
        setCurrentTableId(null);
        setTableNumber("");
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to complete order";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleFloorChange = (floorId: string) => {
    setSelectedFloorId(floorId);
    setSelectedTableFromDropdown("");
  };

  const handleTableChange = (tableId: string) => {
    setSelectedTableFromDropdown(tableId);
    const selectedTable = tables.find((t: any) => t.id === tableId);
    if (selectedTable) {
      setCurrentTableId(tableId);
      setTableNumber(selectedTable.tableNumber);
      const selectedFloor = floors.find((f: any) => f.id === selectedTable.floorId);
      setFloorName(selectedFloor?.name || "");
    }
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <AppHeader title="Billing / POS" showSearch={false} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-40 shrink-0 hidden md:block bg-white border-r border-gray-200">
          <CategorySidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="p-5 bg-white border-b border-gray-200">
            {tableNumber && (
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="default" className="text-base px-3 py-1">
                  Table {tableNumber}
                </Badge>
                {floorName && (
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {floorName}
                  </Badge>
                )}
              </div>
            )}
            
            <div className="md:hidden mb-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-11 text-base" data-testid="select-category-mobile">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search menu items..."
                  className="pl-11 h-11 text-base border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-menu-search"
                />
              </div>
              <Input
                placeholder="Quick code..."
                className="w-32 h-11 text-base border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
                onKeyDown={handleQuickCodeEntry}
                data-testid="input-quick-code"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} available
              </span>
              {selectedCategory !== "all" && (
                <Badge variant="secondary" className="font-medium">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4 bg-gray-50">
            {menuLoading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="animate-pulse">Loading menu...</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map((item) => (
                  <MenuItemCard 
                    key={item.id} 
                    id={item.id}
                    name={item.name}
                    price={parseFloat(item.price)}
                    category={item.category}
                    available={item.available}
                    isVeg={item.isVeg}
                    quickCode={item.quickCode}
                    onAdd={handleAddItem} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block lg:w-[480px] shrink-0 bg-white shadow-lg">
          <OrderCart
            items={orderItems}
            serviceType={serviceType}
            onServiceTypeChange={setServiceType}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateNotes={handleUpdateNotes}
            onCheckout={handleCheckout}
            onSplitBill={handleSplitBill}
            onKOT={handleSendKOT}
            onKOTPrint={handleKOTPrint}
            onSave={handleSaveOrder}
            onSavePrint={handleSavePrint}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={() => setShowCustomerDialog(true)}
            currentTableId={currentTableId}
            floors={floors}
            tables={tables}
            selectedFloorId={selectedFloorId}
            selectedTableFromDropdown={selectedTableFromDropdown}
            onFloorChange={handleFloorChange}
            onTableChange={handleTableChange}
            checkoutMode={checkoutMode}
            onCancelCheckout={handleCancelCheckout}
            onPaymentMethodSelect={handlePaymentMethodSelect}
            onConfirmPayment={handleConfirmPayment}
            paymentMethod={paymentMethod}
          />
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-gray-600">
              {orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}
            </div>
            <div className="text-lg font-bold">₹{total.toFixed(2)}</div>
          </div>
          <Button 
            onClick={() => setShowMobileCart(true)}
            className="flex items-center gap-2"
            size="lg"
            data-testid="button-view-cart"
          >
            <ShoppingCart className="h-5 w-5" />
            View Cart
          </Button>
        </div>
      </div>

      <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Your Order</SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-y-auto">
            <OrderCart
              items={orderItems}
              serviceType={serviceType}
              onServiceTypeChange={setServiceType}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onUpdateNotes={handleUpdateNotes}
              onCheckout={handleCheckout}
              onSplitBill={handleSplitBill}
              onKOT={handleSendKOT}
              onKOTPrint={handleKOTPrint}
              onSave={handleSaveOrder}
              onSavePrint={handleSavePrint}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={() => setShowCustomerDialog(true)}
              currentTableId={currentTableId}
              floors={floors}
              tables={tables}
              selectedFloorId={selectedFloorId}
              selectedTableFromDropdown={selectedTableFromDropdown}
              onFloorChange={handleFloorChange}
              onTableChange={handleTableChange}
              checkoutMode={checkoutMode}
              onCancelCheckout={handleCancelCheckout}
              onPaymentMethodSelect={handlePaymentMethodSelect}
              onConfirmPayment={handleConfirmPayment}
              paymentMethod={paymentMethod}
            />
          </div>
        </SheetContent>
      </Sheet>

      <CustomerSelectionDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSelectCustomer={setSelectedCustomer}
        selectedCustomer={selectedCustomer}
      />

      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Select payment method and complete the order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("cash")}
                data-testid="button-payment-cash"
              >
                Cash
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => setPaymentMethod("card")}
                data-testid="button-payment-card"
              >
                Card
              </Button>
              <Button
                variant={paymentMethod === "upi" ? "default" : "outline"}
                onClick={() => setPaymentMethod("upi")}
                data-testid="button-payment-upi"
              >
                UPI
              </Button>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (5%):</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-primary">₹{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCheckoutDialog(false);
                  setShowSplitBillDialog(true);
                }}
                className="flex-1"
                data-testid="button-split-bill"
              >
                <Users className="h-4 w-4 mr-2" />
                Split Bill
              </Button>
              <Button
                onClick={handleConfirmCheckout}
                className="flex-1"
                data-testid="button-confirm-payment"
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSplitBillDialog} onOpenChange={setShowSplitBillDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Split Bill</DialogTitle>
            <DialogDescription>
              Split the bill among multiple people
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={splitMode === "equal" ? "default" : "outline"}
                onClick={() => handleSplitModeChange("equal")}
                className="flex-1"
              >
                Split Equally
              </Button>
              <Button
                variant={splitMode === "custom" ? "default" : "outline"}
                onClick={() => handleSplitModeChange("custom")}
                className="flex-1"
              >
                Custom Amounts
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Number of People</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((count) => (
                  <Button
                    key={count}
                    variant={splitCount === count ? "default" : "outline"}
                    onClick={() => handleSplitCountChange(count)}
                    className="flex-1"
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between text-sm font-medium border-b pb-2">
                <span>Total Bill:</span>
                <span className="text-primary">₹{total.toFixed(2)}</span>
              </div>
              {splitAmounts.map((amount, index) => (
                <div key={index} className="space-y-2 pb-2 border-b last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Person {index + 1}</span>
                    {splitMode === "custom" && index < splitCount - 1 ? (
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => handleCustomAmountChange(index, parseFloat(e.target.value) || 0)}
                        className="w-32 h-8"
                        step="0.01"
                      />
                    ) : (
                      <span className="font-semibold">₹{amount.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {["cash", "card", "upi"].map((mode) => (
                      <Button
                        key={mode}
                        size="sm"
                        variant={splitPaymentModes[index] === mode ? "default" : "outline"}
                        onClick={() => handleSplitPaymentModeChange(index, mode)}
                        className="flex-1 h-7 text-xs"
                      >
                        {mode.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {splitMode === "custom" && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Sum:</span>
                    <span className={splitAmounts.reduce((sum, amt) => sum + amt, 0) !== total ? "text-red-500" : "text-green-600"}>
                      ₹{splitAmounts.reduce((sum, amt) => sum + amt, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSplitBillDialog(false);
                  setShowCheckoutDialog(true);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (splitMode === "custom" && Math.abs(splitAmounts.reduce((sum, amt) => sum + amt, 0) - total) > 0.01) {
                    toast({
                      title: "Invalid split",
                      description: "Split amounts must equal the total bill",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowSplitBillDialog(false);
                  setShowCheckoutDialog(true);
                }}
                className="flex-1"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrintableInvoice
        invoice={printableInvoice}
        order={printableOrder}
        orderItems={printableOrderItems}
        onPrintComplete={() => {
          setPrintableInvoice(null);
          setPrintableOrder(null);
          setPrintableOrderItems([]);
        }}
      />
    </div>
  );
}
