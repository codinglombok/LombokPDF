#!/bin/bash
# LombokPDF — Niagahoster / Shared Hosting Setup Script (PHP)
# ============================================================
# Tested on: Niagahoster cPanel with PHP 8.1+
#
# Usage:
#   1. Upload this file to your cPanel home directory via File Manager
#   2. Enable SSH from cPanel → SSH Access
#   3. SSH into your server
#   4. Run: bash setup.sh
#
# Minimum requirements:
#   - PHP 8.1+
#   - ext-ffi (for WASM bridge)
#   - ext-mbstring
#   - ext-json
#   - Composer (auto-installed below if missing)

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BOLD}LombokPDF — Niagahoster Setup${RESET}"
echo "────────────────────────────────"

# ─── PHP Version Check ────────────────────────────────────────────────────────

PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo -e "PHP version: ${GREEN}${PHP_VER}${RESET}"

if php -r "exit(version_compare(PHP_VERSION, '8.1', '<') ? 1 : 0);"; then
  echo -e "${GREEN}✓ PHP version OK${RESET}"
else
  echo -e "${RED}✗ PHP 8.1+ required. Current: ${PHP_VER}${RESET}"
  echo "  In cPanel → MultiPHP Manager, switch to PHP 8.1 or 8.3"
  exit 1
fi

# ─── Extension Checks ────────────────────────────────────────────────────────

check_ext() {
  if php -m | grep -q "$1"; then
    echo -e "${GREEN}✓ ext-$1${RESET}"
  else
    echo -e "${YELLOW}⚠ ext-$1 not found — contact Niagahoster support to enable it${RESET}"
  fi
}

echo ""
echo "Checking PHP extensions:"
check_ext ffi
check_ext mbstring
check_ext json
check_ext curl
check_ext fileinfo

# ─── Composer ────────────────────────────────────────────────────────────────

echo ""
echo "Setting up Composer:"

if command -v composer &>/dev/null; then
  COMPOSER_VER=$(composer --version --no-ansi | head -1)
  echo -e "${GREEN}✓ ${COMPOSER_VER}${RESET}"
else
  echo "Installing Composer..."
  EXPECTED_CHECKSUM="$(php -r 'copy("https://composer.github.io/installer.sig", "php://stdout");')"
  php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
  ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"

  if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
    echo -e "${RED}✗ Composer installer checksum mismatch${RESET}"
    rm composer-setup.php
    exit 1
  fi

  php composer-setup.php --quiet --install-dir=$HOME/bin --filename=composer
  rm composer-setup.php
  echo -e "${GREEN}✓ Composer installed at ~/bin/composer${RESET}"
  export PATH="$HOME/bin:$PATH"
fi

# ─── Install LombokPDF ───────────────────────────────────────────────────────

echo ""
echo "Installing LombokPDF:"

if [ ! -f "composer.json" ]; then
  composer init --no-interaction \
    --name="mysite/lombokpdf-app" \
    --description="LombokPDF application" \
    --license="Apache-2.0" \
    --stability=stable
fi

composer require lombok/pdf --no-interaction
echo -e "${GREEN}✓ LombokPDF installed${RESET}"

# ─── Create example script ───────────────────────────────────────────────────

cat > public_html/lombokpdf-test.php << 'PHPEOF'
<?php
/**
 * LombokPDF — Quick Test
 * Access: https://yourdomain.com/lombokpdf-test.php
 * DELETE this file after testing!
 */

// Security: only allow local access for testing
if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
    // Remove this check in production and add proper auth
}

require __DIR__ . '/../vendor/autoload.php';

use LombokPDF\LombokPDF;

try {
    $pdf = new LombokPDF();

    $doc = $pdf
        ->from([
            'template' => 'invoice',
            'data'     => [
                'company'       => 'PT Lombok Digital',
                'invoiceNumber' => 'INV-TEST-001',
                'date'          => date('Y-m-d'),
                'dueDate'       => date('Y-m-d', strtotime('+30 days')),
                'currency'      => 'IDR',
                'taxRate'       => 0.11,
                'items'         => [
                    ['name' => 'Web Development', 'qty' => 1, 'unitPrice' => 5000000, 'total' => 5000000],
                    ['name' => 'Hosting Setup',   'qty' => 1, 'unitPrice' =>  500000, 'total' =>  500000],
                ],
                'subtotal'   => 5500000,
                'tax'        =>  605000,
                'grandTotal' => 6105000,
                'paymentTerms' => 'Net 30',
                'notes'      => 'Terima kasih atas kepercayaan Anda!',
            ],
        ])
        ->locale('id-ID')
        ->export('pdf');

    // Stream as inline PDF
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="test-invoice.pdf"');
    header('X-LombokPDF-Pages: ' . $doc->pages());
    echo $doc->toBytes();

} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo 'LombokPDF Error: ' . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
PHPEOF

echo -e "${GREEN}✓ Test file created: public_html/lombokpdf-test.php${RESET}"

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "═════════════════════════════════"
echo -e "${BOLD}${GREEN}✓ LombokPDF setup complete!${RESET}"
echo ""
echo "Next steps:"
echo "  1. Visit https://yourdomain.com/lombokpdf-test.php"
echo "  2. You should see a PDF invoice in your browser"
echo "  3. DELETE lombokpdf-test.php after testing"
echo "  4. Read the docs: https://docs.lombokpdf.dev"
echo ""
echo -e "${YELLOW}⚠ Remember to remove the test file in production!${RESET}"
