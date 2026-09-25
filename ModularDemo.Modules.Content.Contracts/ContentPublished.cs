// ModularDemo.Modules.Content.Contracts/ContentPublished.cs
using ModularDemo.Shared;

namespace ModularDemo.Modules.Content.Contracts;

/// <summary>
/// Raised when an editor publishes a document in Umbraco.
/// Other modules can react to it without referencing Umbraco at all.
/// </summary>
public record ContentPublished(Guid Key, int Id, string Name, string ContentTypeAlias) : IEvent;
