import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, MoreVertical, Database, RefreshCw, ArrowUpDown, Search, Filter, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import CategorySidebar from "@/components/CategorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuItem, InventoryItem } from "@shared/schema";

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "category-asc" | "category-desc" | "cost-asc" | "cost-desc" | "type-veg" | "type-nonveg";
type AvailabilityFilter = "all" | "available" | "unavailable";
type TypeFilter = "all" | "veg" | "nonveg";

interface RecipeIngredient {
  id?: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
}

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMongoURIDialogOpen, setIsMongoURIDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu"],
  });

  const { data: mongoSettings } = useQuery<{ uri: string | null; hasUri: boolean }>({
    queryKey: ["/api/settings/mongodb-uri"],
  });

  const { data: categoriesData } = useQuery<{ categories: string[] }>({
    queryKey: ["/api/menu/categories"],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const saveMongoURIMutation = useMutation({
    mutationFn: async (uri: string) => {
      const res = await apiRequest("POST", "/api/settings/mongodb-uri", { uri });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/mongodb-uri"] });
      setIsMongoURIDialogOpen(false);
      toast({
        title: "Success",
        description: "MongoDB URI saved successfully",
      });
    },
  });

  const syncFromMongoDBMutation = useMutation({
    mutationFn: async (databaseName?: string) => {
      const res = await apiRequest("POST", "/api/menu/sync-from-mongodb", { databaseName });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Success",
        description: `Synced ${data.itemsImported} items from MongoDB`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync from MongoDB",
        variant: "destructive",
      });
    },
  });

  const createMenuItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/menu", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Menu item added successfully",
      });
    },
  });

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MenuItem> }) => {
      const res = await apiRequest("PATCH", `/api/menu/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Menu item updated successfully",
      });
    },
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/menu/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({
        title: "Success",
        description: "Menu item deleted successfully",
      });
    },
  });

  const fetchedCategories = categoriesData?.categories || [];
  const categories = fetchedCategories.length > 0 
    ? ["All", ...fetchedCategories] 
    : ["All", "Burgers", "Pizza", "Fast Food", "Beverages", "Salads", "Desserts", "Pasta"];

  const sidebarCategories = categories.map(cat => ({
    id: cat.toLowerCase(),
    name: cat,
  }));

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category.toLowerCase() === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAvailability = availabilityFilter === "all" || 
      (availabilityFilter === "available" && item.available) ||
      (availabilityFilter === "unavailable" && !item.available);
    const matchesType = typeFilter === "all" ||
      (typeFilter === "veg" && item.isVeg) ||
      (typeFilter === "nonveg" && !item.isVeg);
    return matchesCategory && matchesSearch && matchesAvailability && matchesType;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return parseFloat(a.price) - parseFloat(b.price);
      case "price-desc":
        return parseFloat(b.price) - parseFloat(a.price);
      case "category-asc":
        return a.category.localeCompare(b.category);
      case "category-desc":
        return b.category.localeCompare(a.category);
      case "cost-asc":
        return parseFloat(a.cost) - parseFloat(b.cost);
      case "cost-desc":
        return parseFloat(b.cost) - parseFloat(a.cost);
      case "type-veg":
        return a.isVeg === b.isVeg ? 0 : a.isVeg ? -1 : 1;
      case "type-nonveg":
        return a.isVeg === b.isVeg ? 0 : a.isVeg ? 1 : -1;
      default:
        return 0;
    }
  });

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const newItem = await createMenuItemMutation.mutateAsync({
        name: formData.get("name") as string,
        category: formData.get("category") as string,
        price: formData.get("price") as string,
        cost: formData.get("cost") as string,
        available: true,
        isVeg: formData.get("isVeg") === "true",
        image: formData.get("image") as string || null,
        description: formData.get("description") as string || null,
        quickCode: formData.get("quickCode") as string || null,
      });

      if (ingredients.length > 0) {
        const recipeRes = await apiRequest("POST", "/api/recipes", { menuItemId: newItem.id });
        const recipe = await recipeRes.json();

        for (const ingredient of ingredients) {
          await apiRequest("POST", `/api/recipes/${recipe.id}/ingredients`, {
            inventoryItemId: ingredient.inventoryItemId,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        }
      }

      setIngredients([]);
      toast({
        title: "Success",
        description: "Menu item and recipe added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add menu item",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;
    
    const formData = new FormData(e.currentTarget);
    
    try {
      await updateMenuItemMutation.mutateAsync({
        id: editingItem.id,
        data: {
          name: formData.get("name") as string,
          category: formData.get("category") as string,
          price: formData.get("price") as string,
          cost: formData.get("cost") as string,
          isVeg: formData.get("isVeg") === "true",
          image: formData.get("image") as string || null,
          description: formData.get("description") as string || null,
          quickCode: formData.get("quickCode") as string || null,
        },
      });

      try {
        const recipeRes = await apiRequest("GET", `/api/recipes/menu-item/${editingItem.id}`);
        const existingRecipe = await recipeRes.json();

        for (const ingredient of existingRecipe.ingredients) {
          await apiRequest("DELETE", `/api/recipes/${existingRecipe.recipe.id}/ingredients/${ingredient.id}`);
        }

        for (const ingredient of ingredients) {
          await apiRequest("POST", `/api/recipes/${existingRecipe.recipe.id}/ingredients`, {
            inventoryItemId: ingredient.inventoryItemId,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        }
      } catch (recipeError: any) {
        if (ingredients.length > 0) {
          const recipeRes = await apiRequest("POST", "/api/recipes", { menuItemId: editingItem.id });
          const recipe = await recipeRes.json();

          for (const ingredient of ingredients) {
            await apiRequest("POST", `/api/recipes/${recipe.id}/ingredients`, {
              inventoryItemId: ingredient.inventoryItemId,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            });
          }
        }
      }

      setIngredients([]);
      toast({
        title: "Success",
        description: "Menu item and recipe updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update menu item",
        variant: "destructive",
      });
    }
  };

  const handleMongoURISubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const uri = formData.get("uri") as string;
    await saveMongoURIMutation.mutateAsync(uri);
  };

  const handleSyncSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const databaseName = formData.get("databaseName") as string;
    await syncFromMongoDBMutation.mutateAsync(databaseName || undefined);
    setIsSyncDialogOpen(false);
  };

  const toggleAvailability = async (id: string, available: boolean) => {
    await updateMenuItemMutation.mutateAsync({
      id,
      data: { available: !available },
    });
  };

  const openEditDialog = async (item: MenuItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
    setIngredients([]);
    
    setIsLoadingRecipe(true);
    try {
      const recipeRes = await apiRequest("GET", `/api/recipes/menu-item/${item.id}`);
      const recipeData = await recipeRes.json();
      
      if (recipeData && recipeData.ingredients) {
        const loadedIngredients: RecipeIngredient[] = recipeData.ingredients.map((ing: any) => ({
          id: ing.id,
          inventoryItemId: ing.inventoryItemId,
          quantity: ing.quantity,
          unit: ing.unit,
        }));
        setIngredients(loadedIngredients);
      }
    } catch (error) {
      console.log("No recipe found for this item");
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  const openImageViewer = (image: string | null) => {
    if (image) {
      setSelectedImage(image);
      setIsImageViewerOpen(true);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { inventoryItemId: "", quantity: "1", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "inventoryItemId") {
      const selectedItem = inventoryItems.find(item => item.id === value);
      if (selectedItem) {
        updated[index].unit = selectedItem.unit;
      }
    }
    
    setIngredients(updated);
  };

  const resetAddDialog = () => {
    setIsAddDialogOpen(false);
    setIngredients([]);
  };

  const resetEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingItem(null);
    setIngredients([]);
  };

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="Menu Management" />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 flex-shrink-0 hidden lg:block">
          <CategorySidebar
            categories={sidebarCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-3 lg:hidden">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full" data-testid="select-category-mobile">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {sidebarCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm font-semibold">Availability</div>
                  <DropdownMenuItem onClick={() => setAvailabilityFilter("all")} data-testid="filter-availability-all">
                    {availabilityFilter === "all" && "✓ "}All Items
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAvailabilityFilter("available")} data-testid="filter-availability-available">
                    {availabilityFilter === "available" && "✓ "}Available Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAvailabilityFilter("unavailable")} data-testid="filter-availability-unavailable">
                    {availabilityFilter === "unavailable" && "✓ "}Unavailable Only
                  </DropdownMenuItem>
                  <div className="px-2 py-1.5 text-sm font-semibold border-t mt-1">Type</div>
                  <DropdownMenuItem onClick={() => setTypeFilter("all")} data-testid="filter-type-all">
                    {typeFilter === "all" && "✓ "}All Types
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("veg")} data-testid="filter-type-veg">
                    {typeFilter === "veg" && "✓ "}Vegetarian
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("nonveg")} data-testid="filter-type-nonveg">
                    {typeFilter === "nonveg" && "✓ "}Non-Vegetarian
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-sort">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">Name</div>
                <DropdownMenuItem onClick={() => setSortOption("name-asc")} data-testid="sort-name-asc">
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("name-desc")} data-testid="sort-name-desc">
                  Name (Z-A)
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-sm font-semibold border-t mt-1">Price</div>
                <DropdownMenuItem onClick={() => setSortOption("price-asc")} data-testid="sort-price-asc">
                  Price (Low to High)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("price-desc")} data-testid="sort-price-desc">
                  Price (High to Low)
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-sm font-semibold border-t mt-1">Category</div>
                <DropdownMenuItem onClick={() => setSortOption("category-asc")} data-testid="sort-category-asc">
                  Category (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("category-desc")} data-testid="sort-category-desc">
                  Category (Z-A)
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-sm font-semibold border-t mt-1">Cost</div>
                <DropdownMenuItem onClick={() => setSortOption("cost-asc")} data-testid="sort-cost-asc">
                  Cost (Low to High)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("cost-desc")} data-testid="sort-cost-desc">
                  Cost (High to Low)
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-sm font-semibold border-t mt-1">Type</div>
                <DropdownMenuItem onClick={() => setSortOption("type-veg")} data-testid="sort-type-veg">
                  Vegetarian First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("type-nonveg")} data-testid="sort-type-nonveg">
                  Non-Vegetarian First
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isAddDialogOpen} onOpenChange={resetAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Add New Menu Item</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-100px)]">
                <form onSubmit={handleAddSubmit} className="space-y-4 mt-4 pr-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name</Label>
                    <Input 
                      id="name"
                      name="name"
                      placeholder="Item Name"
                      required
                      data-testid="input-item-name" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select name="category" required>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c !== "All").map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input 
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      required
                      data-testid="input-price" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost</Label>
                    <Input 
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      required
                      data-testid="input-cost" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image">Image URL</Label>
                    <Input 
                      id="image"
                      name="image"
                      placeholder="https://example.com/image.jpg"
                      data-testid="input-image" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                      id="description"
                      name="description"
                      placeholder="Item description"
                      data-testid="input-description" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quickCode">Quick Code (Optional)</Label>
                    <Input 
                      id="quickCode"
                      name="quickCode"
                      placeholder="e.g., 1, A1, or custom code"
                      data-testid="input-quickcode"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique code for quick entry in POS. Each item must have a different code.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="isVeg">Vegetarian</Label>
                    <Select name="isVeg" defaultValue="true">
                      <SelectTrigger data-testid="select-isVeg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Vegetarian</SelectItem>
                        <SelectItem value="false">Non-Vegetarian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Ingredients (Optional)</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addIngredient}
                        data-testid="button-add-ingredient"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Ingredient
                      </Button>
                    </div>

                    {ingredients.length > 0 && (
                      <div className="space-y-2">
                        {ingredients.map((ingredient, index) => (
                          <div key={index} className="flex items-end gap-2 p-3 bg-muted/30 rounded-lg" data-testid={`ingredient-row-${index}`}>
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs">Ingredient</Label>
                              <Select
                                value={ingredient.inventoryItemId}
                                onValueChange={(value) => updateIngredient(index, "inventoryItemId", value)}
                              >
                                <SelectTrigger data-testid={`select-ingredient-${index}`}>
                                  <SelectValue placeholder="Select ingredient" />
                                </SelectTrigger>
                                <SelectContent>
                                  {inventoryItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={ingredient.quantity}
                                onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                                data-testid={`input-quantity-${index}`}
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <Label className="text-xs">Unit</Label>
                              <Input
                                value={ingredient.unit}
                                readOnly
                                className="bg-muted"
                                data-testid={`input-unit-${index}`}
                              />
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeIngredient(index)}
                              data-testid={`button-remove-ingredient-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    className="w-full"
                    disabled={createMenuItemMutation.isPending}
                    data-testid="button-save-item"
                  >
                    {createMenuItemMutation.isPending ? "Adding..." : "Add Item"}
                  </Button>
                </form>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-menu-options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsMongoURIDialogOpen(true)} data-testid="menu-database-uri">
                  <Database className="h-4 w-4 mr-2" />
                  Database URI
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsSyncDialogOpen(true)}
                  data-testid="menu-refresh-database"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Database
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading menu...</div>
            ) : (
              <>
              <div className="hidden md:block bg-card rounded-lg border border-card-border overflow-x-auto">
                <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Item Name</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Image</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Price</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const price = parseFloat(item.price);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover-elevate" data-testid={`menu-item-${item.id}`}>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.image ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openImageViewer(item.image)}
                            data-testid={`button-view-image-${item.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={item.isVeg ? "default" : "destructive"} data-testid={`badge-type-${item.id}`}>
                          {item.isVeg ? "Veg" : "Non-Veg"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{item.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">₹{price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant={item.available ? "default" : "secondary"}
                          onClick={() => toggleAvailability(item.id, item.available)}
                          data-testid={`button-toggle-${item.id}`}
                        >
                          {item.available ? "Available" : "Unavailable"}
                        </Button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => deleteMenuItemMutation.mutate(item.id)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>

              <div className="md:hidden space-y-3">
                {sortedItems.map((item) => {
                  const price = parseFloat(item.price);
                  return (
                    <div
                      key={item.id}
                      className="bg-card rounded-lg border border-card-border p-4 space-y-3"
                      data-testid={`menu-item-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.isVeg ? "default" : "destructive"} data-testid={`badge-type-${item.id}`}>
                              {item.isVeg ? "Veg" : "Non-Veg"}
                            </Badge>
                            <Badge variant="secondary">{item.category}</Badge>
                          </div>
                          <h3 className="font-medium text-base">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {item.image && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => openImageViewer(item.image)}
                            data-testid={`button-view-image-${item.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold">₹{price.toFixed(2)}</div>
                        <Button
                          size="sm"
                          variant={item.available ? "default" : "secondary"}
                          onClick={() => toggleAvailability(item.id, item.available)}
                          data-testid={`button-toggle-${item.id}`}
                        >
                          {item.available ? "Available" : "Unavailable"}
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openEditDialog(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => deleteMenuItemMutation.mutate(item.id)}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

      <Dialog open={isMongoURIDialogOpen} onOpenChange={setIsMongoURIDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure MongoDB URI</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMongoURISubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="uri">MongoDB Connection URI</Label>
              <Input 
                id="uri"
                name="uri"
                type="text"
                placeholder="mongodb+srv://..."
                defaultValue={mongoSettings?.uri || ""}
                required
                data-testid="input-mongodb-uri" 
              />
              <p className="text-xs text-muted-foreground">
                Enter your MongoDB connection string. Database name will be extracted from appName parameter or URI path.
              </p>
            </div>
            <Button 
              type="submit"
              className="w-full"
              disabled={saveMongoURIMutation.isPending}
              data-testid="button-save-uri"
            >
              {saveMongoURIMutation.isPending ? "Saving..." : "Save URI"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sync from MongoDB</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSyncSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="databaseName">Database Name (Optional)</Label>
              <Input 
                id="databaseName"
                name="databaseName"
                type="text"
                placeholder="Leave empty to auto-detect"
                data-testid="input-database-name" 
              />
              <p className="text-xs text-muted-foreground">
                Specify database name if auto-detection fails. Defaults to appName from URI or "test".
              </p>
            </div>
            <Button 
              type="submit"
              className="w-full"
              disabled={syncFromMongoDBMutation.isPending}
              data-testid="button-sync-database"
            >
              {syncFromMongoDBMutation.isPending ? "Syncing..." : "Sync Database"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={resetEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <ScrollArea className="max-h-[calc(90vh-100px)]">
            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4 pr-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item Name</Label>
                <Input 
                  id="edit-name"
                  name="name"
                  placeholder="Item Name"
                  defaultValue={editingItem.name}
                  required
                  data-testid="input-edit-name" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select name="category" defaultValue={editingItem.category} required>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== "All").map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price</Label>
                <Input 
                  id="edit-price"
                  name="price"
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  defaultValue={editingItem.price}
                  required
                  data-testid="input-edit-price" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Cost</Label>
                <Input 
                  id="edit-cost"
                  name="cost"
                  type="number"
                  step="0.01"
                  placeholder="Cost"
                  defaultValue={editingItem.cost}
                  required
                  data-testid="input-edit-cost" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image">Image URL</Label>
                <Input 
                  id="edit-image"
                  name="image"
                  placeholder="https://example.com/image.jpg"
                  defaultValue={editingItem.image || ""}
                  data-testid="input-edit-image" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea 
                  id="edit-description"
                  name="description"
                  placeholder="Item description"
                  defaultValue={editingItem.description || ""}
                  data-testid="input-edit-description" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quickCode">Quick Code (Optional)</Label>
                <Input 
                  id="edit-quickCode"
                  name="quickCode"
                  placeholder="e.g., 1, A1, or custom code"
                  defaultValue={editingItem.quickCode || ""}
                  data-testid="input-edit-quickcode"
                />
                <p className="text-xs text-muted-foreground">
                  Unique code for quick entry in POS. Each item must have a different code.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-isVeg">Vegetarian</Label>
                <Select name="isVeg" defaultValue={editingItem.isVeg ? "true" : "false"}>
                  <SelectTrigger data-testid="select-edit-isVeg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Vegetarian</SelectItem>
                    <SelectItem value="false">Non-Vegetarian</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ingredients (Optional)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addIngredient}
                    data-testid="button-add-ingredient-edit"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Ingredient
                  </Button>
                </div>

                {isLoadingRecipe && (
                  <div className="text-sm text-muted-foreground py-2">
                    Loading recipe ingredients...
                  </div>
                )}

                {!isLoadingRecipe && ingredients.length > 0 && (
                  <div className="space-y-2">
                    {ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-end gap-2 p-3 bg-muted/30 rounded-lg" data-testid={`ingredient-row-edit-${index}`}>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Ingredient</Label>
                          <Select
                            value={ingredient.inventoryItemId}
                            onValueChange={(value) => updateIngredient(index, "inventoryItemId", value)}
                          >
                            <SelectTrigger data-testid={`select-ingredient-edit-${index}`}>
                              <SelectValue placeholder="Select ingredient" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={ingredient.quantity}
                            onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                            data-testid={`input-quantity-edit-${index}`}
                          />
                        </div>
                        <div className="w-20 space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={ingredient.unit}
                            readOnly
                            className="bg-muted"
                            data-testid={`input-unit-edit-${index}`}
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeIngredient(index)}
                          data-testid={`button-remove-ingredient-edit-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                type="submit"
                className="w-full"
                disabled={updateMenuItemMutation.isPending}
                data-testid="button-update-item"
              >
                {updateMenuItemMutation.isPending ? "Updating..." : "Update Item"}
              </Button>
            </form>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Item Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="mt-4">
              <img 
                src={selectedImage} 
                alt="Menu item" 
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23ddd' width='400' height='300'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage not available%3C/text%3E%3C/svg%3E";
                }}
                data-testid="image-viewer"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
