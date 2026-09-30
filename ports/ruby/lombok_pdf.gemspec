# frozen_string_literal: true

require_relative 'lib/lombok_pdf/version'

Gem::Specification.new do |spec|
  spec.name          = 'lombok_pdf'
  spec.version       = LombokPDF::VERSION
  spec.authors       = ['Lombok Digital']
  spec.email         = ['hello@codinglombok.dev']

  spec.summary       = 'Lightweight, elegant, polyglot PDF generation'
  spec.description   = 'LombokPDF is a next-generation PDF generation library with ' \
                        'full internationalization, multi-language ports, and Apache 2.0 license.'
  spec.homepage      = 'https://lombokpdf.dev'
  spec.license       = 'Apache-2.0'
  spec.required_ruby_version = '>= 3.0.0'

  spec.metadata['homepage_uri']    = spec.homepage
  spec.metadata['source_code_uri'] = 'https://github.com/codinglombok/lombokpdf'
  spec.metadata['changelog_uri']   = 'https://github.com/codinglombok/lombokpdf/blob/main/CHANGELOG.md'
  spec.metadata['bug_tracker_uri'] = 'https://github.com/codinglombok/lombokpdf/issues'
  spec.metadata['rubygems_mfa_required'] = 'true'

  spec.files = Dir.chdir(__dir__) do
    `git ls-files -z`.split("\x0").reject do |f|
      (File.expand_path(f) == __FILE__) ||
        f.start_with?(*%w[bin/ test/ spec/ features/ .git .circleci appveyor Gemfile])
    end
  end
  spec.bindir        = 'exe'
  spec.executables   = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ['lib']

  spec.add_dependency 'wasmtime', '~> 22.0'
  spec.add_dependency 'nokogiri', '~> 1.16'
  spec.add_dependency 'redcarpet', '~> 3.6'    # Markdown
  spec.add_dependency 'twitter_cldr', '~> 6.11' # i18n/CLDR

  spec.add_development_dependency 'rspec', '~> 3.13'
  spec.add_development_dependency 'rubocop', '~> 1.65'
  spec.add_development_dependency 'yard', '~> 0.9'
end
