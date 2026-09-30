// Package lombokpdf provides a Go port of the LombokPDF library.
//
// LombokPDF is a lightweight, elegant PDF generation library
// with full internationalization, multi-language ports, and Apache 2.0 license.
//
// Usage:
//
//	import "github.com/codinglombok/lombokpdf"
//
//	pdf := lombokpdf.New()
//
//	// From HTML
//	doc, err := pdf.FromHTML("<h1>Hello, World</h1>").Locale("en-US").Export(lombokpdf.FormatPDF)
//	if err != nil { log.Fatal(err) }
//	if err := doc.Save("output.pdf"); err != nil { log.Fatal(err) }
//
//	// From template
//	doc, err = pdf.FromTemplate("invoice", lombokpdf.Vars{"company": "Acme", "total": 1500}).
//	    Locale("id-ID").Export(lombokpdf.FormatPDFA1b)
//
//	// Arabic RTL
//	doc, err = pdf.FromHTML("<h1>مرحباً</h1>").Locale("ar-SA").Export(lombokpdf.FormatPDF)

package lombokpdf

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Format specifies the output format.
type Format string

const (
	FormatPDF     Format = "pdf"
	FormatPDFA1b  Format = "pdf/a-1b"
	FormatPDFA2b  Format = "pdf/a-2b"
	FormatPDFUA   Format = "pdf/ua"
	FormatPNG     Format = "png"
	FormatSVG     Format = "svg"
)

// Vars is a convenience type for template data.
type Vars map[string]any

// Options configures a LombokPDF instance.
type Options struct {
	Locale  string
	Theme   string
	Debug   bool
	Timeout time.Duration
}

// DefaultOptions returns the default options.
func DefaultOptions() Options {
	return Options{
		Locale:  "en-US",
		Theme:   "modern-corporate-flat",
		Timeout: 30 * time.Second,
	}
}

// LombokPDF is the main client. Create with New() or NewWithOptions().
type LombokPDF struct {
	opts   Options
	engine *lleEngine
}

// New creates a LombokPDF client with default options.
func New() *LombokPDF {
	return NewWithOptions(DefaultOptions())
}

// NewWithOptions creates a LombokPDF client with custom options.
func NewWithOptions(opts Options) *LombokPDF {
	if opts.Locale == "" { opts.Locale = "en-US" }
	if opts.Theme  == "" { opts.Theme  = "modern-corporate-flat" }
	if opts.Timeout == 0 { opts.Timeout = 30 * time.Second }

	return &LombokPDF{
		opts:   opts,
		engine: newLLEEngine(opts),
	}
}

// Builder provides a fluent API for configuring and exporting a PDF.
type Builder struct {
	pdf      *LombokPDF
	source   source
	locale   string
	theme    string
	metadata map[string]string
	skills   []skill
}

type source struct {
	HTML     string
	Markdown string
	Template string
	Data     Vars
	File     string
	URL      string
}

type skill interface {
	Apply(doc *Document) (*Document, error)
}

// From begins a builder chain.
func (p *LombokPDF) From(s source) *Builder {
	return &Builder{
		pdf:    p,
		source: s,
		locale: p.opts.Locale,
		theme:  p.opts.Theme,
	}
}

// FromHTML is a shorthand for From with an HTML source.
func (p *LombokPDF) FromHTML(html string) *Builder {
	return p.From(source{HTML: html})
}

// FromMarkdown is a shorthand for From with a Markdown source.
func (p *LombokPDF) FromMarkdown(md string) *Builder {
	return p.From(source{Markdown: md})
}

// FromTemplate is a shorthand for From with a template source.
func (p *LombokPDF) FromTemplate(name string, data Vars) *Builder {
	return p.From(source{Template: name, Data: data})
}

// FromFile is a shorthand for From with a file source.
func (p *LombokPDF) FromFile(path string) *Builder {
	return p.From(source{File: path})
}

// Locale sets the locale for the document.
func (b *Builder) Locale(locale string) *Builder {
	b.locale = locale
	return b
}

// Theme sets the LombokCSS design theme.
func (b *Builder) Theme(theme string) *Builder {
	b.theme = theme
	return b
}

// Metadata sets PDF document metadata.
func (b *Builder) Metadata(key, value string) *Builder {
	if b.metadata == nil { b.metadata = make(map[string]string) }
	b.metadata[key] = value
	return b
}

// Pipe appends a skill to the post-processing pipeline.
func (b *Builder) Pipe(s skill) *Builder {
	b.skills = append(b.skills, s)
	return b
}

// Export renders and returns the Document.
func (b *Builder) Export(format Format) (*Document, error) {
	return b.ExportContext(context.Background(), format)
}

// ExportContext renders with a context for cancellation/timeout.
func (b *Builder) ExportContext(ctx context.Context, format Format) (*Document, error) {
	timeout := b.pdf.opts.Timeout
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	html, err := b.resolveSource()
	if err != nil { return nil, fmt.Errorf("lombokpdf: resolve source: %w", err) }

	renderOpts, _ := json.Marshal(map[string]any{
		"locale": b.locale,
		"theme":  b.theme,
		"format": string(format),
		"meta":   b.metadata,
	})

	raw, err := b.pdf.engine.render(ctx, html, renderOpts)
	if err != nil { return nil, fmt.Errorf("lombokpdf: render: %w", err) }

	doc := &Document{raw: raw}

	for _, s := range b.skills {
		doc, err = s.Apply(doc)
		if err != nil { return nil, fmt.Errorf("lombokpdf: skill: %w", err) }
	}

	return doc, nil
}

func (b *Builder) resolveSource() (string, error) {
	switch {
	case b.source.HTML != "":
		return b.source.HTML, nil
	case b.source.File != "":
		content, err := os.ReadFile(b.source.File)
		if err != nil { return "", err }
		ext := filepath.Ext(b.source.File)
		if ext == ".md" { return markdownToHTML(string(content)) }
		return string(content), nil
	case b.source.Template != "":
		return renderTemplate(b.source.Template, b.source.Data, b.locale)
	case b.source.URL != "":
		return fetchURL(b.source.URL)
	default:
		return "", fmt.Errorf("no source specified")
	}
}

// Document is a rendered PDF.
type Document struct {
	raw []byte
}

// Save writes the PDF to disk.
func (d *Document) Save(path string) error {
	return os.WriteFile(path, d.raw, 0600)
}

// Bytes returns the raw PDF bytes.
func (d *Document) Bytes() []byte {
	cp := make([]byte, len(d.raw))
	copy(cp, d.raw)
	return cp
}

// Size returns the document size in bytes.
func (d *Document) Size() int { return len(d.raw) }

// Version returns the LombokPDF library version.
func Version() string { return "1.0.0" }
