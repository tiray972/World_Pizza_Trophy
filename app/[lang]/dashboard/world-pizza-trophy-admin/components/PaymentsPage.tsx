"use client";
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Payment, User, WPTEvent, Slot } from "@/types/firestore";
import { AlertTriangle, CheckCircle2, RefreshCw, Filter, CreditCard, UserCheck, AlertOctagon } from "lucide-react";
import { formatCurrency, formatUser, cn } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface PaymentsPageProps {
  payments: Payment[];
  users: User[];
  slots: Slot[];
  selectedEvent: WPTEvent | undefined;
  onUpdateUser: (userId: string, data: Partial<User>) => void;
  onUpdatePayment: (paymentId: string, data: Partial<Payment>) => void;
}

export function PaymentsPage({ 
  payments, 
  users, 
  slots,
  selectedEvent, 
  onUpdateUser,
  onUpdatePayment
}: PaymentsPageProps) {
  
  const [filterMode, setFilterMode] = useState<'all' | 'issues'>('all');

  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          Please select an event to view financial reconciliation.
        </p>
      </div>
    );
  }

  // 1. Filter Payments by Event
  const eventPayments = payments.filter(p => p.eventId === selectedEvent.id).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  // 2. Analysis Logic
  const analyzedPayments = eventPayments.map(payment => {
    const user = users.find(u => u.id === payment.userId);
    const userRegistration = user?.registrations[selectedEvent.id];
    
    const issues: string[] = [];

    // Issue: Payment is PAID but User is NOT marked as paid
    if (payment.status === 'paid' && (!userRegistration || !userRegistration.paid)) {
      issues.push("User status is UNPAID despite payment");
    }

    // Issue: Payment amount is 0 (Suspicious)
    if (payment.amount === 0 && payment.status === 'paid' && payment.source === 'stripe') {
        issues.push("Zero amount Stripe payment");
    }

    // Issue: Payment exists but no slots assigned (Warning only, maybe they haven't picked yet)
    // Actually, payment usually reserves slots immediately. 
    // Let's check if the slots in payment.slotIds actually exist and are assigned to this user
    const slotsFound = slots.filter(s => payment.slotIds.includes(s.id));
    if (payment.slotIds.length > 0 && slotsFound.length !== payment.slotIds.length) {
        issues.push(`Missing ${payment.slotIds.length - slotsFound.length} slots in system`);
    }

    return {
      payment,
      user,
      issues,
      hasIssues: issues.length > 0
    };
  });

  // 3. Reverse Check: Users marked as PAID but no Payment found
  const ghostUsers = users.filter(u => {
      const reg = u.registrations[selectedEvent.id];
      if (!reg || !reg.paid) return false;
      
      // Look for a paid payment for this user & event
      const hasPayment = eventPayments.some(p => p.userId === u.id && p.status === 'paid');
      return !hasPayment;
  }).map(u => ({
      user: u,
      issue: "User marked PAID but no Payment Record found"
  }));


  const filteredPayments = filterMode === 'issues' 
    ? analyzedPayments.filter(i => i.hasIssues) 
    : analyzedPayments;

  const handleFixSync = (userId: string, paymentId: string) => {
    if (window.confirm("Auto-correct: Mark user as PAID based on this payment record?")) {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const currentReg = user.registrations[selectedEvent.id] || {
            paid: false,
            categoryIds: [],
            registeredAt: Timestamp.now()
        };

        onUpdateUser(userId, {
            registrations: {
                ...user.registrations,
                [selectedEvent.id]: {
                    ...currentReg,
                    paid: true,
                    paymentId: paymentId
                }
            }
        });
    }
  };

  const getSourceBadge = (source: string) => {
    switch(source) {
        case 'stripe': return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">Stripe</Badge>;
        case 'admin': return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">Admin</Badge>;
        case 'manual': return <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">Manual</Badge>;
        default: return <Badge variant="outline">{source}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Financial Reconciliation</h2>
          <p className="text-muted-foreground">Monitor payments, sources, and sync status for <strong>{selectedEvent.name}</strong>.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button 
                variant={filterMode === 'all' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterMode('all')}
            >
                All Transactions
            </Button>
            <Button 
                variant={filterMode === 'issues' ? "destructive" : "ghost"}
                size="sm"
                onClick={() => setFilterMode('issues')}
                className={filterMode === 'issues' ? "" : "text-muted-foreground"}
            >
                <AlertOctagon className="mr-2 h-4 w-4" />
                Issues ({analyzedPayments.filter(p => p.hasIssues).length + ghostUsers.length})
            </Button>
        </div>
      </div>

      {/* Ghost Users Warning */}
      {ghostUsers.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h4 className="flex items-center gap-2 text-red-800 dark:text-red-300 font-semibold mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  {ghostUsers.length} Users marked PAID without Payment Records
              </h4>
              <div className="space-y-2">
                  {ghostUsers.map(({user, issue}) => (
                      <div key={user.id} className="flex items-center justify-between text-sm bg-white dark:bg-black/20 p-2 rounded">
                          <div className="flex items-center gap-2">
                             <UserCheck className="h-4 w-4 text-red-500" />
                             <span className="font-medium">{formatUser(user)}</span>
                             <span className="text-muted-foreground">({user.email})</span>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 hover:bg-red-50 text-red-600">
                              Create Manual Record
                          </Button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transactions Log</CardTitle>
          <CardDescription>
            {filteredPayments.length} records found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left text-foreground">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">User</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Pack / Item</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Amount</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Source</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Sync Health</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0 text-foreground">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No payments found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(({ payment, user, issues, hasIssues }) => (
                    <tr key={payment.id} className={cn("border-b transition-colors hover:bg-muted/50", hasIssues && "bg-yellow-50/50 dark:bg-yellow-900/10")}>
                      <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                         {payment.createdAt.toDate().toLocaleDateString()}
                         <div className="text-xs opacity-70">{payment.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="p-4 align-middle font-medium">
                         {user ? (
                             <div className="flex flex-col">
                                 <span>{formatUser(user)}</span>
                                 <span className="text-xs text-muted-foreground">{user.email}</span>
                             </div>
                         ) : (
                             <span className="text-destructive">User Deleted ({payment.userId})</span>
                         )}
                      </td>
                      <td className="p-4 align-middle">
                          {payment.isPack ? (
                              <Badge variant="secondary" className="font-normal">{payment.packName || "Pack"}</Badge>
                          ) : (
                              <span className="text-muted-foreground">Single Items</span>
                          )}
                      </td>
                      <td className="p-4 align-middle font-mono">
                          {formatCurrency(payment.amount / 100)}
                      </td>
                      <td className="p-4 align-middle">
                          {getSourceBadge(payment.source)}
                      </td>
                      <td className="p-4 align-middle">
                          {payment.status === 'paid' ? (
                              <span className="inline-flex items-center text-green-600 dark:text-green-400 font-medium text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
                              </span>
                          ) : (
                              <Badge variant={payment.status === 'refunded' ? "secondary" : "destructive"}>
                                  {payment.status}
                              </Badge>
                          )}
                      </td>
                      <td className="p-4 align-middle">
                          {hasIssues ? (
                              <div className="flex flex-col gap-1">
                                  {issues.map((issue, idx) => (
                                      <span key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                          <AlertTriangle className="h-3 w-3" />
                                          {issue}
                                      </span>
                                  ))}
                              </div>
                          ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" /> OK
                              </span>
                          )}
                      </td>
                      <td className="p-4 align-middle text-right">
                          {hasIssues && payment.status === 'paid' && issues.some(i => i.includes("UNPAID")) && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs border-green-200 hover:bg-green-50 text-green-700"
                                onClick={() => handleFixSync(payment.userId, payment.id)}
                              >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Sync Status
                              </Button>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}