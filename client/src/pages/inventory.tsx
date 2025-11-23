import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, AlertTriangle, History, Grid3x3, List, ChevronDown, ChevronUp, Eye, TrendingUp, Package, AlertCircle, Zap, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InventoryItem, Supplier } from "@shared/schema";
import { categoryUnits } from "@shared/schema";

const inventoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  currentStock: z.string().min(1, "Current stock is required"),
  unit: z.string().min(1, "Unit is required"),
  minStock: z.string().min(1, "Minimum stock is required"),
  supplierId: z.string().nullable().optional(),
  costPerUnit: z.string().min(1, "Cost per unit is required"),
  image: z.string().nullable().optional(),
});

type InventoryFormData = z.infer<typeof inventoryFormSchema>;

const categories = [
  "All",
  "Vegetables & Produce",
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy & Cheese",
  "Bakery & Bread",
  "Grains & Pasta",
  "Oils & Condiments",
  "Spices & Seasonings",
  "Beverages",
  "Fruits",
  "Frozen Items",
  "Canned & Packaged",
  "Sauces & Dressings",
  "Sugar & Sweeteners",
  "Coffee & Tea",
  "Eggs",
  "Nuts & Seeds",
  "Herbs & Aromatics",
  "Dry Goods",
  "Other",
];

const categoryColors: Record<string, string> = {
  "Vegetables & Produce": "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
  "Meat & Poultry": "bg-gradient-to-br from-red-50 to-pink-50 border-red-200",
  "Fish & Seafood": "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200",
  "Dairy & Cheese": "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200",
  "Bakery & Bread": "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200",
  "Grains & Pasta": "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200",
  "Oils & Condiments": "bg-gradient-to-br from-yellow-50 to-lime-50 border-yellow-200",
  "Spices & Seasonings": "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200",
  "Beverages": "bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200",
  "Fruits": "bg-gradient-to-br from-pink-50 to-red-50 border-pink-200",
  "Frozen Items": "bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200",
  "Canned & Packaged": "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200",
  "Sauces & Dressings": "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200",
  "Sugar & Sweeteners": "bg-gradient-to-br from-pink-50 to-red-50 border-pink-200",
  "Coffee & Tea": "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200",
  "Eggs": "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200",
  "Nuts & Seeds": "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200",
  "Herbs & Aromatics": "bg-gradient-to-br from-green-50 to-lime-50 border-green-200",
  "Dry Goods": "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200",
  "Other": "bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200",
};

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isListView, setIsListView] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  useEffect(() => {
    console.log('[INVENTORY PAGE] Items fetched from /api/inventory:', items);
    console.log('[INVENTORY PAGE] Total items count:', items.length);
    console.log('[INVENTORY PAGE] Loading state:', isLoading);
    
    if (items.length > 0) {
      const categoryCounts: Record<string, number> = {};
      items.forEach(item => {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      });
      console.log('[INVENTORY PAGE] Items by category:', categoryCounts);
      console.log('[INVENTORY PAGE] Sample item:', items[0]);
    }
  }, [items, isLoading]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'inventory_updated' || data.type === 'inventory_created' || data.type === 'inventory_deleted') {
        queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      }
    };
    
    return () => ws.close();
  }, []);

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name: "",
      category: "",
      currentStock: "",
      unit: "",
      minStock: "0",
      costPerUnit: "0",
      image: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const response = await apiRequest("POST", "/api/inventory", {
        ...data,
        currentStock: parseFloat(data.currentStock),
        minStock: parseFloat(data.minStock),
        costPerUnit: parseFloat(data.costPerUnit),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      form.reset();
      setIsAddDialogOpen(false);
      setImagePreview(null);
      toast({ title: "Success", description: "Item added successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      if (!editingItem) return;
      const response = await apiRequest("PATCH", `/api/inventory/${editingItem.id}`, {
        ...data,
        currentStock: parseFloat(data.currentStock),
        minStock: parseFloat(data.minStock),
        costPerUnit: parseFloat(data.costPerUnit),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      form.reset();
      setIsEditDialogOpen(false);
      setEditingItem(null);
      setImagePreview(null);
      toast({ title: "Success", description: "Item updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Success", description: "Item deleted successfully" });
    },
  });

  const onSubmit = async (data: InventoryFormData) => {
    if (editingItem) {
      await updateMutation.mutateAsync(data);
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      category: item.category,
      currentStock: item.currentStock.toString(),
      unit: item.unit,
      minStock: item.minStock.toString(),
      supplierId: item.supplierId || undefined,
      costPerUnit: item.costPerUnit.toString(),
      image: item.image || undefined,
    });
    if (item.image) {
      setImagePreview(item.image);
    }
    setIsEditDialogOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        form.setValue("image", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const itemsByCategory = categories.filter(c => c !== "All").reduce((acc, cat) => {
    const catItems = items.filter(item => item.category === cat);
    acc[cat] = catItems;
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const currentCategoryItems = selectedCategory ? itemsByCategory[selectedCategory] || [] : [];

  const lowStockItems = filteredItems.filter(item => item.currentStock <= item.minStock);
  const totalValue = filteredItems.reduce((sum, item) => sum + (parseFloat(item.currentStock) * parseFloat(item.costPerUnit)), 0);
  const outOfStock = filteredItems.filter(item => parseFloat(item.currentStock) === 0).length;

  if (isLoading) {
    return <div className="p-6 text-center">Loading inventory...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="Inventory Management" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b bg-background px-6 pt-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="inventory" className="m-0 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Items</p>
                    <p className="text-3xl font-bold text-blue-700">{items.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-400" />
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">Low Stock</p>
                    <p className="text-3xl font-bold text-red-700">{lowStockItems.length}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Out of Stock</p>
                    <p className="text-3xl font-bold text-orange-700">{outOfStock}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-400" />
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Total Value</p>
                    <p className="text-2xl font-bold text-green-700">₹{totalValue.toFixed(2)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-400" />
                </div>
              </Card>
            </div>

            {selectedCategory ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setSelectedCategory(null)}
                      variant="outline"
                      size="sm"
                      data-testid="button-back"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Categories
                    </Button>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedCategory}</h2>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items in this category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsListView(!isListView)}
                      variant="outline"
                      size="sm"
                      data-testid="button-toggle-view"
                    >
                      {isListView ? (
                        <>
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          Card View
                        </>
                      ) : (
                        <>
                          <List className="h-4 w-4 mr-2" />
                          List View
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingItem(null);
                        form.reset();
                        setImagePreview(null);
                        setIsAddDialogOpen(true);
                      }}
                      data-testid="button-add-inventory"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate("/inventory-history")}
                    variant="outline"
                    size="sm"
                    data-testid="button-history"
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingItem(null);
                      form.reset();
                      setImagePreview(null);
                      setIsAddDialogOpen(true);
                    }}
                    data-testid="button-add-inventory"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            )}

            {selectedCategory ? (
              <>
                {isListView ? (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-center">Current Stock</TableHead>
                          <TableHead className="text-center">Unit</TableHead>
                          <TableHead className="text-center">Min Stock</TableHead>
                          <TableHead className="text-center">Cost/Unit</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentCategoryItems
                          .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(item => (
                            <TableRow
                              key={item.id}
                              className={item.currentStock <= item.minStock ? "bg-destructive/10" : ""}
                              data-testid={`row-item-${item.id}`}
                            >
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-center">
                                <span className={item.currentStock <= item.minStock ? "font-bold text-destructive" : ""}>
                                  {item.currentStock}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">{item.unit}</TableCell>
                              <TableCell className="text-center">{item.minStock}</TableCell>
                              <TableCell className="text-center">₹{parseFloat(item.costPerUnit.toString()).toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setIsDetailsDialogOpen(true);
                                    }}
                                    data-testid={`button-view-${item.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(item)}
                                    data-testid={`button-edit-${item.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteMutation.mutate(item.id)}
                                    data-testid={`button-delete-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {currentCategoryItems
                      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(item => (
                        <Card
                          key={item.id}
                          className="overflow-hidden hover:shadow-lg transition-shadow border-0 bg-white"
                          data-testid={`card-item-${item.id}`}
                        >
                          <div className="p-3">
                            {item.image ? (
                              <div className="h-24 bg-muted rounded mb-2 overflow-hidden">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-2 flex items-center justify-center text-muted-foreground text-xs">
                                No image
                              </div>
                            )}
                            <h4 className="font-semibold text-sm line-clamp-2 mb-2 text-gray-800">{item.name}</h4>
                            <div className="space-y-1 text-xs mb-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Qty:</span>
                                <span className={item.currentStock <= item.minStock ? "font-bold text-destructive" : "font-semibold text-green-600"}>
                                  {item.currentStock} {item.unit}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Price:</span>
                                <span className="font-semibold text-blue-600">₹{parseFloat(item.costPerUnit.toString()).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDetailsDialogOpen(true);
                                }}
                                data-testid={`button-view-card-${item.id}`}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleEdit(item)}
                                data-testid={`button-edit-card-${item.id}`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs"
                                onClick={() => deleteMutation.mutate(item.id)}
                                data-testid={`button-delete-card-${item.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                )}

                {currentCategoryItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No items found in this category
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {categories.filter(c => c !== "All").map(category => {
                  const catItems = itemsByCategory[category] || [];
                  
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`p-4 rounded-lg border-2 text-center transition-all hover:shadow-lg ${
                        categoryColors[category as keyof typeof categoryColors] || categoryColors["Other"]
                      }`}
                      data-testid={`button-category-${category}`}
                    >
                      <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-2">{category}</h3>
                      <Badge variant="secondary" className="text-xs">{catItems.length}</Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {!selectedCategory && filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No items found
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="m-0 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Total Categories</p>
                    <p className="text-3xl font-bold text-purple-700">{categories.filter(c => c !== "All").length}</p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-400" />
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-600 font-medium">Categories with Items</p>
                    <p className="text-3xl font-bold text-indigo-700">{Object.values(itemsByCategory).filter(items => items.length > 0).length}</p>
                  </div>
                  <Package className="h-8 w-8 text-indigo-400" />
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-teal-600 font-medium">Avg Cost Per Unit</p>
                    <p className="text-3xl font-bold text-teal-700">₹{filteredItems.length > 0 ? (filteredItems.reduce((sum, item) => sum + parseFloat(item.costPerUnit), 0) / filteredItems.length).toFixed(2) : "0"}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-teal-400" />
                </div>
              </Card>
            </div>

            <Card className="p-6 border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(itemsByCategory)
                  .filter(([, items]) => items.length > 0)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([category, catItems]) => {
                    const totalValue = catItems.reduce((sum, item) => sum + (parseFloat(item.currentStock) * parseFloat(item.costPerUnit)), 0);
                    const avgStock = catItems.reduce((sum, item) => sum + parseFloat(item.currentStock), 0) / catItems.length;
                    return (
                      <div key={category} className={`p-4 rounded-lg border ${categoryColors[category as keyof typeof categoryColors] || categoryColors["Other"]}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800">{category}</p>
                            <p className="text-sm text-gray-600">{catItems.length} items • Avg Stock: {avgStock.toFixed(1)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">₹{totalValue.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Category Value</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-6 border-red-200 bg-gradient-to-br from-red-50 to-red-100">
                <h3 className="text-lg font-semibold mb-4 text-red-800">Low Stock Alert</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lowStockItems.length > 0 ? (
                    lowStockItems.map(item => (
                      <div key={item.id} className="p-3 bg-white rounded border border-red-200">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-red-600">Stock: {item.currentStock} / Min: {item.minStock} {item.unit}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-red-600 text-sm">All items are well stocked!</p>
                  )}
                </div>
              </Card>

              <Card className="p-6 border-green-200 bg-gradient-to-br from-green-50 to-green-100">
                <h3 className="text-lg font-semibold mb-4 text-green-800">Top 10 Most Valuable</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredItems
                    .sort((a, b) => (parseFloat(b.currentStock) * parseFloat(b.costPerUnit)) - (parseFloat(a.currentStock) * parseFloat(a.costPerUnit)))
                    .slice(0, 10)
                    .map(item => (
                      <div key={item.id} className="p-3 bg-white rounded border border-green-200">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-green-600">Value: ₹{(parseFloat(item.currentStock) * parseFloat(item.costPerUnit)).toFixed(2)}</p>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.image && (
                <div className="h-48 rounded-lg overflow-hidden">
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-semibold">{selectedItem.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-semibold">{selectedItem.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Stock</p>
                    <p className={`font-semibold ${selectedItem.currentStock <= selectedItem.minStock ? "text-destructive" : ""}`}>
                      {selectedItem.currentStock} {selectedItem.unit}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Min Stock</p>
                    <p className="font-semibold">{selectedItem.minStock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost/Unit</p>
                    <p className="font-semibold">₹{parseFloat(selectedItem.costPerUnit.toString()).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="image"
                render={() => (
                  <FormItem>
                    <FormLabel>Image (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {imagePreview && (
                          <div className="h-32 rounded-md overflow-hidden">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          data-testid="input-image"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Item name" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.filter(c => c !== "All").map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-current-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => {
                    const selectedCategory = form.watch("category");
                    const availableUnits = selectedCategory && categoryUnits[selectedCategory as keyof typeof categoryUnits]
                      ? categoryUnits[selectedCategory as keyof typeof categoryUnits]
                      : ["kg", "g", "L", "ml", "pcs"];
                    
                    return (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-unit">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableUnits.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-min-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setImagePreview(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="image"
                render={() => (
                  <FormItem>
                    <FormLabel>Image (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {imagePreview && (
                          <div className="h-32 rounded-md overflow-hidden">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          data-testid="input-image-edit"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Item name" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.filter(c => c !== "All").map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-current-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => {
                    const selectedCategory = form.watch("category");
                    const availableUnits = selectedCategory && categoryUnits[selectedCategory as keyof typeof categoryUnits]
                      ? categoryUnits[selectedCategory as keyof typeof categoryUnits]
                      : ["kg", "g", "L", "ml", "pcs"];
                    
                    return (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-unit">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableUnits.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-min-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingItem(null);
                    setImagePreview(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Item"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
