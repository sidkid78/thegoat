export interface OfferDocumentParams {
  offerId: number;
  propertyAddress: string;
  buyerName: string;
  buyerEmail: string;
  offerAmount: number;
  closingDate: string;
  contingencies: string[];
}

/**
 * Prepares and sends an e-signature document envelope via DocuSign REST API.
 */
export async function sendOfferContractForSignature(params: OfferDocumentParams) {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const accessToken = process.env.DOCUSIGN_CLIENT_SECRET; // Standard JWT / OAuth Token placeholder

  if (!accountId || !accessToken) {
    console.warn('DocuSign credentials missing. Simulating envelope creation...');
    return {
      success: true,
      envelopeId: `simulated-env-${Date.now()}`,
      status: 'sent',
      signingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?signing=simulated`,
    };
  }

  const documentHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1e3a8a; }
          .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>PURCHASE AND SALE AGREEMENT</h1>
        <p>This Purchase and Sale Agreement is generated via <strong>Dwellingly.ai</strong>.</p>
        <div class="summary">
          <p><strong>Property Address:</strong> ${params.propertyAddress}</p>
          <p><strong>Buyer Name:</strong> ${params.buyerName}</p>
          <p><strong>Purchase Offer Price:</strong> $${params.offerAmount.toLocaleString()}</p>
          <p><strong>Proposed Closing Date:</strong> ${params.closingDate}</p>
          <p><strong>Contingencies:</strong> ${params.contingencies.join(', ')}</p>
        </div>
        <p>By signing below, the buyer confirms intent to execute this legally binding offer.</p>
        <br/><br/>
        <p>Buyer Signature: _______________________ Date: ____________</p>
      </body>
    </html>
  `;

  const envelopeDefinition = {
    emailSubject: `Please Sign: Purchase Offer for ${params.propertyAddress}`,
    documents: [
      {
        documentBase64: Buffer.from(documentHtml).toString('base64'),
        name: 'Purchase_Agreement.html',
        fileExtension: 'html',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: params.buyerEmail,
          name: params.buyerName,
          recipientId: '1',
          routingOrder: '1',
        },
      ],
    },
    status: 'sent',
  };

  try {
    const res = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    });

    if (!res.ok) {
      throw new Error(`DocuSign API returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      envelopeId: data.envelopeId,
      status: data.status,
    };
  } catch (err: any) {
    console.error('DocuSign error:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}