# One-click AI Review Worker setup

This Worker securely triggers the existing `ai-review.yml` workflow. The GitHub token and OpenAI API key are never placed in the public GitHub Pages JavaScript.

## 1. Create the Cloudflare Worker

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named `macropulse-ai-review`.
3. Open its editor and replace the starter code with the complete contents of `cloudflare-worker/worker.js`.
4. Deploy it and copy the Worker URL (for example, `https://macropulse-ai-review.<your-subdomain>.workers.dev`).

## 2. Add Worker configuration

In the Worker **Settings → Variables and Secrets**, add:

- Secret `GITHUB_TOKEN`: a GitHub fine-grained personal access token for `Winner99099/fx-fundamental-dashboard`, with **Actions: Read and write** permission. Repository metadata read access is normally included.
- Secret `WORKER_PIN`: create a long, private PIN/password. It is requested by the dashboard on first use in each browser session.
- Variable `ALLOWED_ORIGIN`: `https://winner99099.github.io`

Save and redeploy if Cloudflare prompts you.

## 3. Use the dashboard

1. Open https://winner99099.github.io/fx-fundamental-dashboard/
2. Open **AI Momentum Review**.
3. Paste the Worker URL into **Secure Worker URL**.
4. Select the currencies you want to compare and click **Analyse Selected Pair(s)**.
5. Enter the private Worker PIN when prompted. The dashboard waits for the workflow and refreshes the result in place.

The Worker PIN is kept only in the current browser session. The Worker URL is saved in local browser storage. Do not share the PIN or GitHub token.

## Security and troubleshooting

- Never put `GITHUB_TOKEN` or `OPENAI_API_KEY` into `app.js`, GitHub Pages, or any public file.
- The GitHub token should be fine-grained and limited to this repository.
- If you receive an incorrect PIN error, clear the browser session or reload and enter the correct PIN.
- If GitHub rejects dispatch, verify that the token has Actions write permission and that the workflow is enabled.
- Pair analysis can take a few minutes. Keep the AI Review page open while it waits for the new result.


## Updating the Worker after dashboard code changes

The Worker script deployed in Cloudflare does not update automatically when `cloudflare-worker/worker.js` changes in GitHub. After updating this repository's Worker code:

1. Open Cloudflare Dashboard → **Workers & Pages** → your `macropulse-ai-review` Worker.
2. Open **Edit code**.
3. Replace the complete Worker code with the latest contents of `cloudflare-worker/worker.js` in this repository.
4. Click **Deploy**.

Keep the existing `GITHUB_TOKEN`, `WORKER_PIN` and `ALLOWED_ORIGIN` settings; do not paste secrets into the source code.
