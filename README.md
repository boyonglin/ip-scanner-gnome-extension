# IP Scanner GNOME Shell Extension

This GNOME Shell extension adds an indicator to the top panel that scans for and displays a list of available IP addresses on the local network. Clicking on an IP address in the list copies it to the clipboard.

## Features

-   Scans a configurable range of IP addresses to find free ones.
-   Adds an indicator to the GNOME Shell top panel.
-   Displays a list of available IPs in a dropdown menu.
-   Click-to-copy functionality for easy use.
-   Caches results for 24 hours to avoid excessive scanning.

## Installation

1.  **Clone or download this repository.**

2.  **Copy the extension files** to your local GNOME Shell extensions directory:
    ```bash
    cp -r . ~/.local/share/gnome-shell/extensions/ip-scanner@local
    ```

3.  **Make the scanning script executable:**
    ```bash
    chmod +x ~/.local/share/gnome-shell/extensions/ip-scanner@local/scan_free_ip.sh
    ```

4.  **Configure passwordless `sudo`:**
    This extension requires `sudo` to temporarily add IP aliases for testing connectivity. You need to allow the script to be run without a password.

    Create a new file for `sudoers`:
    ```bash
    sudo visudo -f /etc/sudoers.d/ipscanner
    ```

    Add the following line to the file, replacing `YOUR_USERNAME` with your actual username and ensuring the path to the script is correct:
    ```
    YOUR_USERNAME ALL=(ALL) NOPASSWD: /home/YOUR_USERNAME/.local/share/gnome-shell/extensions/ip-scanner@local/scan_free_ip.sh
    ```

5.  **Enable the extension:**
    -   You can use the GNOME Extensions application to enable "IP Scanner Indicator".
    -   Alternatively, you can use the command line:
        ```bash
        gnome-extensions enable ip-scanner@local
        ```
    -   You may need to restart GNOME Shell for the extension to appear (`Alt`+`F2`, type `r`, and press `Enter`).

## Configuration

The IP range and network interface can be configured by editing the `scan_free_ip.sh` script:

```bash
#!/usr/bin/env bash
# Scan 192.168.15.50–99 and list usable static IP addresses
# ------------------ User parameters ------------------
iface="wlp0s20f3"    # Network interface name (check via: ip -br link)
netmask="/24"	     # Netmask 255.255.255.0
gateway="192.168.15.1"
dns_test="8.8.8.8"
candidates=( $(seq -f "192.168.15.%g" 50 99) )  # Range to probe
# ------------------------------------------------
```

-   `iface`: The name of your network interface (e.g., `eth0`, `wlan0`).
-   `netmask`: The netmask for the IP addresses.
-   `gateway`: The gateway address for your network.
-   `dns_test`: A public DNS server to test for internet connectivity.
-   `candidates`: The range of IP addresses to scan.

## Usage

1.  Click the indicator icon in the top panel.
2.  Click "Refresh" to start a scan.
3.  The menu will show "Scanning..." while the scan is in progress.
4.  Once complete, the list of available IPs will be displayed.
5.  Click on any IP address to copy it to your clipboard.

## How It Works

-   **`extension.js`**: The main GNOME Shell extension file. It creates the panel indicator and menu. When "Refresh" is clicked, it executes the `scan_free_ip.sh` script.
-   **`scan_free_ip.sh`**: This script performs the network scan. It iterates through the `candidates` list, temporarily assigns each IP to the specified network interface, and then pings the gateway and a public DNS server to check for connectivity.
-   **`metadata.json`**: Contains metadata about the extension, such as its name, description, and supported GNOME Shell versions.

## License

This project is licensed under the MIT License.
