export interface SendSlackInput {
  webhookUrl: string;
  text: string;
}

export async function sendSlack({ webhookUrl, text }: SendSlackInput): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
}
