#!/bin/sh
PORT=443 HOST= node server.js &
echo '127.0.0.1 example.app' >> /etc/hosts
APPLICATION_URL="https://example.app" node index.js baseline
APPLICATION_URL="https://example.app" node index.js extension
echo done
