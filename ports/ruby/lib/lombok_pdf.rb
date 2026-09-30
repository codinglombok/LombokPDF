# frozen_string_literal: true

##
# LombokPDF — Ruby Port
# Lightweight, elegant PDF generation. Apache 2.0.
#
# Usage:
#   require 'lombok_pdf'
#
#   doc = LombokPDF.new.from(html: '<h1>Hello</h1>').locale('id-ID').export(:pdf)
#   doc.save('output.pdf')
#
# GitHub: https://github.com/codinglombok/lombokpdf
# Docs:   https://docs.lombokpdf.dev

require_relative 'lombok_pdf/version'
require_relative 'lombok_pdf/engine'
require_relative 'lombok_pdf/builder'
require_relative 'lombok_pdf/document'
require_relative 'lombok_pdf/locale'

# Main entry point for the LombokPDF Ruby port.
#
# @example From HTML
#   pdf = LombokPDF.new
#   doc = pdf.from(html: '<h1>Hello, World</h1>').locale('en-US').export(:pdf)
#   doc.save('hello.pdf')
#
# @example From template
#   doc = pdf.from_template('invoice', company: 'Acme', total: 1500)
#            .locale('id-ID')
#            .export(:pdf)
#
# @example Arabic RTL
#   doc = pdf.from(html: '<h1>مرحباً</h1>').locale('ar-SA').export(:pdf)
class LombokPDF
  attr_reader :options

  def initialize(locale: 'en-US', theme: 'modern-corporate-flat', debug: false, timeout: 30_000)
    @options = {
      locale: locale,
      theme: theme,
      debug: debug,
      timeout: timeout
    }
    @engine = LombokPDF::Engine.new(@options)
  end

  # Begin a fluent builder chain from a source hash.
  #
  # @param source [Hash] one of :html, :markdown, :template, :file, :url
  # @return [LombokPDF::Builder]
  def from(source)
    LombokPDF::Builder.new(source, @engine, @options)
  end

  # Shorthand: from HTML string
  def from_html(html, base_url: nil)
    from(html: html, base_url: base_url)
  end

  # Shorthand: from Markdown string
  def from_markdown(markdown)
    from(markdown: markdown)
  end

  # Shorthand: from a named template
  def from_template(name, **data)
    from(template: name, data: data)
  end

  # Shorthand: from a file path
  def from_file(path)
    from(file: path)
  end

  # Library version
  def self.version
    LombokPDF::VERSION
  end

  # Feature support matrix
  def self.supported
    {
      css_paged_media: true,
      flexbox: true,
      grid: true,
      bidi: true,
      harfbuzz: true,
      wasm: true,
      locales: LombokPDF::Locale.available_locales
    }
  end
end
