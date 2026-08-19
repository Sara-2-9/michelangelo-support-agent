/**
 * Legal documents — single source of truth for the /privacy and /terms
 * routes. Content is markdown, rendered by pages/legal-page.tsx through
 * the shared Markdown component.
 *
 * These documents describe THIS project only: an unofficial,
 * educational/portfolio support agent — NOT Michelangelo.land itself.
 * Controller identity and contact email below are the data controller's
 * (GDPR art. 13): keep them up to date if ownership or contacts change.
 */

export const PRIVACY_LAST_UPDATED = "August 19, 2026";

export const PRIVACY_POLICY = `
Welcome to the Michelangelo Support Agent ("we," "our," or "us"), an
independent educational/portfolio project operated by Sara Moro. This
project is **not affiliated with, endorsed by, or officially connected to
Michelangelo.land** — it is an unofficial support assistant whose answers
are generated exclusively from Michelangelo's public documentation.

We are committed to protecting your privacy. This policy explains what
personal data we collect, why, how long we keep it, and the rights you
have under the EU General Data Protection Regulation (GDPR).

## 1. Data Controller

The data controller is:

Sara Moro
Email: moro.sara29@gmail.com

## 2. Information We Collect

- **Account information.** If you choose to save your history, we collect
  your **email address** (email magic link) or your **Google profile
  information** (name, email, profile photo) when you sign in with Google.
  If you do not sign in, the service works with an **anonymous account**
  identified only by a randomly generated ID.
- **Conversation content.** The messages you send, the answers generated,
  your thumbs up/down feedback, and related technical metadata
  (timestamps, intent classification, retrieval sources, response
  latency) are stored on our servers. If you are **signed in**, this lets
  you resume your conversation history at any time. If you use the
  service **anonymously**, your conversations are stored in pseudonymous
  form (linked only to a random ID) to monitor and improve the quality of
  the service — they are **never shown back to you** after you leave or
  reload the page, and they are **never linked to an account** you may
  create later.
- **Technical data.** Our hosting providers transiently process your IP
  address and device/browser information to deliver and secure the
  service.

We do not collect special categories of personal data, and we ask you
**not to submit sensitive personal data or third parties' personal data**
in your messages.

## 3. How We Use Your Information (and Legal Bases)

- **To provide the service** — answering your questions and keeping your
  conversation history (performance of a service you requested, GDPR
  art. 6(1)(b)).
- **To maintain security and prevent abuse** — authentication, access
  control, rate limiting (our legitimate interest, GDPR art. 6(1)(f)).
- **To improve the service** — aggregated, non-advertising analysis of
  intent classifications and feedback, including quality review of
  pseudonymously stored anonymous conversations (our legitimate interest,
  GDPR art. 6(1)(f)).

We do **not** use your data for marketing, we do **not** sell your
personal information, and we do **not** use your conversations to train
AI models.

## 4. AI Processing of Your Messages

To generate an answer, the text of your messages is sent to **Cloudflare
Workers AI** (a large language model running on Cloudflare's
infrastructure). Answers are generated automatically and may be
inaccurate or incomplete — always verify them against the official
Michelangelo documentation.

## 5. Who Processes Your Data

We share personal data only with the service providers needed to operate
the service, each bound by their own data processing terms:

- **Cloudflare** — hosting, content delivery, and AI answer generation
- **Supabase** — database and authentication
- **Resend** — transactional email delivery (sign-in links)
- **Google** — authentication, only if you choose "Continue with Google"

Some of these providers process data outside the EU (in particular in
the United States). Such transfers rely on adequacy decisions or
Standard Contractual Clauses under GDPR Chapter V.

## 6. Data Retention

- **Conversations and account data** are kept until you ask us to delete
  them (see Your Rights below).
- **Anonymous accounts** that remain inactive may be deleted
  periodically.

## 7. Your Rights

Under the GDPR you have the right to:

- **access** your personal data and receive a copy of it;
- **rectify** inaccurate data;
- **erase** your data ("right to be forgotten") — including your whole
  conversation history and account;
- **restrict** or **object** to processing, and to data **portability**;
- **lodge a complaint** with the Italian supervisory authority (Garante
  per la protezione dei dati personali) or your local EU authority.

You can **delete your account and your entire conversation history
yourself** at any time from the account menu ("Delete Account") — the
deletion is immediate and also covers your authentication data. For any
other right, email us at moro.sara29@gmail.com.

## 8. Cookies and Local Storage

We do not use tracking, analytics, or advertising cookies. Sign-in
session tokens are stored in your browser's local storage — this is
strictly necessary to keep you signed in and does not require consent.
The consent banner shown on your first visit records your choice
("accepted" or "rejected") in local storage; since no optional cookies
exist, rejecting changes nothing about how the site works.

## 9. Data Security

We implement appropriate technical and organizational measures to protect
your personal information against unauthorized access, alteration,
disclosure, or destruction — including per-user row-level security on the
database and authenticated, ownership-checked API writes.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you
of any changes by posting the new Privacy Policy on this page and
updating the "Last updated" date.

## 11. Contact

For questions about this Privacy Policy, or to exercise your rights:

Sara Moro — Michelangelo Support Agent (unofficial project)
Email: moro.sara29@gmail.com
`;

