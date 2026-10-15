# FCW CRM

A small web app for tracking leads from WhatsApp, Google Ads and referrals, with follow-ups, two-way WhatsApp reminders and status tracking. It needs only Node.js 18 or newer, with no other installs.

## Run it

```
node server.js
```

Then open http://localhost:3000. Data is saved in `data.json` next to `server.js`.

## What it does

- **Today:** open leads, follow-ups due or overdue (with WhatsApp, Call and Done buttons), what is coming up, and leads by source.
- **Leads:** search and filter by status or source, add leads by hand (referrals, walk-ins), and open a lead to change its status, log calls and notes, and see its full history. Every status change is recorded.
- **Follow-ups:** schedule a follow-up or call for a date and time, with a note to yourself and, optionally, a WhatsApp text to the client (four ready-made templates). Snooze, mark done with an outcome, or cancel.
- **Reminders:** when a follow-up comes due, the app sends a reminder to you and the follow-up text to the client. Every message is listed under **Messages**. While the CRM is open, the browser also shows a notification.
- **Lead capture:** new WhatsApp chats and Google Ads lead forms create leads automatically through the two webhooks below. A repeat contact from the same number is added to the existing lead instead of creating a duplicate.

Statuses: New, Contacted, Interested, Follow-up, Proposal sent, Won, Lost.

## Test mode (the default)

Nothing is sent to anyone until `WHATSAPP_SEND=on` is set together with the API credentials. In test mode every reminder and client text is recorded under **Messages** as "Test mode: not sent". The "WhatsApp" buttons open a normal `wa.me` chat with the text pre-filled, so you can still send by hand from your phone.

## Settings (environment variables)

| Variable | What it is |
| --- | --- |
| `PORT` | Web port, default 3000 |
| `APP_PASSWORD` | Password for opening the CRM; the browser asks for it once (any username works). Always set this when the app is online. |
| `DATA_FILE` | Where leads are saved, default `data.json` next to `server.js` |
| `OWNER_PHONE` | Where reminders to you go, with country code. It must be a different number from the business number (see below). |
| `WHATSAPP_SEND` | `on` to really send messages. Anything else means test mode. |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API access token from Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | The phone number ID of your business number in Meta |
| `WHATSAPP_APP_SECRET` | Your Meta app's secret (App settings > Basic). When set, WhatsApp webhooks without a valid Meta signature are rejected. Set it before connecting WhatsApp. |
| `WHATSAPP_VERIFY_TOKEN` | Any secret you choose, entered in Meta when setting up the webhook (default `fcw-verify`; change it) |
| `GOOGLE_ADS_KEY` | The key you enter on the Google Ads lead form webhook (default `fcw-google-key`; change it) |

## Connecting the sources

- **WhatsApp:** in Meta for Developers, set the webhook URL to `https://<your-domain>/webhooks/whatsapp` with your verify token and subscribe to `messages`.
- **Google Ads:** on the lead form asset, under "Lead delivery", add the webhook URL `https://<your-domain>/webhooks/google-ads` and your key, then press "Send test data".
- **Referrals:** add them by hand with source "Referral" and the referrer's name.

Both webhooks need the app to be on the internet over HTTPS (a small hosting service, or a tunnel while testing).

## Put it online (Render)

1. Push this folder to a GitHub repository.
2. In Render, choose **New > Blueprint**, pick the repository, and Render reads `render.yaml`.
3. Fill in `APP_PASSWORD` (and `OWNER_PHONE` if you have a second number) when Render asks.
4. Open the address Render gives you, for example `https://fcw-crm.onrender.com`.

`render.yaml` uses Render's Starter plan with a 1 GB disk at `/var/data`, so leads survive restarts and the reminder timer keeps running. The free plan cannot keep data: it wipes files on every restart and sleeps when idle, which stops reminders.

`/healthz` is an open health check. Everything except `/healthz` and the two webhooks needs the password.

## Things to know before going live

1. **Your number cannot message itself.** Your business number is also your personal number, so a reminder "to you" sent from it would arrive nowhere. Reminders to you need another destination: a second number in `OWNER_PHONE`, or rely on the Today screen and browser notifications.
2. **Using your number with the API.** Meta now lets a number stay on the WhatsApp Business app while also being connected to the Cloud API ("coexistence"), so you would not have to give up the app. This needs to be set up in Meta Business Manager.
3. **Templates for client follow-ups.** WhatsApp only allows free-form texts within 24 hours of the client's last message. Follow-ups after that must use a message template approved by Meta. The current code sends plain text, so template support is the next step before live sending.
