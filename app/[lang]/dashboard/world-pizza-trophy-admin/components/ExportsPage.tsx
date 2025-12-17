import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Download, FileSpreadsheet, CheckCircle2, Loader2, Link as LinkIcon, RefreshCw, ExternalLink, Grid } from "lucide-react";
import { cn } from "../lib/utils";
import { Slot } from "../types";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  filename: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "schedule",
    title: "Competition Schedule",
    description: "Export the full schedule including all days, time slots, categories, and assigned competitors.",
    endpoint: "/api/admin/exports/schedule",
    filename: "wpt_schedule_export.csv"
  },
  {
    id: "payments",
    title: "Payments & Financials",
    description: "Detailed report of user registration fees, product purchases, and outstanding balances.",
    endpoint: "/api/admin/exports/payments",
    filename: "wpt_payments_export.csv"
  },
  {
    id: "users",
    title: "Competitor Database",
    description: "List of all registered users with contact details and registration status.",
    endpoint: "/api/admin/exports/users",
    filename: "wpt_users_export.csv"
  }
];

interface ExportsPageProps {
  slots: Slot[];
}

export function ExportsPage({ slots }: ExportsPageProps) {
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [successState, setSuccessState] = useState<Record<string, boolean>>({});
  
  // Google Sheets State - We use local state to mock the "connected" status
  const [isSheetConnected, setIsSheetConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Map the REAL app data to the "Sheet" row format
  // Sort by date and then by startTime for a realistic schedule view
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const handleExport = async (option: ExportOption) => {
    setLoadingState(prev => ({ ...prev, [option.id]: true }));
    setSuccessState(prev => ({ ...prev, [option.id]: false }));

    try {
      // Mock API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockCsvContent = `id,generated_at,type\n${Date.now()},${new Date().toISOString()},${option.id}`;
      const blob = new Blob([mockCsvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = option.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccessState(prev => ({ ...prev, [option.id]: true }));
      setTimeout(() => {
        setSuccessState(prev => ({ ...prev, [option.id]: false }));
      }, 3000);

    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setLoadingState(prev => ({ ...prev, [option.id]: false }));
    }
  };

  const handleConnectSheet = () => {
    // Simulate OAuth flow
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      "", 
      "Connect Google Sheets", 
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (popup) {
      popup.document.write(`
        <html>
          <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5;">
            <h2 style="color: #444;">Google Workspace</h2>
            <p>Connecting WPT Admin to Google Sheets...</p>
            <div style="margin-top: 20px; color: green;">Success! Closing window...</div>
          </body>
        </html>
      `);
      setTimeout(() => {
        popup.close();
        setIsSheetConnected(true);
        setLastSynced("Just now");
      }, 1500);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLastSynced(new Date().toLocaleTimeString());
    setIsSyncing(false);
  };

  const openFakeLink = () => {
    // In a real app, this would be the actual spreadsheet URL
    window.open("https://docs.google.com/spreadsheets", "_blank");
  };

  return (
    <div className="space-y-8">
      {/* Integration Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Integrations</h2>
        <Card className={cn("border-l-4 overflow-hidden", isSheetConnected ? "border-l-green-500" : "border-l-blue-500")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-md", isSheetConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30")}>
                   <FileSpreadsheet className={cn("h-6 w-6", isSheetConnected ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400")} />
                </div>
                <div>
                  <CardTitle>Google Sheets Live Sync</CardTitle>
                  <CardDescription>
                    Automatically update a Master Google Sheet when slots are assigned.
                  </CardDescription>
                </div>
              </div>
              {isSheetConnected && (
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isSheetConnected ? (
               <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-6 rounded-lg border border-dashed">
                 <p className="text-sm text-muted-foreground flex-1">
                   Connect your Google Workspace account to enable two-way synchronization. 
                   Any change to "Offered" or "Paid" slots will instantly reflect in your shared spreadsheet.
                 </p>
                 <Button onClick={handleConnectSheet} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                   <LinkIcon className="mr-2 h-4 w-4" />
                   Connect Google Account
                 </Button>
               </div>
            ) : (
              <div className="space-y-6">
                 {/* Connection Info Bar */}
                 <div className="flex items-center justify-between text-sm p-4 bg-muted/30 rounded-md border">
                    <div className="flex items-center gap-3">
                      <div className="bg-white dark:bg-zinc-800 p-1.5 rounded border shadow-sm">
                        <Grid className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Linked Spreadsheet</span>
                          <button 
                            onClick={openFakeLink}
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            WPT_Master_Schedule_2024
                            <ExternalLink className="h-3 w-3" />
                          </button>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-muted-foreground">Last synchronized</div>
                       <div className="font-medium">{lastSynced || "Just now"}</div>
                    </div>
                 </div>

                 {/* LIVE PREVIEW WINDOW - DYNAMICALLY RENDERED FROM PROPS */}
                 <div className="border rounded-md overflow-hidden shadow-sm bg-background">
                    {/* Mock Toolbar */}
                    <div className="bg-gray-50 dark:bg-zinc-900 border-b px-3 py-2 flex items-center gap-4 overflow-x-auto">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="font-bold text-green-700 dark:text-green-500">Sheet1</span>
                            <span className="text-muted-foreground/50 mx-1">|</span>
                            <span className="font-mono">FX: =VLOOKUP(A2:B2)</span>
                        </div>
                        <div className="ml-auto flex gap-2">
                             <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                        </div>
                    </div>

                    {/* Sheet Grid */}
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className="w-10 bg-gray-100 dark:bg-zinc-800 border text-center text-xs text-muted-foreground font-normal"></th>
                                    <th className="w-24 bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">A (Date)</th>
                                    <th className="w-32 bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">B (Start)</th>
                                    <th className="w-32 bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">C (End)</th>
                                    <th className="w-48 bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">D (Category)</th>
                                    <th className="w-32 bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">E (Status)</th>
                                    <th className="min-w-[150px] bg-gray-100 dark:bg-zinc-800 border px-2 py-1 text-left text-xs font-semibold text-muted-foreground">F (Competitor)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Data Rows */}
                                {sortedSlots.map((slot, idx) => (
                                    <tr key={slot.id} className="border-b hover:bg-muted/30">
                                        <td className="bg-gray-100 dark:bg-zinc-800 border-r text-center text-xs text-muted-foreground">{idx + 2}</td>
                                        <td className="border-r px-2 py-1 text-xs text-foreground text-center whitespace-nowrap">{slot.date}</td>
                                        <td className="border-r px-2 py-1 text-xs text-foreground font-mono">{slot.startTime}</td>
                                        <td className="border-r px-2 py-1 text-xs text-foreground font-mono">{slot.endTime}</td>
                                        <td className="border-r px-2 py-1 text-xs text-foreground">{slot.category}</td>
                                        <td className="border-r px-2 py-1 text-xs">
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                                                slot.status === 'paid' ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                                slot.status === 'offered' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                                                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                            )}>
                                                {slot.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1 text-xs font-medium text-foreground">
                                          {slot.userFullName || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>

                 <div className="flex justify-end gap-2 pt-2">
                   <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setIsSheetConnected(false)}>
                     Disconnect
                   </Button>
                   <Button size="sm" onClick={handleManualSync} disabled={isSyncing} className="min-w-[140px]">
                     {isSyncing ? (
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     ) : (
                       <RefreshCw className="mr-2 h-4 w-4" />
                     )}
                     {isSyncing ? "Syncing..." : "Force Sync Now"}
                   </Button>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">CSV Exports</h2>
        <p className="text-muted-foreground mb-6">Download static reports and data.</p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EXPORT_OPTIONS.map((option) => (
            <Card key={option.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <CardDescription className="flex-1">
                  {option.description}
                </CardDescription>
                
                <div className="mt-auto pt-2">
                  <Button 
                    className={cn(
                      "w-full transition-all duration-300",
                      successState[option.id] ? "bg-green-600 hover:bg-green-700 text-white" : ""
                    )}
                    onClick={() => handleExport(option)}
                    disabled={loadingState[option.id]}
                  >
                    {loadingState[option.id] ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : successState[option.id] ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Downloaded
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </>
                    )}
                  </Button>
                  {successState[option.id] && (
                    <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2 animate-in fade-in slide-in-from-top-1">
                      File downloaded successfully.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}