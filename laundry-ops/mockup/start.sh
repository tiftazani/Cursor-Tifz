#!/bin/sh
# Jalanin di Mac/laptop lo. localhost:4173 di Cursor Cloud Agent
# bukan mesin lo — jangan nunggu port itu hidup di Macbook.
cd "$(dirname "$0")"
exec python3 -m http.server 4173 --bind 127.0.0.1
