#!/usr/bin/env bash
# Scan 192.168.15.50–99 and list usable static IP addresses
# ------------------ User parameters ------------------
iface="wlp0s20f3"    # Network interface name (check via: ip -br link)
netmask="/24"	     # Netmask 255.255.255.0
gateway="192.168.15.1"
dns_test="8.8.8.8"
candidates=( $(seq -f "192.168.15.%g" 50 99) )  # Range to probe
# ------------------------------------------------

# Ping options
# -c1 : send 1 probe
# -W0.3 : 0.3s timeout (GNU ping; adjust if busybox)
# -I <ip> : source address
PING_OPTS="-c1 -W0.3"

## ---------- Phase 1: Add alias, test outbound ----------
reachable=()
for ip in "${candidates[@]}"; do
  # Add a temporary secondary IP alias
  sudo ip addr add "${ip}${netmask}" dev "$iface" label "${iface}:probe" 2>/dev/null \
    || { echo "$ip ➜ alias add failed"; continue; }

  # Test gateway and external DNS reachability
  if ping $PING_OPTS -I "$ip" "$gateway" &>/dev/null && \
     ping $PING_OPTS -I "$ip" "$dns_test" &>/dev/null; then
    reachable+=("$ip")
  fi

  # Clean up alias
  sudo ip addr del "${ip}${netmask}" dev "$iface"
done

## -------- Phase 2: Filter out "silent" hosts --------
filtered=()
for ip in "${reachable[@]}"; do
  if ping -c1 "$ip" 2>&1 | grep -q 'Unreachable'; then
      # keep: explicit Unreachable diagnostic / drop: pure timeout
      filtered+=("$ip")
  fi
done
reachable=("${filtered[@]}")

echo "===== Available addresses ====="
printf '  %s\n' "${reachable[@]}"
