import React, { useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Category, Slot } from "../types";
import { Plus, Edit2, Trash2, Download, AlertTriangle, FileText, Clock, Users, Eye, EyeOff, Copy, ScanEye, BarChart3 } from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { CategoryFormModal } from "./CategoryFormModal";
import { CategoryPreviewModal } from "./CategoryPreviewModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Badge } from "./ui/Badge";

interface CategoriesPageProps {
  categories: Category[];
  slots: Slot[]; // Need slots to check for dependencies before delete and calc stats
  selectedEventId: string;
  onUpdateCategory: (category: Category) => void;
  onCreateCategory: (category: Omit<Category, "id">) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export function CategoriesPage({ 
  categories, 
  slots,
  selectedEventId, 
  onUpdateCategory, 
  onCreateCategory, 
  onDeleteCategory 
}: CategoriesPageProps) {
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // New Modals State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCategory, setPreviewCategory] = useState<Category | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          Please select an event to manage categories.
        </p>
      </div>
    );
  }

  // --- HANDLERS ---
  const handleOpenCreate = () => {
    setSelectedCategory(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setSelectedCategory(category);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDuplicate = (category: Category) => {
    onCreateCategory({
        eventId: selectedEventId,
        name: `${category.name} (Copy)`,
        description: category.description,
        unitPrice: category.unitPrice,
        maxSlots: category.maxSlots,
        durationMinutes: category.durationMinutes,
        rules: category.rules || "",
        isActive: false, // Start copies as inactive draft
        activeDates: [] // Don't copy schedule
    });
  };

  const handleOpenPreview = (category: Category) => {
    setPreviewCategory(category);
    setIsPreviewOpen(true);
  };

  const initiateDelete = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
        onDeleteCategory(categoryToDelete.id);
        setIsDeleteModalOpen(false);
        setCategoryToDelete(null);
    }
  };

  const handleToggleActive = (category: Category) => {
    onUpdateCategory({
        ...category,
        isActive: !category.isActive
    });
  };

  const handleModalConfirm = (data: Partial<Category>) => {
    if (modalMode === 'create') {
      onCreateCategory({
        eventId: selectedEventId,
        name: data.name!,
        description: data.description!,
        unitPrice: data.unitPrice!,
        maxSlots: data.maxSlots!,
        durationMinutes: data.durationMinutes!,
        rules: data.rules || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        activeDates: []
      });
    } else if (modalMode === 'edit' && selectedCategory) {
      onUpdateCategory({
        ...selectedCategory,
        ...data
      });
    }
    setIsModalOpen(false);
  };

  const handleExport = () => {
    const headers = "id,name,description,unitPrice,maxSlots,durationMinutes,rules,isActive\n";
    const rows = categories.map(c => 
      `${c.id},"${c.name}","${c.description}",${c.unitPrice},${c.maxSlots},${c.durationMinutes},"${c.rules || ''}",${c.isActive}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wpt_categories_${selectedEventId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStats = (catId: string) => {
      const catSlots = slots.filter(s => s.categoryId === catId);
      const total = catSlots.length;
      const booked = catSlots.filter(s => s.status !== 'available').length;
      const percentage = total > 0 ? Math.round((booked / total) * 100) : 0;
      return { total, booked, percentage };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competition Categories</h2>
          <p className="text-muted-foreground">Define categories, prices, and limits for this event.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        {categories.length === 0 ? (
             <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
                 No categories found for this event. Add one to get started.
             </div>
        ) : (
            categories.map(category => {
                const stats = getStats(category.id);
                const canDelete = stats.total === 0;

                return (
                    <Card key={category.id} className={cn("overflow-hidden transition-all", !category.isActive && "opacity-75 bg-muted/30 border-dashed")}>
                        <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row md:items-stretch">
                                {/* Left: Info */}
                                <div className="flex-1 p-6 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-xl flex items-center gap-2">
                                            {category.name}
                                        </h3>
                                        {!category.isActive ? (
                                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                                        ) : (
                                            <Badge variant="success" className="text-xs">Active</Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {formatCurrency(category.unitPrice)}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                                    
                                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            <span>{category.durationMinutes} min</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>Max {category.maxSlots} per day</span>
                                        </div>
                                        {category.rules && (
                                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                                <FileText className="h-4 w-4" />
                                                <span className="truncate max-w-[200px]">Rules attached</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Middle: Stats Dashboard */}
                                <div className="flex flex-col justify-center px-6 py-4 border-t md:border-t-0 md:border-l bg-muted/10 min-w-[200px]">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        <BarChart3 className="h-3 w-3" />
                                        Performance
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Occupancy</span>
                                            <span className="font-medium">{stats.percentage}%</span>
                                        </div>
                                        {/* Simple Progress Bar */}
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary transition-all duration-500" 
                                                style={{ width: `${stats.percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                                            <span>{stats.booked} booked</span>
                                            <span>{stats.total} total slots</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex flex-row md:flex-col items-center justify-center gap-2 p-4 border-t md:border-t-0 md:border-l bg-muted/20">
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleToggleActive(category)}
                                            title={category.isActive ? "Deactivate" : "Activate"}
                                            className="h-8 w-8"
                                        >
                                            {category.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                        </Button>

                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleOpenPreview(category)}
                                            title="Public Preview (Booking View)"
                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                        >
                                            <ScanEye className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDuplicate(category)}
                                            title="Duplicate Category"
                                            className="h-8 w-8"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>

                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleOpenEdit(category)}
                                            title="Edit Details"
                                            className="h-8 w-8"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className={cn("h-8 w-8 mt-1", canDelete ? "text-destructive hover:bg-destructive/10" : "opacity-20 cursor-not-allowed")}
                                        onClick={() => canDelete && initiateDelete(category)}
                                        disabled={!canDelete}
                                        title={!canDelete ? `${stats.total} slots exist. Delete slots first.` : "Delete Category"}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>

      <CategoryFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        initialData={selectedCategory}
        mode={modalMode}
      />

      <CategoryPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        category={previewCategory}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => confirmDelete()}
        title="Delete Category?"
        description={
            <span>
                Are you sure you want to delete <strong>{categoryToDelete?.name}</strong>? 
                This action is irreversible.
            </span>
        }
      />
    </div>
  );
}