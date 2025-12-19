import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Product } from "../types";
import { ProductFormModal } from "./ProductFormModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Plus, CreditCard, Layers, Utensils, AlertTriangle, Trash2 } from "lucide-react";
import { formatCurrency } from "../lib/utils";

interface ProductsPageProps {
  products: Product[];
  selectedEventId: string;
  onCreateProduct: (productData: Omit<Product, "id">) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

export function ProductsPage({ products, selectedEventId, onCreateProduct, onDeleteProduct }: ProductsPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const handleCreateProduct = async (productData: Omit<Product, "id" | "eventId">) => {
    if (!selectedEventId) {
        console.error("No event selected");
        return;
    }
    // The modal gives us data without eventId, the parent/handler appends it
    await onCreateProduct({
        ...productData,
        eventId: selectedEventId
    });
  };

  const initiateDelete = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await onDeleteProduct(productToDelete.id);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          Please select an event to manage products.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products & Packs</h2>
          <p className="text-muted-foreground">Manage entry packs for the selected event.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Product
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col relative group">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl pr-8">{product.name}</CardTitle>
                <Badge variant={product.isActive ? "default" : "secondary"}>
                  {product.isActive ? "Active" : "Draft"}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                {product.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center space-x-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{formatCurrency(product.unitAmount / 100)}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span>{product.slotsRequired} Slot{product.slotsRequired !== 1 && 's'}</span>
                </div>
                {product.includesMeal && (
                  <div className="flex items-center space-x-2 text-sm col-span-2">
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                    <span>Includes Meal</span>
                  </div>
                )}
              </div>
            </CardContent>
            
            {/* Delete Button (Always visible now for better usability) */}
            <div className="absolute top-4 right-14">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      initiateDelete(product);
                    }}
                    title="Delete Product"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
          </Card>
        ))}
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center hover:bg-accent/50 transition-colors h-full min-h-[250px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Add New Product</h3>
          <p className="text-sm text-muted-foreground mt-1">Create a new entry pack</p>
        </button>
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCreateProduct}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Product?"
        description={
          <span>
            Are you sure you want to delete <strong>{productToDelete?.name}</strong>? 
            This will likely affect reporting if users have already purchased it.
          </span>
        }
      />
    </div>
  );
}