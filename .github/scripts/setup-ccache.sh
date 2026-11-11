#!/usr/bin/env bash
set -euo pipefail

# Compiler caching is an optimization; a package mirror outage must not block releases.
if ! command -v ccache >/dev/null 2>&1; then
  apt_options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20)
  if sudo apt-get "${apt_options[@]}" update &&
    sudo apt-get "${apt_options[@]}" install -y ccache; then
    echo 'Installed ccache.'
  else
    echo '::warning::Unable to install ccache; continuing with the normal compiler.'
  fi
fi

if command -v ccache >/dev/null 2>&1; then
  echo 'available=true' >> "$GITHUB_OUTPUT"
else
  echo 'available=false' >> "$GITHUB_OUTPUT"
fi
