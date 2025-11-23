import { useState } from "react";
import { ArrowLeft, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InventoryUsage } from "@shared/schema";

interface MostUsedItem {
  itemId: string;
  itemName: string;
  totalQuantity: string;
  count: number;
}

export default function InventoryHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortOption, setSortOption] = useState("recent");

  const { data: usages = [], isLoading: usagesLoading } = useQuery<InventoryUsage[]>({
    queryKey: ["/api/inventory-usage"],
  });

  const { data: mostUsed = [], isLoading: mostUsedLoading } = useQuery<MostUsedItem[]>({
    queryKey: ["/api/inventory-usage/most-used"],
  });

  const filteredUsages = usages.filter(usage => {
    const matchesSearch = usage.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || usage.source === filterType;
    return matchesSearch && matchesFilter;
  });

  const sortedUsages = [...filteredUsages].sort((a, b) => {
    switch (sortOption) {
      case "recent":
        return new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime();
      case "oldest":
        return new Date(a.usedAt).getTime() - new Date(b.usedAt).getTime();
      case "name":
        return a.itemName.localeCompare(b.itemName);
      default:
        return 0;
    }
  });

  const lowStockItems = usages.filter(usage => parseFloat(usage.quantity) < 1);

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="Inventory History" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Navigation */}
          <div className="mb-6">
            <Link href="/inventory">
              <Button variant="outline" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Total Usage Records</p>
              <p className="text-2xl font-bold" data-testid="stat-total-usages">{usages.length}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Most Used Items</p>
              <p className="text-2xl font-bold" data-testid="stat-most-used">{mostUsed.length}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Low Stock Uses</p>
              <p className="text-2xl font-bold text-destructive" data-testid="stat-low-stock">{lowStockItems.length}</p>
            </div>
          </div>

          {/* Most Used Items Section */}
          {!mostUsedLoading && mostUsed.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Most Used Items</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mostUsed.slice(0, 6).map(item => (
                  <div key={item.itemId} className="bg-card rounded-lg p-4 border border-border" data-testid={`card-most-used-${item.itemId}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{item.itemName}</h3>
                      <Badge variant="secondary">{item.count} uses</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Total Quantity Used: <span className="font-semibold">{item.totalQuantity}</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage History Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Usage History</h2>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48" data-testid="select-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="order">From Orders</SelectItem>
                  <SelectItem value="wastage">Wastage</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-48" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Item Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {usagesLoading ? (
              <div className="text-center py-8">Loading usage history...</div>
            ) : sortedUsages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No usage records found</div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-center">Quantity Used</TableHead>
                      <TableHead className="text-center">Unit</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsages.map(usage => (
                      <TableRow key={usage.id} data-testid={`row-usage-${usage.id}`}>
                        <TableCell className="font-medium">{usage.itemName}</TableCell>
                        <TableCell className="text-center">
                          <span className={parseFloat(usage.quantity) < 1 ? "text-destructive font-semibold" : ""}>
                            {usage.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{usage.unit}</TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-source-${usage.id}`}>
                            {usage.source === "manual" ? "Manual Entry" : usage.source === "order" ? "From Orders" : usage.source === "wastage" ? "Wastage" : usage.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(usage.usedAt).toLocaleDateString()} {new Date(usage.usedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-sm">{usage.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
