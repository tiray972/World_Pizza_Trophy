"use client";
import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { CheckCircle, Loader2, Mail, Send, X, FlaskConical } from "lucide-react";

interface PreviewData {
  eventName: string;
  recipientCount: number;
  participantCount: number;
  skipped: string[];
  sample: { to: string; subject: string; html: string } | null;
  lastMailing: { startedAt: string | null; sent: number; failed: number; total: number; status: string } | null;
}

interface Progress {
  total: number;
  sent: number;
  failures: { email: string; error: string }[];
  done: boolean;
}

async function callApi(body: Record<string, unknown>) {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error("Session expirée, reconnectez-vous.");
  const response = await fetch("/api/admin/send-schedules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erreur inconnue");
  return data;
}

/**
 * 📧 Envoie à chaque participant son programme de passage (catégorie, date,
 * heure). Aperçu et test obligatoires en amont, confirmation tapée, envoi par
 * lots avec suivi de progression.
 */
export function ScheduleMailingCard({ eventId }: { eventId: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const openPreview = async () => {
    setIsLoadingPreview(true);
    setTestResult(null);
    setProgress(null);
    try {
      setPreview(await callApi({ eventId, mode: "preview" }));
    } catch (error) {
      alert(`Impossible de préparer l'envoi.\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const sendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const result = await callApi({ eventId, mode: "test" });
      setTestResult(`✅ Email de test envoyé à ${result.sentTo} (programme de ${result.previewOf}).`);
    } catch (error) {
      setTestResult(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const sendAll = async () => {
    if (!preview) return;
    let offset: number | null = 0;
    let mailingId: string | undefined;
    const state: Progress = { total: preview.recipientCount, sent: 0, failures: [], done: false };
    setProgress({ ...state });

    // Un lot par appel : la page suit la progression en direct
    while (offset !== null) {
      const result: { mailingId: string; total: number; sent: number; failures: Progress["failures"]; nextOffset: number | null } =
        await callApi({ eventId, mode: "send", offset, mailingId });
      mailingId = result.mailingId;
      state.total = result.total;
      state.sent += result.sent;
      state.failures = [...state.failures, ...result.failures];
      offset = result.nextOffset;
      setProgress({ ...state });
    }

    state.done = true;
    setProgress({ ...state });
  };

  const isSending = !!progress && !progress.done;
  const lastMailing = preview?.lastMailing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Envoyer les programmes de passage
        </CardTitle>
        <CardDescription>
          Chaque participant reçoit par email son programme : catégories, dates et horaires de passage.
          Aucune mention de paiement ni d&apos;offre. Les participants sans email reçoivent leur programme sur
          l&apos;adresse du compte qui les a inscrits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={openPreview} disabled={isLoadingPreview}>
          {isLoadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Préparer l&apos;envoi
        </Button>
      </CardContent>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isSending && setPreview(null)} />
          <div className="fixed z-50 grid w-full max-w-3xl gap-4 border bg-card p-6 shadow-lg sm:rounded-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Programmes de passage — {preview.eventName}</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreview(null)} disabled={isSending}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Chiffres clés */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{preview.recipientCount}</p>
                <p className="text-xs text-muted-foreground">emails à envoyer</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{preview.participantCount}</p>
                <p className="text-xs text-muted-foreground">participants</p>
              </div>
              <div className={`rounded-lg border p-3 ${preview.skipped.length ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                <p className="text-2xl font-bold">{preview.skipped.length}</p>
                <p className="text-xs text-muted-foreground">sans aucune adresse</p>
              </div>
            </div>

            {preview.skipped.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Ne recevront rien (aucun email, ni le leur ni celui de l&apos;acheteur) : {preview.skipped.join(", ")}
              </p>
            )}

            {lastMailing && (
              <p className="text-sm rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-blue-800 dark:text-blue-300">
                ℹ️ Dernier envoi :{" "}
                {lastMailing.startedAt ? new Date(lastMailing.startedAt).toLocaleString("fr-FR") : "date inconnue"} —{" "}
                {lastMailing.sent}/{lastMailing.total} emails envoyés
                {lastMailing.failed ? `, ${lastMailing.failed} échec(s)` : ""}
                {lastMailing.status === "running" ? " (interrompu ou en cours)" : ""}. Un nouvel envoi renverra le
                programme à tout le monde.
              </p>
            )}

            {/* Aperçu de l'email réel */}
            {preview.sample ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Aperçu — email destiné à <strong>{preview.sample.to}</strong> · Objet : « {preview.sample.subject} »
                </p>
                <iframe
                  title="Aperçu de l'email"
                  srcDoc={preview.sample.html}
                  className="w-full h-80 rounded-md border bg-white"
                  sandbox=""
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun passage confirmé pour l&apos;instant : rien à envoyer.</p>
            )}

            {testResult && <p className="text-sm">{testResult}</p>}

            {/* Progression */}
            {progress && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span>{progress.done ? "Envoi terminé" : "Envoi en cours… ne fermez pas cette page"}</span>
                  <span className="font-semibold">
                    {progress.sent + progress.failures.length} / {progress.total}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{
                      width: `${progress.total ? ((progress.sent + progress.failures.length) / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {progress.done && (
                  <p className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    {progress.sent} email(s) envoyé(s)
                    {progress.failures.length ? `, ${progress.failures.length} échec(s)` : ""}.
                  </p>
                )}
                {progress.failures.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {progress.failures.map((failure, index) => (
                      <li key={index}>
                        {failure.email} — {failure.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={isSending}>
                {progress?.done ? "Fermer" : "Annuler"}
              </Button>
              <Button variant="outline" onClick={sendTest} disabled={!preview.sample || isSendingTest || isSending}>
                {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                M&apos;envoyer un test
              </Button>
              <Button
                onClick={() => setIsConfirmOpen(true)}
                disabled={!preview.sample || isSending || !!progress?.done}
                className="bg-[#8B0000] hover:bg-[#A50000] text-white"
              >
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Envoyer à tous ({preview.recipientCount})
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={async () => {
          setIsConfirmOpen(false);
          try {
            await sendAll();
          } catch (error) {
            setProgress(previous => (previous ? { ...previous, done: true } : previous));
            alert(
              "L'envoi s'est interrompu. Les emails déjà partis le restent ; un nouvel envoi renverra tout.\n\n" +
                (error instanceof Error ? error.message : String(error))
            );
          }
        }}
        title="Envoyer les programmes à tous ?"
        description={
          <>
            Chaque participant va recevoir son programme de passage par email. Un email envoyé ne peut pas être
            rappelé. Pensez à vous envoyer un test avant.
          </>
        }
        details={[
          { label: "Emails", value: preview?.recipientCount ?? 0 },
          { label: "Participants", value: preview?.participantCount ?? 0 },
          { label: "Sans adresse (ignorés)", value: preview?.skipped.length ?? 0 },
        ]}
        confirmLabel="Envoyer maintenant"
        tone="danger"
        confirmationPhrase="ENVOYER"
      />
    </Card>
  );
}
