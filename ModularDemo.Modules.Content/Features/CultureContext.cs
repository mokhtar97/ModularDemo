// ModularDemo.Modules.Content/Features/CultureContext.cs
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Services;

namespace ModularDemo.Modules.Content.Features;

/// <summary>
/// Chooses the culture for a content request and puts it on Umbraco's variation context, so
/// names, URLs, property values and child filtering all use that language.
/// API calls aren't routed through a domain, so without this Umbraco has no culture and
/// culture-variant properties come back empty.
/// </summary>
public sealed class CultureContext(
	ILanguageService languageService,
	IVariationContextAccessor variationContextAccessor)
{
	private IReadOnlyList<ILanguage>? _languages;

	/// <summary>All languages configured in Settings → Languages, default first.</summary>
	public async Task<IReadOnlyList<ILanguage>> GetLanguagesAsync() =>
		_languages ??= (await languageService.GetAllAsync())
			.OrderByDescending(language => language.IsDefault)
			.ThenBy(language => language.CultureName)
			.ToList();

	/// <summary>
	/// Applies the requested culture (e.g. "ar", "en-US"; case-insensitive). Unknown or missing
	/// cultures fall back to the default language. Returns the ISO code that was applied.
	/// </summary>
	public async Task<string?> ApplyAsync(string? requested)
	{
		var languages = await GetLanguagesAsync();
		var match =
			languages.FirstOrDefault(l => string.Equals(l.IsoCode, requested?.Trim(), StringComparison.OrdinalIgnoreCase))
			?? languages.FirstOrDefault(l => l.IsDefault)
			?? languages.FirstOrDefault();

		var culture = match?.IsoCode;
		variationContextAccessor.VariationContext = new VariationContext(culture);
		return culture;
	}
}
