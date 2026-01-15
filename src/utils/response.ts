/**
 * HTTP Response utilities
 */

/**
 * Create a JSON response with proper headers
 */
export function jsonResponse(
	data: unknown,
	status = 200,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	});
}
