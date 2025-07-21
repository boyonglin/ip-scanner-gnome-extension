#!/usr/bin/env bash
# Scan IP range and list usable static IP addresses with parallel processing
# to prevent GNOME Shell UI blocking and ensure responsive operation.
# ------------------ User parameters (from preferences) ------------------
SCHEMA="org.gnome.shell.extensions.ip-scanner"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read settings from GSettings with explicit schema directory
export GSETTINGS_SCHEMA_DIR="$(dirname "$SCRIPT_DIR")/schemas"
iface=$(gsettings get "$SCHEMA" iface | tr -d "'" | tr -d '"')
netmask=$(gsettings get "$SCHEMA" netmask | tr -d "'" | tr -d '"')
gateway=$(gsettings get "$SCHEMA" gateway | tr -d "'" | tr -d '"')
dns_test=$(gsettings get "$SCHEMA" dns | tr -d "'" | tr -d '"')
prefix=$(gsettings get "$SCHEMA" prefix | tr -d "'" | tr -d '"')
start_host=$(gsettings get "$SCHEMA" candidate-start | awk '{print $NF}')
end_host=$(gsettings get "$SCHEMA" candidate-end | awk '{print $NF}')

# Build candidates array from prefix and range
candidates=( $(seq -f "${prefix}%g" $start_host $end_host) )
# ------------------------------------------------

# Ping options
# -c1 : send 1 probe
# -W0.3 : 0.3s timeout (GNU ping; adjust if busybox)
# -I <ip> : source address
PING_OPTS="-c1 -W0.3 -I"

## ---------- Phase 1: Add alias, test outbound ----------
reachable=($(pkexec bash -c "
    for ip in ${candidates[*]}; do
        (
            ip addr add \"\${ip}${netmask}\" dev \"$iface\" label \"${iface}:probe\" 2>/dev/null && 
            ping $PING_OPTS \"\$ip\" \"$gateway\" &>/dev/null && 
            ping $PING_OPTS \"\$ip\" \"$dns_test\" &>/dev/null && 
            echo \"\$ip\"
            ip addr del \"\${ip}${netmask}\" dev \"$iface\" 2>/dev/null
        ) &
    done
    wait
"))

## -------- Phase 2: Filter out silent hosts --------
usable=()
for ip in "${reachable[@]}"; do
    # keep: explicit Unreachable diagnostic / drop: pure timeout
    if ping -c1 "$ip" 2>&1 | grep -q 'Unreachable'; then
        usable+=("$ip")
        # Output IP immediately when it passes phase 2
        echo "$ip"
    fi
done

exit 0