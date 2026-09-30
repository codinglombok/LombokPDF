namespace LombokPDF;

/// <summary>
/// LombokPDF — .NET/C# Port.
/// Lightweight, elegant, polyglot PDF generation. Apache 2.0.
/// </summary>
/// <example>
/// From HTML:
/// <code>
/// var pdf = new LombokPdfClient();
/// var doc = await pdf.From(Source.Html("&lt;h1&gt;Hello&lt;/h1&gt;"))
///     .Locale("en-US")
///     .ExportAsync(Format.Pdf);
/// await doc.SaveAsync("output.pdf");
/// </code>
/// </example>
/// <example>
/// From template:
/// <code>
/// var doc = await pdf.From(Source.Template("invoice", new { company = "Acme" }))
///     .Locale("id-ID")
///     .ExportAsync(Format.PdfA1b);
/// </code>
/// </example>
/// <example>
/// Arabic RTL:
/// <code>
/// var doc = await pdf.From(Source.Html("&lt;h1&gt;مرحباً&lt;/h1&gt;"))
///     .Locale("ar-SA")
///     .ExportAsync(Format.Pdf);
/// </code>
/// </example>
public sealed class LombokPdfClient
{
    private readonly LombokPdfOptions _options;
    private readonly LLEEngine _engine;

    public LombokPdfClient() : this(LombokPdfOptions.Default) { }

    public LombokPdfClient(LombokPdfOptions options)
    {
        _options = options;
        _engine  = new LLEEngine(options);
    }

    /// <summary>Begin a fluent builder chain from a source.</summary>
    public Builder From(Source source) => new(source, _engine, _options);

    /// <summary>Shorthand for <see cref="From"/> with an HTML source.</summary>
    public Builder FromHtml(string html) => From(Source.Html(html));

    /// <summary>Shorthand for <see cref="From"/> with a Markdown source.</summary>
    public Builder FromMarkdown(string markdown) => From(Source.Markdown(markdown));

    /// <summary>Shorthand for <see cref="From"/> with a named template.</summary>
    public Builder FromTemplate(string name, object? data = null) => From(Source.Template(name, data));

    /// <summary>Shorthand for <see cref="From"/> with a file path.</summary>
    public Builder FromFile(string path) => From(Source.File(path));

    /// <summary>Library version.</summary>
    public static string Version => "1.0.0";

    /// <summary>Feature support matrix for this runtime.</summary>
    public static SupportMatrix Supported => new(
        CssPagedMedia: true,
        Flexbox:       true,
        Grid:          true,
        Bidi:          true,
        Harfbuzz:      true,
        Wasm:          true,
        Locales:       LocaleResolver.AvailableLocales
    );
}

/// <summary>Feature support matrix.</summary>
public sealed record SupportMatrix(
    bool CssPagedMedia,
    bool Flexbox,
    bool Grid,
    bool Bidi,
    bool Harfbuzz,
    bool Wasm,
    IReadOnlyList<string> Locales
);

/// <summary>Configuration options for a <see cref="LombokPdfClient"/> instance.</summary>
public sealed record LombokPdfOptions(
    string Locale  = "en-US",
    string Theme   = "modern-corporate-flat",
    bool   Debug   = false,
    int    TimeoutMs = 30_000
)
{
    public static LombokPdfOptions Default => new();
}
