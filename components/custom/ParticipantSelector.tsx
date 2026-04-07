'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Participant } from '@/types/firestore';
import { ChevronDown, Plus, UserPlus } from 'lucide-react';

interface ParticipantSelectorProps {
  participants: Participant[];
  selectedParticipant: Participant | undefined;
  onSelect: (participant: Participant) => void;
  onAddNew: () => void;
  compact?: boolean;
}

export function ParticipantSelector({
  participants,
  selectedParticipant,
  onSelect,
  onAddNew,
  compact = false,
}: ParticipantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (compact) {
    return (
      <div className="relative">
        <Button
          size="sm"
          className={`w-full h-8 text-xs justify-between ${
            selectedParticipant
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-200'
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">
            {selectedParticipant
              ? `${selectedParticipant.firstName} ${selectedParticipant.lastName}`
              : 'Sélectionner participant'}
          </span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {participants.length > 0 && (
              <>
                {participants.map((p, idx) => (
                  <button
                    key={idx}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition ${
                      selectedParticipant?.firstName === p.firstName &&
                      selectedParticipant?.lastName === p.lastName
                        ? 'bg-blue-100 font-semibold'
                        : ''
                    }`}
                    onClick={() => {
                      onSelect(p);
                      setIsOpen(false);
                    }}
                  >
                    <span className="font-semibold">{p.firstName} {p.lastName}</span>
                    {p.email && <p className="text-gray-500 text-xs">{p.email}</p>}
                  </button>
                ))}
                <div className="border-t border-gray-200" />
              </>
            )}
            <button
              className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 font-semibold flex items-center gap-2 transition"
              onClick={() => {
                onAddNew();
                setIsOpen(false);
              }}
            >
              <Plus className="w-3 h-3" />
              Ajouter un nouveau
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {participants.map((p, idx) => (
          <button
            key={idx}
            className={`p-2 text-xs rounded border transition ${
              selectedParticipant?.firstName === p.firstName &&
              selectedParticipant?.lastName === p.lastName
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => onSelect(p)}
          >
            <p className="font-semibold">{p.firstName} {p.lastName}</p>
            {p.email && <p className="text-gray-500">{p.email}</p>}
          </button>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs"
        onClick={onAddNew}
      >
        <Plus className="w-3 h-3 mr-1" />
        Ajouter un participant
      </Button>
    </div>
  );
}
