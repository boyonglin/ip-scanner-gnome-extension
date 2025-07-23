#!/usr/bin/env bash
# Scan IP range and list usable static IP addresses with parallel processing
# ------------------ User parameters ------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --iface)   iface=$2;     shift 2 ;;
    --netmask) netmask=$2;   shift 2 ;;
    --gateway) gateway=$2;   shift 2 ;;
    --dns)     dns_test=$2;  shift 2 ;;
    --prefix)  prefix=$2;    shift 2 ;;
    --range)   IFS=- read -r start_host end_host <<< "$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# Build candidates array from prefix and range
candidates=( $(seq -f "${prefix}%g" $start_host $end_host) )

# Remove self IP from candidates to avoid conflicts
self_ip=$(ip route get 8.8.8.8 | awk '/src/ { print $7; exit }')
candidates=( $(printf '%s\n' "${candidates[@]}" | grep -v -x "$self_ip") )
# ------------------------------------------------

# Ping options
# -c1 : send 1 probe
# -W0.3 : 0.3s timeout (GNU ping; adjust if busybox)
# -I <ip> : source address
PING_OPTS="-c1 -W0.3 -I"
MAX_JOBS=12

## ---------- Phase 1: Add alias, test outbound ----------
scan_one() {
    local ip=$1
    # Add a temporary secondary IP alias
    ip addr add "${ip}${netmask}" dev "$iface" label "${iface}:probe" 2>/dev/null || return

    # Test gateway and external DNS reachability
    if ping $PING_OPTS "$ip" "$gateway" &>/dev/null &&
       ping $PING_OPTS "$ip" "$dns_test" &>/dev/null; then
        echo "$ip"
    fi

    # Clean up alias
    ip addr del "${ip}${netmask}" dev "$iface"
}

export -f scan_one
export iface netmask gateway dns_test PING_OPTS

reachable=($(printf '%s\n' "${candidates[@]}" \
            | xargs -n1 -P $MAX_JOBS -I{} bash -c 'scan_one "$@"' _ {}))

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