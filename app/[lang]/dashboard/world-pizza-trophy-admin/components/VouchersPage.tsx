import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Voucher } from "../types";
import { VoucherFormModal } from "./VoucherFormModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Plus, Tag, Copy, CalendarOff, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface VouchersPageProps {
  vouchers: Voucher[];
  selectedEventId: string;
  onCreateVoucher: (voucherData: Omit<Voucher, "id">) => Promise<void>;
  onDeleteVoucher: (voucherId: string) => Promise<void>;
}

export function VouchersPage({ vouchers, selectedEventId, onCreateVoucher, onDeleteVoucher }: VouchersPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null);

  const handleCreateVoucher = async (voucherData: Omit<Voucher, "id" | "isUsed" | "userId" | "createdAt" | "eventId">) => {
    if (!selectedEventId) return;
    
    await onCreateVoucher({
      ...voucherData,
      eventId: selectedEventId,
      isUsed: false,
      userId: null,
      createdAt: Timestamp.now()
    });
  };

  const initiateDelete = (voucher: Voucher) => {
    setVoucherToDelete(voucher);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (voucherToDelete) {
      await onDeleteVoucher(voucherToDelete.id);
      setIsDeleteModalOpen(false);
      setVoucherToDelete(null);
    }
  };

  const getStatus = (voucher: Voucher) => {
    if (voucher.isSingleUse && voucher.isUsed) return { label: "Used", variant: "secondary" as const };
    
    if (voucher.expiresAt) {
      if (voucher.expiresAt.toDate() < new Date()) return { label: "Expired", variant: "destructive" as const };
    }
    
    return { label: "Active", variant: "success" as const };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return null;
    return ts.toDate().toLocaleDateString();
  };

  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          Please select an event to manage vouchers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Vouchers</h2>
          <p className="text-muted-foreground">Manage promo codes and discount vouchers for this event.</p>
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
            {vouchers.length} codes generated for the current event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left text-foreground">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Code</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Product ID</th>
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
                      No vouchers found for this event.
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
                        <td className="p-4 align-middle text-foreground">{voucher.productId}</td>
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
                            <span>{formatDate(voucher.expiresAt)}</span>
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
                          <div className="flex items-center justify-end gap-1">
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
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => initiateDelete(voucher)}
                                title="Delete Voucher"
                                disabled={voucher.isUsed} // Prevent deleting used vouchers
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
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

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Voucher?"
        description={
            <span>
                Are you sure you want to delete voucher code <strong>{voucherToDelete?.code}</strong>?
            </span>
        }
      />
    </div>
  );
}