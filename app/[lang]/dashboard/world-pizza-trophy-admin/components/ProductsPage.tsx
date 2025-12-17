import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Product } from "../types";
import { ProductFormModal } from "./ProductFormModal";
import { Plus, Package, CreditCard, Layers } from "lucide-react";

// --- Mock Data ---

const MOCK_PRODUCTS: Product[] = [
  { 
    id: "p1", 
    name: "Single Competitor Entry", 
    description: "Standard entry fee for one pizza category. Includes apron and hat.", 
    price: 150.00, 
    slotsRequired: 1, 
    isActive: true 
  },
  { 
    id: "p2", 
    name: "Team Pack (3 Entries)", 
    description: "Discounted pack for a team of 3 pizzaiolos. Valid for any category.", 
    price: 400.00, 
    slotsRequired: 3, 
    isActive: true 
  },
  { 
    id: "p3", 
    name: "Early Bird Special", 
    description: "Limited time offer for early registrations.", 
    price: 120.00, 
    slotsRequired: 1, 
    isActive: false 
  },
];

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateProduct = async (productData: Omit<Product, "id">) => {
    // Mock API call
    console.log("POST /api/admin/products/create", productData);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const newProduct: Product = {
      ...productData,
      id: `p${Date.now()}`,
    };

    setProducts(prev => [newProduct, ...prev]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products & Packs</h2>
          <p className="text-muted-foreground">Manage entry packs and pricing.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Product
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl">{product.name}</CardTitle>
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
                  <span className="font-semibold">€{product.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span>{product.slotsRequired} Slot{product.slotsRequired !== 1 && 's'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Empty State / Add New Card Placeholder */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center hover:bg-accent/50 transition-colors"
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
    </div>
  );
}