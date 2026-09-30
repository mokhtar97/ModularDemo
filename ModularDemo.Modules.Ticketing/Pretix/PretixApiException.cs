// ModularDemo.Modules.Ticketing/Pretix/PretixApiException.cs
using System.Net;

namespace ModularDemo.Modules.Ticketing.Pretix;

/// <summary>A failed call to the pretix REST API.</summary>
public sealed class PretixApiException(string message, HttpStatusCode? statusCode = null, bool isTimeout = false, Exception? inner = null)
	: Exception(message, inner)
{
	/// <summary>HTTP status pretix answered with, or null when it could not be reached.</summary>
	public HttpStatusCode? StatusCode { get; } = statusCode;

	/// <summary>True when pretix did not answer within <see cref="PretixOptions.TimeoutSeconds"/>.</summary>
	public bool IsTimeout { get; } = isTimeout;
}
