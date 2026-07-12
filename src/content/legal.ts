/**
 * Plain-English Privacy Policy and Terms of Use for Boughtly.
 *
 * These are drafted for Boughtly's current architecture: a fully local,
 * on-device app with no backend server and no account data leaving the phone.
 * If that ever changes (e.g. bank/Plaid sync, cloud backup, analytics SDKs),
 * these documents MUST be revisited — the "your data never leaves your device"
 * claims would no longer be true.
 *
 * NOTE FOR THE OWNER: before publishing to the App Store you should:
 *   1. Replace CONTACT_EMAIL with the address you want support/legal mail at.
 *   2. Optionally have a lawyer review — this is a solid starting draft, not
 *      formal legal advice.
 *   3. Also host the Privacy Policy at a public URL (App Store Connect and
 *      Google Play both require a link). The exact same text works.
 */

export const CONTACT_EMAIL = 'addisonballer6@gmail.com';

/** Shown as "Last updated" on both documents. */
export const LEGAL_EFFECTIVE_DATE = 'July 12, 2026';

export interface LegalSection {
  heading: string;
  /** Each string is a paragraph. Lines beginning with "• " render as bullets. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalDocKey = 'privacy' | 'terms';

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'Boughtly is built to keep your information private by default. This policy explains, in plain language, exactly what happens to your data — and what doesn’t.',
  sections: [
    {
      heading: 'The short version',
      body: [
        'Everything you put into Boughtly — your receipts, prices, photos, warranties, subscriptions, and reminders — is stored only on your own device.',
        'We do not run a server that collects it. We can’t see it, we don’t sell it, and it is never shared with anyone unless you choose to export or share it yourself.',
      ],
    },
    {
      heading: 'What we collect',
      body: [
        'Nothing is sent to us. Boughtly has no user accounts on a server and no analytics that phone home. The name and email you may enter on the welcome screen are saved on your device only, to personalize the app — they are not transmitted anywhere.',
        'Because your data lives on your device, deleting the app deletes your data. Be sure to use “Back up my data” in Settings first if you want to keep it.',
      ],
    },
    {
      heading: 'Camera and photos',
      body: [
        'When you scan a receipt or barcode, the camera image is processed on your device to read the text. Photos you attach are stored on your device with the item. They are not uploaded to us.',
      ],
    },
    {
      heading: 'Notifications',
      body: [
        'If you allow notifications, reminders (return windows closing, warranties expiring, subscription renewals, price-check nudges) are scheduled locally on your device by the operating system. We do not send push notifications from a server.',
      ],
    },
    {
      heading: 'Calendar',
      body: [
        'If you choose to add a deadline to your calendar, Boughtly writes that single event to the calendar you pick, using the access you grant. It does not read or upload your other calendar events.',
      ],
    },
    {
      heading: 'Face ID / passcode',
      body: [
        'The optional app lock uses your device’s built-in Face ID, Touch ID, or passcode. That authentication is handled entirely by your device’s operating system — Boughtly never sees or stores your biometric data.',
      ],
    },
    {
      heading: 'When you export or share',
      body: [
        'Features like backup, CSV export, the insurance PDF, and the share sheet hand a file to whatever destination you choose (Files, Mail, another app). At that point the data goes where you send it, under that service’s control — so share those files only with people and places you trust.',
      ],
    },
    {
      heading: 'Links to other companies',
      body: [
        'Boughtly links out to retailers, manufacturers, and services (for returns, warranty registration, and subscription cancellation). When you tap one, you leave Boughtly and land on that company’s own website, governed by their privacy policy — not this one. We are not affiliated with those companies and don’t control what they collect.',
      ],
    },
    {
      heading: 'Product recall information',
      body: [
        'Recall checks query publicly available government recall data (such as the U.S. Consumer Product Safety Commission). Only the product details needed to run the check are used, and only when you ask for a check.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'Boughtly is intended for adults managing their own purchases and is not directed to children under 13. We do not knowingly collect information from children.',
      ],
    },
    {
      heading: 'Your control',
      body: [
        'You can view, edit, export, or delete any of your data at any time from within the app. “Delete all items” in Settings removes everything Boughtly is tracking, and deleting the app removes the rest.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'If we update this policy, we’ll change the “Last updated” date above and, for significant changes, note it in the app. If Boughtly ever adds features that send data off your device, we’ll update this policy before turning them on.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        `Questions about privacy? Email ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDoc = {
  title: 'Terms & Disclaimer',
  intro:
    'Please read these terms before relying on Boughtly. Using the app means you agree to them.',
  sections: [
    {
      heading: 'What Boughtly is',
      body: [
        'Boughtly is a personal organizer that helps you keep track of things you’ve bought — return windows, warranties, price watches, subscriptions, and related reminders. It’s a helpful assistant, not an official record and not a party to any purchase.',
      ],
    },
    {
      heading: 'Not professional advice',
      body: [
        'Boughtly does not provide legal, financial, tax, or consumer-rights advice. Information in the app — including anything about return policies, warranty rights, or whether registration is required — is general guidance for your convenience, not a substitute for professional advice or the actual terms of your purchase.',
      ],
    },
    {
      heading: 'Verify important details yourself',
      body: [
        'Return windows, warranty terms, cancellation steps, recall notices, and prices change often and vary by store, product, and region. Boughtly’s dates and information may be incomplete, out of date, or wrong.',
        'Always confirm the details that matter — especially deadlines — directly with the retailer or manufacturer before acting. The dates Boughtly shows are estimates to help you remember, not a guarantee.',
      ],
    },
    {
      heading: 'Reminders are a convenience, not a guarantee',
      body: [
        'Reminders depend on your device and its settings. Notifications can be delayed or missed if they’re turned off, if your device is offline or powered down, or due to operating-system limits. Don’t rely on Boughtly as your only reminder for a time-sensitive deadline.',
      ],
    },
    {
      heading: 'Links and third-party services',
      body: [
        'Boughtly links you to third-party websites (retailers, manufacturers, subscription providers) to help you return items, register warranties, or cancel subscriptions. We don’t operate those sites, aren’t responsible for them, and can’t guarantee a link always points to the exact right page — companies change their sites. When a direct page isn’t certain, Boughtly may send you to a search instead so you still land somewhere useful. Any transaction you make on those sites is between you and them.',
      ],
    },
    {
      heading: 'You’re responsible for your use',
      body: [
        'You’re responsible for the accuracy of what you enter and for your own decisions — such as when to return something, cancel a subscription, or file a claim. Boughtly organizes the information; the actions are yours.',
      ],
    },
    {
      heading: 'Provided “as is”',
      body: [
        'Boughtly is provided “as is,” without warranties of any kind, express or implied, including fitness for a particular purpose. We don’t warrant that it will be uninterrupted, error-free, or that any information in it is accurate or complete.',
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        'To the fullest extent allowed by law, Boughtly and its creator are not liable for any loss arising from your use of the app — including a missed return or warranty deadline, a subscription that kept charging, reliance on inaccurate information, or lost data. Some places don’t allow certain limitations, so parts of this may not apply to you.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'We may update these terms as the app evolves. We’ll change the “Last updated” date above when we do. Continuing to use Boughtly after a change means you accept the updated terms.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        `Questions about these terms? Email ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export function getLegalDoc(key: LegalDocKey): LegalDoc {
  return key === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
}
