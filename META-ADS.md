# Tracking Meta click-to-WhatsApp ads

How a lead travels from your Meta ad to a paying client, and how the CRM tracks each step.

## The journey

| Step | What happens | What the CRM does |
| --- | --- | --- |
| 1. Sees the ad | Someone sees your Facebook or Instagram ad with the **Chat on WhatsApp** button. | Nothing yet. |
| 2. Taps the button | WhatsApp opens with your pre-filled message, for example "Hi! I'd like to know more (Ad: DIWALI)". | Nothing yet. |
| 3. Sends the message | The chat lands in your WhatsApp Business app as usual. | Creates a lead with source **Meta Ads** and the ad's name, saves their first message, and sets a "reply or call" reminder for 1 hour later. |
| 4. You reply | You chat from the WhatsApp app as you do today. | Open the lead and move its status to **Contacted**. Log calls and notes. |
| 5. Follow-ups | You schedule the next follow-up from the lead. | Reminds you when it's due. Client texts stay in test mode until you approve. |
| 6. Outcome | They buy or drop off. | Set the status to **Won** or **Lost**. |
| 7. Results | You compare ads. | The **Ads** table on the Today screen shows, for each ad: leads, still open, won and win rate. |

If the same person later messages you from a different ad, the CRM keeps the original lead and adds "Came back through Meta ad ..." to their history.

## How the CRM knows which ad it was

There are two ways, and the CRM uses both:

1. **Meta's ad details (automatic).** When someone starts a chat from a click-to-WhatsApp ad, Meta attaches the ad's ID, headline and link to their first message. The CRM uses the headline as the ad name and adds a "view ad" link on the lead. This only works once WhatsApp is connected to the CRM (see Part 2 of `CONNECT.md`).
2. **A code in the pre-filled message (backup).** Put a short code in brackets in each ad's pre-filled message, in the form `(Ad: CODE)`. For example: `Hi! I'd like to know more (Ad: DIWALI)`. If Meta's details are missing, the CRM reads the code instead. Give every ad its own code.

## Setting up each ad

In Meta Ads Manager, open the ad, then find the **Message template** (or "pre-filled message") section for WhatsApp, and:

1. Write a friendly opening message ending with the ad's code, such as `(Ad: DIWALI)`.
2. Keep the **ad headline** clear and unique, because it becomes the ad's name in the CRM.
3. Publish.

The exact menu names in Meta change often, so treat these as a guide.

## Before WhatsApp is connected

Leads won't appear on their own yet. Until then:

1. When a chat comes in from an ad, click **+ Add lead** in the CRM.
2. Choose source **Meta Ads** and type the code you see in their message into **Ad / campaign**.

The Ads table works the same way for these leads.

## Settings

| Variable | What it does |
| --- | --- |
| `NEW_LEAD_FOLLOWUP_MINUTES` | How long after a new WhatsApp or ad lead arrives the "reply or call" reminder comes due. Default 60. Set to 0 to turn it off. |

## Later: telling Meta which ads bring clients

The CRM also saves Meta's click ID (`ctwa_clid`) for each ad lead. A later step could report **Won** leads back to Meta, so Meta shows your ads to more people like your actual buyers. That needs extra Meta setup and isn't built yet.
