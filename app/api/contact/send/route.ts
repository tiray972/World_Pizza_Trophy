import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    // Configuration SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email de notification à l'admin
    const adminMailOptions = {
      from: `"World Pizza Trophy" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_EMAIL || "contact@worldpizzatrophy.com",
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B0000; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #8B0000; }
            .value { margin-left: 10px; }
            .message { background: white; padding: 15px; border-left: 4px solid #8B0000; margin-top: 20px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nouveau message depuis le site</h1>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">Nom:</span>
                <span class="value">${name}</span>
              </div>
              <div class="field">
                <span class="label">Email:</span>
                <span class="value">${email}</span>
              </div>
              <div class="field">
                <span class="label">Téléphone:</span>
                <span class="value">${phone || "Non renseigné"}</span>
              </div>
              <div class="field">
                <span class="label">Sujet:</span>
                <span class="value">${subject}</span>
              </div>
              <div class="message">
                <div class="label">Message:</div>
                <p style="white-space: pre-wrap;">${message}</p>
              </div>
            </div>
            <div class="footer">
              <p>Envoyé depuis le formulaire de contact - World Pizza Trophy</p>
              <p>Date: ${new Date().toLocaleString("fr-FR")}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Nouveau message depuis le site World Pizza Trophy

Nom: ${name}
Email: ${email}
Téléphone: ${phone || "Non renseigné"}
Sujet: ${subject}

Message:
${message}

---
Envoyé le ${new Date().toLocaleString("fr-FR")}
      `,
    };

    // Email de confirmation à l'utilisateur
    const userMailOptions = {
      from: `"World Pizza Trophy" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Confirmation de votre message - World Pizza Trophy",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B0000; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            .highlight { color: #8B0000; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Merci pour votre message !</h1>
            </div>
            <div class="content">
              <p>Bonjour ${name},</p>
              <p>Nous avons bien reçu votre message concernant : <span class="highlight">${subject}</span></p>
              <p>Notre équipe vous répondra dans les plus brefs délais.</p>
              <br>
              <p>Cordialement,<br>
              <strong>L'équipe World Pizza Trophy</strong></p>
            </div>
            <div class="footer">
              <p>Email: contact@worldpizzatrophy.com</p>
              <p>Téléphone: +33 6 11 85 43 43</p>
              <p>Adresse: 8 Av. Boyer, 06500 Menton</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Bonjour ${name},

Nous avons bien reçu votre message concernant : ${subject}

Notre équipe vous répondra dans les plus brefs délais.

Cordialement,
L'équipe World Pizza Trophy

---
Email: contact@worldpizzatrophy.com
Téléphone: +33 6 11 85 43 43
Adresse: 8 Av. Boyer, 06500 Menton
      `,
    };

    // Envoi des deux emails
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(userMailOptions),
    ]);

    return NextResponse.json({
      success: true,
      message: "Email envoyé avec succès",
    });
  } catch (error) {
    console.error("Erreur envoi email:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500 }
    );
  }
}
