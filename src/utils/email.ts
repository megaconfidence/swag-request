/**
 * Email utilities using Resend API
 */

/**
 * Send email via Resend
 */
export async function sendEmail(
	apiKey: string,
	fromEmail: string,
	to: string,
	subject: string,
	html: string
): Promise<boolean> {
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: `Cloudflare Swag <${fromEmail}>`,
				to: [to],
				subject,
				html,
			}),
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to send email:', error);
		return false;
	}
}
