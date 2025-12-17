import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Voucher } from "../types";
import { VoucherFormModal } from "./VoucherFormModal";
import { Plus, Tag, Copy, CalendarOff } from "lucide-react";
import { cn } from "../lib/utils";

// --- Mock Data ---

const MOCK_VOUCHERS: Voucher[] = [
  { 
    id: "v1", 
    code: "WELCOME2024", 
    productName: "Single Competitor Entry", 
    isSingleUse: false, 
    isUsed: false,
    expiresAt: "2024-12-31" 
  },
  { 
    id: "v2", 
    code: "VIP-GUEST-001", 
    productName: "VIP Pass", 
    isSingleUse: true, 
    isUsed: true 
  },
  { 
    id: "v3", 
    code: "EARLYBIRD10", 
    productName: "Early Bird Special", 
    isSingleUse: true, 
    isUsed: false,
    expiresAt: "2023-01-01" // Expired
  },
];

export function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>(MOCK_VOUCHERS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateVoucher = async (voucherData: Omit<Voucher, "id" | "isUsed">) => {
    // Mock API call
    console.log("POST /api/admin/vouchers/create", voucherData);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const newVoucher: Voucher = {
      ...voucherData,
      id: `v${Date.now()}`,
      isUsed: false,
    };

    setVouchers(prev => [newVoucher, ...prev]);
  };

  const getStatus = (voucher: Voucher) => {
    if (voucher.isSingleUse && voucher.isUsed) return { label: "Used", variant: "secondary" as const };
    
    if (voucher.expiresAt) {
      const today = new Date().toISOString().split('T')[0];
      if (voucher.expiresAt < today) return { label: "Expired", variant: "destructive" as const };
    }
    
    return { label: "Active", variant: "success" as const };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Vouchers</h2>
          <p className="text-muted-foreground">Manage promo codes and discount vouchers.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Voucher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vouchers</CardTitle>
          <CardDescription>
            {vouchers.length} codes generated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left text-foreground">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Code</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Product</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Type</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Expires</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0 text-foreground">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No vouchers found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((voucher) => {
                    const status = getStatus(voucher);
                    return (
                      <tr key={voucher.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium text-foreground">
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-foreground">{voucher.code}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-foreground">{voucher.productName}</td>
                        <td className="p-4 align-middle">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            voucher.isSingleUse 
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                          )}>
                            {voucher.isSingleUse ? "Single Use" : "Multi Use"}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-foreground">
                          {voucher.expiresAt ? (
                            <span>{voucher.expiresAt}</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <CalendarOff className="h-3 w-3" />
                              Never
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => copyToClipboard(voucher.code)}
                            title="Copy Code"
                            className="h-8 w-8 text-muted-foreground"
                          >
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Copy</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <VoucherFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCreateVoucher}
      />
    </div>
  );
}