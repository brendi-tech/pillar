---
title: Terms of Service
lastUpdated: 2026-03-10
---

These Terms of Service ("Terms") govern your access to and use of the websites, platform, APIs, SDK, and services (collectively, the "Services") provided by Pillar.

By creating an account, clicking "I Agree," or using the Services, you agree to be bound by these Terms.

### 1. Who We Are

The Services are provided by **Double Finance Inc.**, a Delaware corporation, doing business as **Pillar Labs**. For the purpose of these Terms, all references to "Pillar," "we," or "us" refer to this legal entity.

### 2. Definitions

* **"Customer"** or **"You"** means the individual or entity agreeing to these Terms.
* **"End User"** means any individual who interacts with the Product Assistant that you deploy using our Services.
* **"Customer Content"** means any data, help articles, documentation, website content, support tickets, or other materials you submit to Pillar or direct us to ingest to provide the Services.
* **"Knowledge Base"** means the indexed, searchable repository of your Customer Content that powers the Product Assistant.
* **"Product Assistant"** or **"Product Copilot"** means Pillar's embedded AI agent delivered via our SDK that runs in your End Users' browsers, providing context-aware assistance, answering questions, and executing actions on behalf of End Users.
* **"SDK"** means the Pillar software development kit, including the React bindings (`@pillar-ai/react`), core SDK (`@pillar-ai/sdk`), and associated packages.
* **"Actions"** means the typed functions you define in your client-side code that the Product Assistant can suggest or execute on behalf of End Users (e.g., navigating to a page, pre-filling a form, calling an API).
* **"AI Responses"** means the LLM-generated answers, suggestions, and plans created by the Product Assistant based on your Customer Content and End User queries.

### 3. The Services

Pillar provides an embedded AI product assistant platform consisting of:

**(a) Product Assistant SDK** — An embeddable AI agent that runs client-side in your End Users' browsers. The Product Assistant can:
- Answer End User questions using your Knowledge Base
- Execute Actions you define (navigate, pre-fill forms, call APIs)
- Create multi-step plans for complex tasks
- Provide context-aware suggestions based on the End User's current page and state
- Escalate to human support when needed

**(b) Knowledge Base Management** — Tools to ingest, organize, and index your help content from various sources including:
- Existing help centers (Zendesk, Intercom, website crawl)
- Documentation sites (Mintlify, GitBook, ReadMe)
- Support ticket conversations
- Uploaded documents and files

We are **read-only** — we index your existing content but do not host or create content on your behalf.

**(c) Analytics** — Insights into how End Users interact with your Product Assistant, including conversation logs, search queries, and feedback.

Subject to these Terms, Pillar grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services, including integrating the SDK into your applications, for your internal business purposes during your subscription term.

### 4. Your Content & Ownership

This is the most important section. We've structured it to give you maximum ownership over your own content.

* **You Own Your Content:** You retain all right, title, and interest in and to your Customer Content.
* **You Own Your Actions:** You retain all right, title, and interest in the Actions you define and the business logic they implement.
* **AI Responses:** AI Responses are generated using your Customer Content. You may use AI Responses in connection with providing services to your End Users. We make no claim of ownership over AI Responses generated specifically for you.
* **We Own Our Service:** Pillar retains all right, title, and interest in and to our Services, including the platform, SDK, AI models, analytics systems, and all underlying technology.

### 5. Your License to Us

To provide the Services, you grant us a limited, worldwide, royalty-free license to:

1.  **Ingest and Process:** Access, crawl, copy, process, index, and use your Customer Content to build and maintain your Knowledge Base.
2.  **Generate Responses:** Use your Knowledge Base to generate AI Responses for your End Users.
3.  **Execute Actions:** Facilitate the execution of Actions you define when triggered by End User requests through the Product Assistant.
4.  **Analyze and Improve:** Use aggregated, anonymized usage data to improve our Services. We will not use your Customer Content to train AI models for other customers without your explicit consent.

You represent and warrant that you have all necessary rights to grant us this license and to make your Customer Content available through the Services.

### 6. SDK Terms & Your Responsibilities

**(a) SDK Integration:**
- The SDK runs entirely in the End User's browser, sharing their existing session and authentication context with your application.
- You are responsible for properly integrating the SDK according to our documentation.
- You must keep your API keys confidential. Public keys may be embedded in client-side code; private keys must never be exposed.

**(b) Actions:**
- You are solely responsible for the Actions you define and their behavior.
- Actions run in your application's context with your End User's permissions. Pillar does not execute Actions on our servers—the SDK facilitates their execution in the browser.
- You must ensure Actions are safe, properly authenticated, and appropriate for automated execution.

**(c) Content Accuracy:**
- The Product Assistant uses generative AI. You are responsible for reviewing the accuracy of AI Responses that reference your Customer Content.
- You should ensure your Customer Content is accurate, up-to-date, and appropriate for your End Users.

**(d) End User Data:**
- Conversations between End Users and the Product Assistant may be logged for analytics and improvement purposes, subject to our Privacy Policy.
- You are responsible for providing appropriate disclosures to your End Users about the use of AI assistance in your application.

**(e) Prohibited Uses:**
- You agree not to use the Services for any high-risk applications where failure could lead to death, personal injury, or severe harm (e.g., medical diagnosis, safety-critical systems).
- You agree not to use the Services to process highly sensitive personal data (e.g., health records, financial account credentials) through the Product Assistant without appropriate safeguards.
- You agree not to reverse engineer, decompile, or attempt to extract the source code of our SDK or Services.

