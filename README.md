# IP Scanner GNOME Shell Extension

This GNOME Shell extension adds an indicator to the top panel to scan for and display available IP addresses on the local network. Clicking an IP address in the list copies it to the clipboard.

## Features

*   Scans a configurable range of IP addresses to find available ones.
*   Copies the selected IP address to the clipboard.
*   Caches results for 24 hours to reduce network scanning.

## Installation

1.  **Download the code:**
    Clone or download this repository.

2.  **Copy the extension files:**
    ```bash
    cp -r . ~/.local/share/gnome-shell/extensions/ip-scanner@local
    ```

3.  **Make the scanning script executable:**
    ```bash
    chmod +x ~/.local/share/gnome-shell/extensions/ip-scanner@local/scripts/scan_free_ip.sh
    ```

4.  **Configure passwordless `sudo`:**
    The extension requires `sudo` to temporarily add IP aliases for testing connectivity.

    Create a new file for `sudoers`:
    ```bash
    sudo visudo -f /etc/sudoers.d/ipscanner
    ```

    Add the following line, replacing `YOUR_USERNAME` with your username:
    ```
    YOUR_USERNAME ALL=(ALL) NOPASSWD: /home/YOUR_USERNAME/.local/share/gnome-shell/extensions/ip-scanner@local/scripts/scan_free_ip.sh
    ```

5.  **Enable the extension:**
    *   Use the GNOME Extensions application to enable "IP Scanner".
    *   Alternatively, use the command line:
        ```bash
        gnome-extensions enable ip-scanner@local
        ```
    *   You may need to restart GNOME Shell (`Alt`+`F2`, type `r`, `Enter`).

## Configuration

To access the preferences, open the GNOME Extensions application and find "IP Scanner", then click the settings icon. You can also right-click the indicator in the top panel.

The following options are available:

*   **Network Interface**: Network interface name (e.g., `eth0`, `wlan0`).
*   **Netmask**: Network subnet mask (e.g., `/24`).
*   **Gateway**: Network gateway address.
*   **DNS**: Public DNS server for connectivity testing.
*   **IP Prefix**: IP address prefix to scan (e.g., `192.168.15.`).
*   **Candidate Start/End**: IP range boundaries for scanning.

## Usage

1.  Click the indicator icon in the top panel.
2.  Click "Refresh" to start a scan.
3.  The menu will show "Scanning..." and update as free IPs are found.
5.  Once complete, click on any IP address to copy it to your clipboard.

## How It Works

*   **`extension.js`**: The main extension file. It creates the panel indicator and menu. When "Refresh" is clicked, it executes the `scan_free_ip.sh` script.
*   **`scripts/scan_free_ip.sh`**: This script performs the network scan. It reads the configuration from settings, iterates through the candidate IPs, temporarily assigns each IP to the network interface, and pings the gateway and a public DNS to check for connectivity.
*   **`prefs.js`**: Implements the preferences window.
*   **`metadata.json`**: Contains metadata about the extension, such as its name, description, and supported GNOME Shell versions.

## Troubleshooting

*   **Scan does not start:** Press `Alt`+`F2`, type 'lg' and press `Enter`. Then, navigate to the 'Extensions' tab to check for error messages.
*   **Scan does not finish:** Ensure the `scan_free_ip.sh` script is executable and that the `sudo` configuration is correct. Also, verify the network settings in the preferences.
*   **No IPs are found:** Check that the configured IP range is correct for your network and that there are available IPs in that range.

## License

This project is licensed under the GPL-3.0 License.
