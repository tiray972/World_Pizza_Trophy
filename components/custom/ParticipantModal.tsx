'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Participant } from '@/types/firestore';
import { Checkbox } from '@/components/ui/checkbox';

interface ParticipantModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (participant: Participant) => void;
  slotInfo?: string;
  isRequired?: boolean;
  onApplyToAll?: (participant: Participant) => void;
  isPackModal?: boolean;
  onSaveParticipant?: (participant: Participant) => void; // Sauvegarde le participant dans la liste réutilisable
}

export function ParticipantModal({ 
  open, 
  onClose, 
  onConfirm, 
  slotInfo,
  isRequired = true,
  onApplyToAll,
  isPackModal = false,
  onSaveParticipant
}: ParticipantModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applyToAll, setApplyToAll] = useState(false);

  const handleConfirm = () => {
    const newErrors: Record<string, string> = {};

    if (isRequired) {
      if (!firstName.trim()) newErrors.firstName = 'Le prénom est requis';
      if (!lastName.trim()) newErrors.lastName = 'Le nom est requis';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const participant: Participant = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    };

    // 📋 Sauvegarder le participant dans la liste réutilisable
    if (onSaveParticipant) {
      onSaveParticipant(participant);
    }

    if (applyToAll && onApplyToAll && isPackModal) {
      onApplyToAll(participant);
    } else {
      onConfirm(participant);
    }

    // Reset form
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setErrors({});
    setApplyToAll(false);
  };

  const handleClose = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setErrors({});
    setApplyToAll(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Informations du Participant</DialogTitle>
          {slotInfo && (
            <DialogDescription className="text-sm text-gray-600 mt-2">
              📍 {slotInfo}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                placeholder="Jean"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors({ ...errors, firstName: '' });
                }}
                className={errors.firstName ? 'border-red-500' : ''}
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                placeholder="Dupont"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors({ ...errors, lastName: '' });
                }}
                className={errors.lastName ? 'border-red-500' : ''}
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email (optionnel)</Label>
            <Input
              id="email"
              type="email"
              placeholder="jean@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="phone">Téléphone (optionnel)</Label>
            <Input
              id="phone"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {isPackModal && onApplyToAll && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
              <Checkbox
                id="applyToAll"
                checked={applyToAll}
                onCheckedChange={(checked) => setApplyToAll(!!checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applyToAll" className="text-sm font-semibold text-blue-900 cursor-pointer">
                  ✨ Appliquer à tous les créneaux du pack
                </Label>
                <p className="text-xs text-blue-700 mt-1">
                  Utilise les mêmes informations pour tous les créneaux restants du pack
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">* Champs obligatoires</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="bg-[#8B0000] hover:bg-[#A50000]">
            {applyToAll && isPackModal ? '✨ Appliquer à tous' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
