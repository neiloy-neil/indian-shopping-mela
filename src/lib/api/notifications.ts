export interface TransactionalEmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  textContext?: string | undefined;
}

/**
 * Brevo Transactional Email Client
 */
export async function sendBrevoTransactionalEmail(payload: TransactionalEmailPayload): Promise<{ success: boolean; messageId?: string }> {
  const env = typeof process !== "undefined" && process.env ? process.env : {};
  const apiKey = env["BREVO_API_KEY"];
  const senderEmail = env["BREVO_SENDER_EMAIL"] ?? "orders@indianshoppingmela.com.au";
  const senderName = env["BREVO_SENDER_NAME"] ?? "Indian Shopping Mela";

  if (!apiKey) {
    console.log(`[Brevo Email Mock] To: ${payload.toEmail} | Subject: ${payload.subject}`);
    return { success: true, messageId: `mock-brevo-${Date.now()}` };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: payload.toEmail, name: payload.toName }],
        subject: payload.subject,
        htmlContent: payload.htmlContent,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Brevo API error:", errBody);
      throw new Error(`Brevo API returned status ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as any;
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error("Failed to send transactional email via Brevo:", err);
    return { success: false };
  }
}

/**
 * Send Customer Order Confirmation & Tax Invoice (Itemizing 10% Australian GST & Marketplace ABN).
 */
export async function sendOrderConfirmationEmail(params: {
  customerEmail: string;
  customerName: string;
  masterOrderId: string;
  totalAmountAud: number;
  gstTotalAud: number;
  packageCount: number;
}): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Order Confirmation — #${params.masterOrderId}</h2>
      <p>Dear ${params.customerName},</p>
      <p>Thank you for your order! Your payment of <strong>$${params.totalAmountAud.toFixed(2)} AUD</strong> has been successfully received.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Tax Invoice Summary</h3>
        <p><strong>Marketplace:</strong> Indian Shopping Mela Pty Ltd (ABN 12 345 678 901)</p>
        <p><strong>Total (GST Incl.):</strong> $${params.totalAmountAud.toFixed(2)} AUD</p>
        <p><strong>Includes 10% GST:</strong> $${params.gstTotalAud.toFixed(2)} AUD</p>
        <p><strong>Packages:</strong> ${params.packageCount} seller package(s) dispatched separately.</p>
      </div>

      <p>You will receive separate tracking links as each seller prepares and dispatches their package.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Indian Shopping Mela — Australia's Premier Indian Multi-Vendor Marketplace</p>
    </div>
  `;

  const result = await sendBrevoTransactionalEmail({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Order Confirmed: #${params.masterOrderId} — Indian Shopping Mela`,
    htmlContent,
  });

  return result.success;
}

/**
 * Send Dispatch & Tracking Notification to Customer.
 */
export async function sendPackageDispatchedEmail(params: {
  customerEmail: string;
  customerName: string;
  subOrderId: string;
  sellerBusinessName: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Your Package is On Its Way! 📦</h2>
      <p>Dear ${params.customerName},</p>
      <p><strong>${params.sellerBusinessName}</strong> has packaged and shipped your items for package <strong>#${params.subOrderId}</strong>.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Courier:</strong> ${params.carrier}</p>
        <p><strong>Tracking Number:</strong> ${params.trackingNumber}</p>
        <p><a href="${params.trackingUrl}" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Track Your Package Live</a></p>
      </div>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Once delivered, our standard 7-day change-of-mind return policy applies.</p>
    </div>
  `;

  const result = await sendBrevoTransactionalEmail({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Package Shipped: #${params.subOrderId} from ${params.sellerBusinessName}`,
    htmlContent,
  });

  return result.success;
}
