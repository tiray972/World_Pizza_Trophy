"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { AnalyticsSummary, PageView, TrackingEvent } from "@/types/firestore";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MousePointer,
  Smartphone,
  Globe,
  Clock,
  Calendar,
  Download,
  Loader2,
} from "lucide-react";

interface AnalyticsPageProps {
  summary: AnalyticsSummary | null;
  pageViews: PageView[];
  events: TrackingEvent[];
  loading: boolean;
}

const TIME_RANGES = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

export function AnalyticsPage({ summary, pageViews, events, loading }: AnalyticsPageProps) {
  const [timeRange, setTimeRange] = useState(30);

  // Calculate stats from data
  const stats = useMemo(() => {
    if (!summary) return null;

    const avgSessionDuration = pageViews.length > 0
      ? Math.round(pageViews.reduce((acc, pv) => acc + (pv.loadTime || 0), 0) / pageViews.length / 1000)
      : 0;

    return {
      ...summary,
      avgSessionDuration,
    };
  }, [summary, pageViews]);

  // Export data to CSV
  const exportToCSV = () => {
    const csvContent = [
      ["Type", "Date", "Session", "Path", "Metadata"].join(","),
      ...events.map(e => [
        e.eventType,
        e.timestamp.toISOString(),
        e.sessionId,
        e.path,
        JSON.stringify(e.metadata || {}),
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `analytics_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-muted p-4 rounded-full text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Aucune donnee disponible</h3>
        <p className="text-muted-foreground max-w-sm">
          Les donnees de tracking seront collectees automatiquement des que les visiteurs commenceront a naviguer sur le site.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Statistiques de visite et comportement utilisateur
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range.days
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pages vues</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPageViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Sur {timeRange} jours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visiteurs uniques</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueVisitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Sessions distinctes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evenements</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Clics et interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps moyen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSessionDuration}s</div>
            <p className="text-xs text-muted-foreground">
              Duree par page
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Page Views by Date */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pages vues par jour
            </CardTitle>
            <CardDescription>
              Evolution du trafic sur la periode
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.viewsByDate.length > 0 ? (
              <div className="space-y-2">
                {stats.viewsByDate.slice(-10).map((day) => {
                  const maxViews = Math.max(...stats.viewsByDate.map(d => d.views));
                  const percentage = maxViews > 0 ? (day.views / maxViews) * 100 : 0;
                  return (
                    <div key={day.date} className="flex items-center gap-4">
                      <div className="w-20 text-sm text-muted-foreground">
                        {new Date(day.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                      <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full bg-primary/80 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-medium text-right">
                        {day.views}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Pas encore de donnees disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Pages populaires
            </CardTitle>
            <CardDescription>
              Les pages les plus consultees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topPages.length > 0 ? (
              <div className="space-y-2">
                {stats.topPages.map((page, index) => {
                  const maxViews = Math.max(...stats.topPages.map(p => p.views));
                  const percentage = maxViews > 0 ? (page.views / maxViews) * 100 : 0;
                  return (
                    <div key={page.path} className="flex items-center gap-4">
                      <div className="w-6 text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {page.path === "/" ? "Accueil" : page.path}
                        </div>
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full bg-secondary/80 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-medium text-right">
                        {page.views}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Pas encore de donnees disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Appareils
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.devices.length > 0 ? (
              <div className="space-y-3">
                {stats.devices.map((device) => {
                  const total = stats.devices.reduce((acc, d) => acc + d.count, 0);
                  const percentage = total > 0 ? (device.count / total) * 100 : 0;
                  return (
                    <div key={device.device} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{device.device}</span>
                        <span className="text-muted-foreground">{Math.round(percentage)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Pas de donnees
              </div>
            )}
          </CardContent>
        </Card>

        {/* Browsers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Navigateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.browsers.length > 0 ? (
              <div className="space-y-3">
                {stats.browsers.map((browser) => {
                  const total = stats.browsers.reduce((acc, b) => acc + b.count, 0);
                  const percentage = total > 0 ? (browser.count / total) * 100 : 0;
                  return (
                    <div key={browser.browser} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{browser.browser}</span>
                        <span className="text-muted-foreground">{Math.round(percentage)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Pas de donnees
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Evenements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topEvents.length > 0 ? (
              <div className="space-y-3">
                {stats.topEvents.map((event) => {
                  const total = stats.topEvents.reduce((acc, e) => acc + e.count, 0);
                  const percentage = total > 0 ? (event.count / total) * 100 : 0;
                  return (
                    <div key={event.type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{event.type.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">{event.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Pas de donnees
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Evenements recents
          </CardTitle>
          <CardDescription>
            Dernieres actions utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Page</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 20).map((event) => (
                    <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className="capitalize">
                          {event.eventType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-sm text-muted-foreground">
                        {event.timestamp.toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-2 text-sm font-mono truncate max-w-[200px]">
                        {event.path}
                      </td>
                      <td className="py-2 px-2 text-sm text-muted-foreground font-mono">
                        {event.sessionId.slice(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Aucun evenement enregistre
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
