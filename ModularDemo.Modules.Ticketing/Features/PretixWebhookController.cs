// ModularDemo.Modules.Ticketing/Features/PretixWebhookController.cs
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ModularDemo.Modules.Ticketing.Pretix;
using ModularDemo.Modules.Ticketing.Webhooks;

namespace ModularDemo.Modules.Ticketing.Features;

/// <summary>
/// Receives pretix webhooks: <c>POST /api/pretix/webhook?secret=…</c>.
/// Checks the shared secret, queues the notification and answers 200 at once;
/// <see cref="PretixWebhookProcessor"/> does the work in the background.
/// </summary>
[ApiController]
[Route("api/pretix/webhook")]
[Tags("Pretix")]
public sealed class PretixWebhookController(
	PretixWebhookQueue queue,
	IOptionsSnapshot<PretixOptions> options,
	ILogger<PretixWebhookController> logger) : ControllerBase
{
	/// <summary>Webhook endpoint configured in pretix (Organizer → Webhooks).</summary>
	[HttpPost]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status401Unauthorized)]
	[ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
	public IActionResult Receive([FromQuery] string? secret, [FromBody] PretixWebhookPayload payload)
	{
		var expected = options.Value.WebhookSecret;
		if (string.IsNullOrEmpty(expected))
			return Problem("Webhooks are disabled (Pretix:WebhookSecret is empty).",
				statusCode: StatusCodes.Status503ServiceUnavailable);

		if (!SecretMatches(secret, expected))
		{
			logger.LogWarning("Rejected pretix webhook with a wrong secret from {Ip}", HttpContext.Connection.RemoteIpAddress);
			return Unauthorized();
		}

		if (!queue.TryEnqueue(payload))
		{
			logger.LogError("pretix webhook queue is full; asking pretix to retry {NotificationId}", payload.NotificationId);
			return Problem("Busy, retry later.", statusCode: StatusCodes.Status503ServiceUnavailable);
		}

		return Ok();
	}

	/// <summary>Constant-time comparison, so response timing doesn't reveal the secret.</summary>
	private static bool SecretMatches(string? actual, string expected) =>
		actual is not null &&
		CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(actual), Encoding.UTF8.GetBytes(expected));
}
