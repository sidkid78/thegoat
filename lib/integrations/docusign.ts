import crypto from 'crypto';

export interface OfferDocumentParams {
  offerId: number;
  propertyAddress: string;
  buyerName: string;
  buyerEmail: string;
  offerAmount: number;
  closingDate: string;
  contingencies: string[];
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds and signs a JWT Grant assertion (RS256) for DocuSign's service
 * integration flow -- no external JWT library needed, Node's crypto module
 * signs RS256 directly. Requires the one-time admin consent to have already
 * been granted for DOCUSIGN_USER_ID (see CLAUDE.md).
 */
function buildJwtAssertion(): string {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
  const authServer = process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com';

  if (!integrationKey || !userId || !privateKey) {
    throw new Error('Missing DocuSign JWT credentials.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: authServer,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey);

  return `${signingInput}.${base64url(signature)}`;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Exchanges the JWT assertion for a short-lived access token, caching it in
 * memory for the process lifetime (serverless instances get a fresh cache
 * per cold start, which is fine -- tokens are cheap to re-request).
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const authServer = process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com';
  const assertion = buildJwtAssertion();

  const res = await fetch(`https://${authServer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DocuSign token exchange failed (${res.status}): ${body}`);
  }

  const data: { access_token: string; expires_in: number } = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

/**
 * Prepares and sends an e-signature document envelope via DocuSign REST API.
 */
export async function sendOfferContractForSignature(params: OfferDocumentParams) {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const hasJwtCredentials =
    !!accountId &&
    !!process.env.DOCUSIGN_INTEGRATION_KEY &&
    !!process.env.DOCUSIGN_USER_ID &&
    !!process.env.DOCUSIGN_PRIVATE_KEY;

  if (!hasJwtCredentials) {
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
    const accessToken = await getAccessToken();
    const res = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocuSign API returned status ${res.status}: ${body}`);
    }

    const data = await res.json();
    return {
      success: true,
      envelopeId: data.envelopeId,
      status: data.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('DocuSign error:', message);
    return {
      success: false,
      error: message,
    };
  }
}
