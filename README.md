# IP Scanner GNOME Shell Extension

This GNOME Shell extension adds an indicator to the top panel that scans for and displays a list of available IP addresses on the local network. Clicking on an IP address in the list copies it to the clipboard.

## Features

-   Scans a configurable range of IP addresses to find free ones.
-   Adds an indicator to the GNOME Shell top panel.
-   Displays a list of available IPs in a dropdown menu, updating incrementally as they are found.
-   Click-to-copy functionality for easy use.
-   Caches results for 24 hours to avoid excessive scanning.
-   Configuration via a preferences dialog.

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

All configuration is now handled through the extension's preferences window.

To access the preferences, open the GNOME Extensions application, find "IP Scanner Indicator," and click the settings icon. You can also right-click the indicator in the top panel.

The following options are available:

-   **Network Interface**: The name of your network interface (e.g., `eth0`, `wlan0`).
-   **Netmask**: The netmask for the IP addresses (e.g., `/24`).
-   **Gateway**: The gateway address for your network.
-   **DNS**: A public DNS server to test for internet connectivity.
-   **IP Prefix**: The prefix for the IP addresses to be scanned (e.g., `192.168.15.`).
-   **Candidate Start**: The starting number of the IP address range to scan.
-   **Candidate End**: The ending number of the IP address range to scan.

## Usage

1.  Click the indicator icon in the top panel.
2.  Click "Refresh" to start a scan.
3.  The menu will show "Scanning..." and will update incrementally as free IPs are found.
4.  Once complete, the list of available IPs will be displayed.
5.  Click on any IP address to copy it to your clipboard.

## How It Works

-   **`extension.js`**: The main GNOME Shell extension file. It creates the panel indicator and menu. When "Refresh" is clicked, it executes the `scan_free_ip.sh` script.
-   **`scan_free_ip.sh`**: This script performs the network scan. It reads the configuration from the extension's settings, then iterates through the candidate IPs, temporarily assigns each IP to the specified network interface, and then pings the gateway and a public DNS server to check for connectivity.
-   **`prefs.js`**: Implements the preferences window for the extension.
-   **`metadata.json`**: Contains metadata about the extension, such as its name, description, and supported GNOME Shell versions.

## License

This project is licensed under the MIT License.