### 7. Fees, Payment, and Renewal

* **Subscription:** You will be billed in advance for your subscription plan ("Subscription") based on usage tiers or seat counts as specified in your order.
* **Usage-Based Pricing:** Certain Services may be billed based on usage metrics (e.g., number of End Users, conversations, or API calls). We will provide visibility into your usage through the dashboard.
* **Response Metering:** Each AI response generated by the Product Assistant counts as one "response" toward your plan's included responses. Simple responses requiring minimal computation (under 5,000 tokens) are not counted. Responses requiring significantly more computation are metered proportionally at one response unit per 50,000 tokens (e.g., a response using 150,000 tokens counts as 3 responses). Current token thresholds are published on our pricing page and may be updated with 30 days' notice.
* **Automatic Renewal:** **Your Subscription will automatically renew** at the end of each term for an additional term of the same length, unless you cancel before the end of the current term. We will send you a reminder at least **14 days** before your renewal date.
* **Payment:** You agree to keep your payment information current. We may use a third-party payment processor.
* **Price Changes:** We may change our fees by providing you at least thirty (30) days' notice.

### 8. Term and Termination

* **Termination:** You may cancel your Subscription at any time through your account settings or by contacting us. Termination will be effective at the end of your current billing period.
* **Termination for Cause:** We may suspend or terminate your access immediately if you breach these Terms.
* **Effect of Termination:** Upon termination, your license to use the SDK ends. We will delete your data in accordance with our Privacy Policy (within 12 months or upon request).
* **Data Export:** You may export your configuration and analytics data at any time during your subscription through the dashboard or by contacting support.

### 9. Disclaimers & Limitation of Liability

* **"AS IS" SERVICE:** THE SERVICES, INCLUDING THE SDK AND AI-GENERATED RESPONSES, ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT ANY WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. PILLAR DISCLAIMS ALL WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

* **AI LIMITATIONS:** THE PRODUCT ASSISTANT USES GENERATIVE AI WHICH MAY PRODUCE INACCURATE, INCOMPLETE, OR INAPPROPRIATE RESPONSES. YOU ACKNOWLEDGE THAT AI RESPONSES SHOULD BE REVIEWED FOR ACCURACY BEFORE BEING RELIED UPON FOR CRITICAL DECISIONS.

* **LIMITATION OF LIABILITY:** TO THE MAXIMUM EXTENT PERMITTED BY LAW, PILLAR WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUE, ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES.

* **LIABILITY CAP:** IN NO EVENT SHALL PILLAR'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICES EXCEED THE TOTAL AMOUNT YOU PAID TO PILLAR IN THE **TWELVE (12) MONTHS** IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.

### 10. Indemnification

You agree to defend, indemnify, and hold harmless Pillar and its officers, directors, and employees from any claims, liabilities, damages, and expenses (including reasonable attorneys' fees) arising out of or related to:
- Your Customer Content
- The Actions you define and their execution
- Your use of the Services
- Your End Users' use of the Product Assistant
- Your breach of these Terms

**Pillar's Indemnification:** Pillar will defend, indemnify, and hold harmless Customer from any third-party claim alleging that the SDK, as provided by Pillar, infringes a valid patent, copyright, or trademark, provided that:
- Customer promptly notifies Pillar of the claim
- Pillar has sole control over the defense and settlement
- Customer provides reasonable cooperation

If the SDK becomes subject to an infringement claim, Pillar may, at its option: (a) modify the SDK to be non-infringing, (b) obtain a license for continued use, or (c) terminate your subscription and refund any prepaid fees for the remaining term.

This indemnification does not apply to claims arising from: (i) Customer Content, (ii) modifications you make to the SDK, or (iii) combination of the SDK with other products not provided by Pillar.

### 11. Governing Law and Arbitration

* **Governing Law:** These Terms will be governed by the laws of the **State of California**.
* **Mandatory Arbitration:** Any dispute arising from these Terms will be resolved by binding arbitration administered by the **American Arbitration Association (AAA)** under its Commercial Arbitration Rules. The arbitration will take place in **San Francisco, California**.
* **No Class Actions:** YOU AGREE TO RESOLVE DISPUTES ONLY ON AN INDIVIDUAL BASIS AND WAIVE ANY RIGHT TO BRING A CLAIM AS PART OF A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.

### 12. Miscellaneous

* **Changes to Terms:** We may modify these Terms from time to time. If we make a change that materially affects your rights, we will provide at least thirty (30) days' notice (e.g., by email or an in-app alert).
* **Entire Agreement:** These Terms, along with our Privacy Policy, constitute the entire agreement between you and Pillar.
* **Severability:** If any part of these Terms is found to be unenforceable, the remaining parts will remain in full force.
* **Force Majeure:** Neither party will be liable for delays or failures in performance resulting from circumstances beyond its reasonable control, including natural disasters, acts of war or terrorism, labor disputes, government actions, power failures, internet or telecommunications outages, or failures of third-party service providers.
* **Contact:** For any questions about these Terms, please contact us in writing at:  
  **Pillar Labs**  
  2261 Market Street STE 5932  
  San Francisco, CA 94114  
  United States  
  legal@trypillar.com
