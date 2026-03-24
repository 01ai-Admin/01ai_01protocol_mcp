# 01 Protocol — ChatGPT GPT Plugin

Create, verify, and view 01 Protocol agent identities from ChatGPT.

## Status: In Progress — needs API deployment

## Structure

```
chatgpt-gpt/
  api/              — Express API server (wraps @01protocol/sdk)
  openapi.yaml      — GPT Actions schema (point to deployed API URL)
  gpt-system-prompt.md  — Paste into GPT Instructions field
  README.md
```

## To finish and publish

### 1. Deploy the API

The GPT Actions need a public HTTPS endpoint. Free options:
- **Render** — render.com (free tier, auto-deploys from GitHub)
- **Railway** — railway.app (free tier)
- **Vercel** — vercel.com (serverless, free tier)

After deploying, update the `servers.url` in `openapi.yaml` to your live URL.

### 2. Create the GPT on ChatGPT.com

Requires ChatGPT Plus.

1. Go to chatgpt.com → Explore GPTs → Create
2. Fill in:
   - **Name:** 01 Protocol Agent Identity
   - **Description:** Create, verify, and view cryptographic AI agent identities on the 01 Protocol standard.
   - **Instructions:** Copy from `gpt-system-prompt.md`
3. Under **Actions** → Create new action:
   - Paste the contents of `openapi.yaml`
   - Set authentication to None (public API)
4. Set **Capabilities:** off (no web browsing, no code interpreter, no image gen)
5. Publish to GPT Store

### 3. GPT Store listing details

- **Category:** Productivity / Developer Tools
- **Tags:** ai, agent, identity, cryptography, 01protocol
