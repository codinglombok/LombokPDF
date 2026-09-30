//! # LombokPDF — Rust Port
//!
//! Lightweight, elegant, polyglot PDF generation. Apache 2.0.
//!
//! This is the highest-performance port — it calls the LombokLayout Engine (LLE)
//! directly with no FFI marshaling overhead, unlike other language ports which
//! communicate with LLE through a WASM ABI.
//!
//! ## Example: from HTML
//! ```no_run
//! use lombokpdf::{LombokPDF, Source, Format};
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let pdf = LombokPDF::new();
//! let doc = pdf.from(Source::Html("<h1>Hello, World</h1>".into()))
//!     .locale("en-US")
//!     .export(Format::Pdf)?;
//! doc.save("output.pdf")?;
//! # Ok(())
//! # }
//! ```
//!
//! ## Example: from template
//! ```no_run
//! use lombokpdf::{LombokPDF, Format};
//! use serde_json::json;
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let pdf = LombokPDF::new();
//! let doc = pdf.from_template("invoice", json!({ "company": "Acme", "total": 1500 }))
//!     .locale("id-ID")
//!     .export(Format::PdfA1b)?;
//! # Ok(())
//! # }
//! ```
//!
//! ## Example: Arabic RTL
//! ```no_run
//! use lombokpdf::{LombokPDF, Source, Format};
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let pdf = LombokPDF::new();
//! let doc = pdf.from(Source::Html("<h1>مرحباً</h1>".into()))
//!     .locale("ar-SA")
//!     .export(Format::Pdf)?;
//! # Ok(())
//! # }
//! ```

mod builder;
mod document;
mod locale;
mod error;

pub use builder::Builder;
pub use document::Document;
pub use locale::{LocaleConfig, resolve_locale, available_locales};
pub use error::LombokError;

use serde_json::Value;
use std::collections::HashMap;

/// Output format for a rendered document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Pdf,
    PdfA1b,
    PdfA2b,
    PdfUa,
    Png,
    Svg,
}

/// Input source for rendering.
#[derive(Debug, Clone)]
pub enum Source {
    Html(String),
    Markdown(String),
    Template { name: String, data: Value },
    File(String),
    Url(String),
}

/// Configuration options for a [`LombokPDF`] instance.
#[derive(Debug, Clone)]
pub struct LombokPdfOptions {
    pub locale:  String,
    pub theme:   String,
    pub debug:   bool,
    pub timeout_ms: u64,
}

impl Default for LombokPdfOptions {
    fn default() -> Self {
        Self {
            locale:     "en-US".to_string(),
            theme:      "modern-corporate-flat".to_string(),
            debug:      false,
            timeout_ms: 30_000,
        }
    }
}

/// Main entry point for the LombokPDF Rust port.
pub struct LombokPDF {
    options: LombokPdfOptions,
}

impl LombokPDF {
    /// Create a new client with default options.
    pub fn new() -> Self {
        Self { options: LombokPdfOptions::default() }
    }

    /// Create a new client with custom options.
    pub fn with_options(options: LombokPdfOptions) -> Self {
        Self { options }
    }

    /// Begin a fluent builder chain from a source.
    pub fn from(&self, source: Source) -> Builder {
        Builder::new(source, self.options.clone())
    }

    /// Shorthand: from HTML string.
    pub fn from_html(&self, html: impl Into<String>) -> Builder {
        self.from(Source::Html(html.into()))
    }

    /// Shorthand: from Markdown string.
    pub fn from_markdown(&self, md: impl Into<String>) -> Builder {
        self.from(Source::Markdown(md.into()))
    }

    /// Shorthand: from a named template with data.
    pub fn from_template(&self, name: impl Into<String>, data: Value) -> Builder {
        self.from(Source::Template { name: name.into(), data })
    }

    /// Shorthand: from a file path.
    pub fn from_file(&self, path: impl Into<String>) -> Builder {
        self.from(Source::File(path.into()))
    }

    /// Library version.
    pub fn version() -> &'static str {
        "1.0.0"
    }

    /// Feature support matrix for this runtime.
    pub fn supported() -> SupportMatrix {
        SupportMatrix {
            css_paged_media: true,
            flexbox:         true,
            grid:            true,
            bidi:            true,
            harfbuzz:        true,
            native:          true,   // Rust port calls LLE natively, no WASM overhead
            locales:         available_locales(),
        }
    }
}

impl Default for LombokPDF {
    fn default() -> Self {
        Self::new()
    }
}

/// Feature support matrix.
#[derive(Debug, Clone)]
pub struct SupportMatrix {
    pub css_paged_media: bool,
    pub flexbox:         bool,
    pub grid:            bool,
    pub bidi:            bool,
    pub harfbuzz:        bool,
    pub native:          bool,
    pub locales:         Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert_eq!(LombokPDF::version(), "1.0.0");
    }

    #[test]
    fn test_supported_matrix() {
        let matrix = LombokPDF::supported();
        assert!(matrix.css_paged_media);
        assert!(matrix.bidi);
        assert!(matrix.locales.len() >= 50);
    }

    #[test]
    fn test_from_html_builder() {
        let pdf = LombokPDF::new();
        let _builder = pdf.from_html("<h1>Test</h1>");
        // Builder created successfully
    }
}
