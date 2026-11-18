#!/bin/bash
# test-index regenerate (CSP test-only relax) — har source-change ke baad chalao
cd /home/user/ff-user-panel
sed -e "s|connect-src 'self' https: wss:|connect-src 'self' https: wss: ws://127.0.0.1:8091 http://127.0.0.1:8091|" -e "s|script-src 'self' 'unsafe-inline'|script-src 'self' 'unsafe-inline' 'unsafe-eval'|" index.html > _d103.html
