'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Participant, TShirtSize } from '@/types/firestore';
import { Checkbox } from '@/components/ui/checkbox';

import { bookingTexts, tf } from '@/lib/i18n/booking-texts';

const T_SHIRT_SIZES: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

interface ParticipantModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (participant: Participant) => void;
  slotInfo?: string;
  isRequired?: boolean;
  onApplyToAll?: (participant: Participant) => void;
  isPackModal?: boolean;
  /** Rang du participant pour les catégories en duo (1, 2...). Non défini = catégorie solo. */
  participantIndex?: number;
  onSaveParticipant?: (participant: Participant) => void; // Sauvegarde le participant dans la liste réutilisable
  lang?: string;
}

export function ParticipantModal({ 
  open, 
  onClose, 
  onConfirm, 
  slotInfo,
  isRequired = true,
  onApplyToAll,
  isPackModal = false,
  participantIndex,
  onSaveParticipant,
  lang = 'fr',
}: ParticipantModalProps) {
  const tb = bookingTexts(lang);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shirtSize, setShirtSize] = useState<TShirtSize | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applyToAll, setApplyToAll] = useState(false);

  const handleConfirm = () => {
    const newErrors: Record<string, string> = {};

    if (isRequired) {
      if (!firstName.trim()) newErrors.firstName = tb.firstNameRequired;
      if (!lastName.trim()) newErrors.lastName = tb.lastNameRequired;
      if (!shirtSize) newErrors.shirtSize = tb.shirtRequired;
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
      shirtSize: shirtSize || undefined,
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
    setShirtSize('');
    setErrors({});
    setApplyToAll(false);
  };

  const handleClose = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setShirtSize('');
    setErrors({});
    setApplyToAll(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {participantIndex ? tf(tb.participantTitleN, { n: participantIndex }) : tb.participantTitle}
          </DialogTitle>
          {participantIndex && (
            <DialogDescription className="text-sm text-blue-700">
              {tb.participantTeamHint}
            </DialogDescription>
          )}
          {slotInfo && (
            <DialogDescription className="text-sm text-gray-600 mt-2">
              📍 {slotInfo}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">{tb.firstNameLabel}</Label>
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
              <Label htmlFor="lastName">{tb.lastNameLabel}</Label>
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
            <Label htmlFor="email">{tb.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder="jean@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="phone">{tb.phoneLabel}</Label>
            <Input
              id="phone"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="shirtSize">{tb.shirtLabel}</Label>
            <select
              id="shirtSize"
              value={shirtSize}
              onChange={(e) => {
                setShirtSize(e.target.value as TShirtSize | '');
                if (errors.shirtSize) setErrors({ ...errors, shirtSize: '' });
              }}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm ${
                errors.shirtSize ? 'border-red-500' : 'border-input'
              }`}
            >
              <option value="">{tb.chooseSize}</option>
              {T_SHIRT_SIZES.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            {errors.shirtSize && <p className="text-xs text-red-500 mt-1">{errors.shirtSize}</p>}
            <p className="text-xs text-gray-500 mt-1">
              {tb.oneShirt}
            </p>
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
                  {tb.applyToAll}
                </Label>
                <p className="text-xs text-blue-700 mt-1">
                  {tb.applyToAllHint}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">{tb.requiredFields}</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {tb.cancel}
          </Button>
          <Button onClick={handleConfirm} className="bg-[#8B0000] hover:bg-[#A50000]">
            {applyToAll && isPackModal ? tb.confirmAll : tb.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