export const TERMS_LAST_UPDATED = "August 9, 2026";

export const TERMS_OF_SERVICE = `
PLEASE READ THESE TERMS OF SERVICE CAREFULLY. THEY CONTAIN IMPORTANT
INFORMATION REGARDING YOUR LEGAL RIGHTS, REMEDIES, AND OBLIGATIONS. THESE
INCLUDE LIMITATIONS ON LIABILITY AND A DISCLAIMER OF ALL WARRANTIES.

## Overview

These Terms of Service (the "Terms") constitute a legal agreement between
you and Sara Moro, operating the Michelangelo Support Agent
("the Service," "we," "us," or "our"), an independent
educational/portfolio project available at
michelangelo-support-agent.moro-sara29.workers.dev.

**The Service is not affiliated with, endorsed by, or officially
connected to Michelangelo.land.** It is an unofficial support assistant
whose answers are generated exclusively from Michelangelo's public
documentation. For official support, refer to Michelangelo's official
channels.

By using the Service, you acknowledge that you have read, understood, and
agree to be bound by these Terms and to comply with all applicable laws
and regulations. If you do not agree, do not use the Service.

## The Service

The Service is a free, AI-powered chat that answers support questions
about the Michelangelo iOS app using only its official public
documentation, with source citations. Questions outside the documented
scope are declined rather than guessed.

## License to Use the Service

Subject to these Terms, we grant you a limited, personal, non-exclusive,
non-transferable, revocable license to use the Service for personal,
non-commercial purposes.

## AI-Generated Answers

Answers are generated automatically by a large language model and are
grounded in the official documentation available at the time of indexing.
They may be **inaccurate, incomplete, or outdated**, and they do not
constitute official Michelangelo support or professional advice of any
kind. Always verify answers against the official documentation and the
cited sources before acting on them.

## Accounts

You may use the Service anonymously or sign in with an email magic link
or Google to preserve your conversation history across devices. You are
responsible for maintaining the security of your account and must notify
us promptly of any unauthorized access.

## User Content

You retain all rights to the messages and content you submit. You grant
us the right to process and store that content solely to operate the
Service (generating answers and keeping your history). You are solely
responsible for your content; do not submit content you have no right to
share, third parties' personal data, or sensitive personal data.

## Prohibited Use

You agree to use the Service only for lawful purposes. You may not:

- violate laws, regulations, or third-party rights, including
  intellectual property and privacy rights;
- submit illegal, offensive, defamatory, discriminatory, or threatening
  content, or content inciting violence or hatred;
- attempt to disrupt, probe, or compromise the Service or its
  infrastructure (hacking, scraping at abusive volumes, prompt-injection
  attacks aimed at extracting system data, spreading malware);
- use the Service for unauthorized commercial purposes or to promote
  services, goods, or activities not permitted by these Terms.

Violation of this clause may result in suspension or termination of your
access and, where required by law, reports to the competent authorities.

## Service Modifications and Access

We reserve the right to modify, suspend, or discontinue any part of the
Service at any time, with or without notice. We may also restrict,
suspend, or terminate access at our discretion. As a free portfolio
project, the Service may be discontinued at any time without liability.

## Privacy

Your use of the Service is also governed by our Privacy Policy, available
at /privacy. By using the Service you acknowledge that your messages are
processed by AI systems as described there.

## Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES
OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT WARRANT THAT ANSWERS WILL BE
ACCURATE, COMPLETE, OR CURRENT, OR THAT THE SERVICE WILL BE UNINTERRUPTED
OR ERROR-FREE.

## Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, NOR
FOR ANY DECISION MADE IN RELIANCE ON AN AI-GENERATED ANSWER, ARISING FROM
YOUR USE OF THE SERVICE. NOTHING IN THESE TERMS EXCLUDES OR LIMITS
LIABILITY THAT CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW,
INCLUDING MANDATORY CONSUMER PROTECTION AND DATA PROTECTION RIGHTS.

## Governing Law and Jurisdiction

These Terms are governed by the laws of Italy, without regard to conflict
of law provisions. If you are a consumer resident in the EU, the
mandatory protections granted by the law of your country of residence
remain unaffected, and the courts of your place of residence have
jurisdiction where required by law.

## Changes to These Terms

We may update these Terms at any time. We will post the updated Terms on
this page and update the "Last updated" date; for material changes we
will make reasonable efforts to notify users through the Service. Your
continued use of the Service after such changes constitutes acceptance of
the updated Terms.

## Contact

For questions about these Terms, complaints, or claims:

Sara Moro — Michelangelo Support Agent (unofficial project)
Email: moro.sara29@gmail.com
`;
