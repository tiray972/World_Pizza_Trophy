import nodemailer from "nodemailer";

type ParticipantSummary = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  shirtSize?: string;
};

type MealGuestSummary = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isParticipant?: boolean;
};

type PaymentNotificationInput = {
  userEmail: string;
  userName?: string;
  adminEmail?: string;
  eventName?: string;
  amount: number;
  sessionId: string;
  isPack: boolean;
  packName?: string;
  slotCount: number;
  participants: ParticipantSummary[];
  mealGuests: MealGuestSummary[];
  mealPrice: number;
  mealQuantity: number;
};

const DEFAULT_ADMIN_EMAIL = "voyageur.voyageur@gmail.com";

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildList(items: string[]) {
  if (items.length === 0) return "<li>Aucun détail renseigné</li>";
  return items.map(item => `<li>${item}</li>`).join("");
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPaymentNotifications(input: PaymentNotificationInput) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("⚠️ SMTP non configuré: emails de paiement non envoyés.");
    return;
  }

  const adminEmail =
    input.adminEmail ||
    process.env.PAYMENT_ALERT_EMAIL ||
    process.env.CONTACT_EMAIL ||
    DEFAULT_ADMIN_EMAIL;

  const participantItems = input.participants.map(participant =>
    `${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)} - T-shirt ${escapeHtml(participant.shirtSize || "non renseigné")}${participant.email ? ` - ${escapeHtml(participant.email)}` : ""}`
  );
  const mealItems = input.mealGuests.map(guest =>
    `${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}${guest.isParticipant ? " (participant)" : " (accompagnant)"}`
  );
  const eventName = escapeHtml(input.eventName || "World Pizza Trophy");
  const userName = escapeHtml(input.userName || input.userEmail);
  const amount = input.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const mealTotal = (input.mealPrice * input.mealQuantity).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const sharedSummary = `
    <p><strong>Événement:</strong> ${eventName}</p>
    <p><strong>Montant payé:</strong> ${amount}</p>
    <p><strong>Créneaux:</strong> ${input.slotCount}</p>
    ${input.isPack ? `<p><strong>Pack:</strong> ${escapeHtml(input.packName || "Pack")}</p>` : ""}
    <p><strong>Session Stripe:</strong> ${escapeHtml(input.sessionId)}</p>
    <h3>Participants</h3>
    <ul>${buildList(participantItems)}</ul>
    <h3>Repas</h3>
    <p>${input.mealQuantity} repas, total repas ${mealTotal}</p>
    <ul>${buildList(mealItems)}</ul>
  `;

  const htmlShell = (title: string, content: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: #8B0000; color: white; padding: 18px; text-align: center; }
          .content { background: #f9f9f9; padding: 24px; margin-top: 16px; }
          h3 { color: #8B0000; margin-bottom: 8px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>${title}</h1></div>
          <div class="content">${content}</div>
          <div class="footer">World Pizza Trophy - ${new Date().toLocaleString("fr-FR")}</div>
        </div>
      </body>
    </html>
  `;

  const transporter = createTransporter();

  await Promise.all([
    transporter.sendMail({
      from: `"World Pizza Trophy" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `[WPT] Nouveau paiement confirmé - ${input.userEmail}`,
      html: htmlShell("Nouveau paiement confirmé", `<p><strong>Inscrit:</strong> ${userName} (${escapeHtml(input.userEmail)})</p>${sharedSummary}`),
    }),
    transporter.sendMail({
      from: `"World Pizza Trophy" <${process.env.SMTP_USER}>`,
      to: input.userEmail,
      subject: "Votre inscription World Pizza Trophy est confirmée",
      html: htmlShell(
        "Inscription confirmée",
        `<p>Bonjour ${userName},</p><p>Votre paiement a bien été reçu et votre inscription est enregistrée.</p>${sharedSummary}<p>Conservez cet email comme récapitulatif.</p>`
      ),
    }),
  ]);
}
