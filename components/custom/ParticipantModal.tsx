'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Participant } from '@/types/firestore';

interface ParticipantModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (participant: Participant) => void;
  slotInfo?: string; // ex: "Classique - 14h30, 15 mars"
  isRequired?: boolean;
}

export function ParticipantModal({ 
  open, 
  onClose, 
  onConfirm, 
  slotInfo,
  isRequired = true 
}: ParticipantModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    onConfirm({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    // Reset form
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setErrors({});
  };

  const handleClose = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setErrors({});
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

          <p className="text-xs text-gray-500">* Champs obligatoires</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="bg-[#8B0000] hover:bg-[#A50000]">
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
