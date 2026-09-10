#!/usr/bin/env bash
# Regenerates redacted test fixtures from the real bank schedules.
# The real PDFs are NOT in this repo — they carry client PII.
# Usage: scripts/make-fixtures.sh "/path/to/Cronogramas"
set -euo pipefail
SRC="${1:?Pass the directory holding the source PDFs}"
API_FX="$(dirname "$0")/../apps/api/test/fixtures"
WEB_FX="$(dirname "$0")/../apps/web/test/fixtures"
mkdir -p "$API_FX" "$WEB_FX"

# BCP page 1: the client's name and address occupy lines 2-4 with no label to
# match on, the loan number follows "CREDITO NRO :", and two insurance policy
# numbers sit inline as "(POLIZA nnnnn)".
extract_bcp() {
  pdftotext -layout -f 1 -l 1 "$1" - \
    | awk 'NR==2 { print "[REDACTADO]"; next } NR==3 || NR==4 { next } { print }' \
    | sed -E 's/(CREDITO NRO[^:]*:).*/\1 [REDACTADO]/' \
    | sed -E 's/\(POLIZA [0-9]+\)/(POLIZA [REDACTADO])/g'
}

# Interbank page 1: the client name and credit number share one line after
# "CLIENTE" (printed uppercase, so the label match must be case-insensitive).
# The two insurance policy numbers are the value following the "(8):"
# footnote marker; that same marker also labels two benign insurance-rate
# percentages, so only redact when the value is a bare number, not a "%".
extract_interbank() {
  pdftotext -layout -f 1 -l 1 "$1" - \
    | sed -E 's/([Cc][Ll][Ii][Ee][Nn][Tt][Ee][^:]*:).*/\1 [REDACTADO]/' \
    | awk '$0 ~ /\(8\) *:[[:space:]]*[0-9]/ && $0 !~ /%/ { sub(/\(8\) *:[[:space:]]*[0-9][^ ]*/, "(8): [REDACTADO]") } { print }'
}

extract_bcp "$SRC/BCP Simple CRONOGRAMA.pdf" > "$API_FX/bcp-page1.txt"
extract_interbank "$SRC/Interbank Simple Pepito 2 - 1. 27.02.25.pdf" > "$API_FX/interbank-page1.txt"

# Scanned bank: crop the header band AND the "Referencia" row (the loan
# reference number) off page 1, keeping the rest of the condition block.
# y=150 alone (cropping only the header) still included the Referencia row;
# y=182 starts right after it, verified by eye against the source PDF.
pdftoppm -jpeg -jpegopt quality=80 -r 110 -f 1 -l 1 -y 182 -H 388 \
  "$SRC/ScotiaBank - Simple Con Degravamen.pdf" "$WEB_FX/scotia-page1"
mv "$WEB_FX/scotia-page1-1.jpg" "$WEB_FX/scotia-page1.jpg"

echo "Fixtures written. REVIEW THEM BY EYE before committing."
