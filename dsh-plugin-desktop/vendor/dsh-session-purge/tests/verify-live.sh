#!/bin/bash
# Verify the running EZAI app loaded the session-purge plugin, and surface any
# purge diagnostics it has logged. Run AFTER restarting EZAI.
# Usage: bash verify-live.sh
set -u

LOG=~/Library/Application\ Support/EZAI\ Desktop/logs/dsh-$(date +%Y-%m-%d).log
INSTALLED=~/.dsh/profiles/dsh-session-purge/lib/index.js

echo "=== 1. did the app restart since the plugin was built? ==="
LOG_T=$(stat -f '%m' "$LOG" 2>/dev/null || echo 0)
PLUGIN_T=$(stat -f '%m' "$INSTALLED" 2>/dev/null || echo 0)
echo "app log last write : $(stat -f '%Sm' "$LOG" 2>/dev/null)"
echo "plugin deployed    : $(stat -f '%Sm' "$INSTALLED" 2>/dev/null)"
if [ "$LOG_T" -gt "$PLUGIN_T" ]; then
  echo "OK: the app has written its log AFTER the plugin was deployed."
else
  echo ">>> NOT RESTARTED: the app log predates the plugin. Quit (Cmd+Q) and reopen EZAI."
fi

echo
echo "=== 2. patch layer the desktop app reads (\$DSH_HOME/cordis.patch.yml) ==="
grep -A2 '^\- insert' ~/.dsh/cordis.patch.yml 2>/dev/null || echo ">>> MISSING: the session-purge row is absent"

echo
echo "=== 3. purge diagnostics from the app log ==="
if grep -i "session-purge" "$LOG" >/dev/null 2>&1; then
  grep -i "session-purge" "$LOG" | tail -20
else
  echo "(none yet — no delete has reached the Host since this boot)"
fi

echo
echo "=== 4. any loader error mentioning purge? ==="
grep -iE "failed to (import|apply).*purge|purge.*(error|failed)" "$LOG" 2>/dev/null || echo "(none — the plugin loaded cleanly)"

echo
echo "=== 5. sessions on disk / workspace accounting ==="
echo "log directories:"
find ~/.dsh/sessions -name "session.jsonl*" 2>/dev/null | sed 's|.*/\(session-[^/]*\)/.*|  \1|' | sort
echo "workspace.json sessionIds:"
ELECTRON_RUN_AS_NODE=1 "/Applications/EZAI Desktop.app/Contents/MacOS/EZAI Desktop" -e "
const w=require(process.env.HOME+'/.dsh/storages/workspace.json');
for (const ws of Object.values(w.tables.workspaces)) for (const s of ws.sessionIds) console.log('  '+s);
" 2>/dev/null
