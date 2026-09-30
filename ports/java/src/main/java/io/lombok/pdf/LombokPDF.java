package io.lombok.pdf;

import java.util.List;
import java.util.Map;
import java.util.Locale;

/**
 * LombokPDF — Java Port
 * Lightweight, elegant, polyglot PDF generation. Apache 2.0.
 *
 * <p>Example — from HTML:
 * <pre>{@code
 * LombokPDF pdf = new LombokPDF();
 * Document doc = pdf.from(Source.html("<h1>Hello, World</h1>"))
 *                   .locale("en-US")
 *                   .export(Format.PDF);
 * doc.save(Path.of("output.pdf"));
 * }</pre>
 *
 * <p>Example — from template:
 * <pre>{@code
 * Document doc = pdf.from(Source.template("invoice", Map.of("company", "Acme")))
 *                   .locale("id-ID")
 *                   .export(Format.PDF_A_1B);
 * }</pre>
 *
 * <p>Example — Arabic RTL:
 * <pre>{@code
 * Document doc = pdf.from(Source.html("<h1>مرحباً</h1>"))
 *                   .locale("ar-SA")
 *                   .export(Format.PDF);
 * }</pre>
 *
 * @see Builder
 * @see Document
 */
public final class LombokPDF {

    private final LombokPDFOptions options;
    private final LLEEngine engine;

    public LombokPDF() {
        this(LombokPDFOptions.defaults());
    }

    public LombokPDF(LombokPDFOptions options) {
        this.options = options;
        this.engine  = new LLEEngine(options);
    }

    /**
     * Begin a fluent builder chain from a source.
     *
     * @param source the input source (HTML, Markdown, template, file, or URL)
     * @return a {@link Builder} for chaining locale, theme, skills, and export
     */
    public Builder from(Source source) {
        return new Builder(source, engine, options);
    }

    /** Shorthand for {@code from(Source.html(html))}. */
    public Builder fromHTML(String html) {
        return from(Source.html(html));
    }

    /** Shorthand for {@code from(Source.markdown(md))}. */
    public Builder fromMarkdown(String markdown) {
        return from(Source.markdown(markdown));
    }

    /** Shorthand for {@code from(Source.template(name, data))}. */
    public Builder fromTemplate(String name, Map<String, Object> data) {
        return from(Source.template(name, data));
    }

    /** Shorthand for {@code from(Source.file(path))}. */
    public Builder fromFile(String path) {
        return from(Source.file(path));
    }

    /** Library version. */
    public static String version() {
        return "1.0.0";
    }

    /** Feature support matrix for this runtime. */
    public static SupportMatrix supported() {
        return new SupportMatrix(
            true,  // cssPagedMedia
            true,  // flexbox
            true,  // grid
            true,  // bidi
            true,  // harfbuzz
            true,  // wasm (Chicory pure-Java runtime)
            LocaleResolver.availableLocales()
        );
    }

    /**
     * Feature support matrix record.
     */
    public record SupportMatrix(
        boolean cssPagedMedia,
        boolean flexbox,
        boolean grid,
        boolean bidi,
        boolean harfbuzz,
        boolean wasm,
        List<String> locales
    ) {}
}
