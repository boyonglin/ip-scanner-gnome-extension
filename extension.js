// GNOME Shell extension — IP Scanner Indicator
// Set NOPASSWD: sudo visudo -f /etc/sudoers.d/ipscanner
// ------------------------------------------------------------

'use strict';

const { GObject, St, Gio, GLib } = imports.gi;
const Main           = imports.ui.main;
const PanelMenu      = imports.ui.panelMenu;
const PopupMenu      = imports.ui.popupMenu;
const Clipboard      = St.Clipboard.get_default();
const ExtensionUtils = imports.misc.extensionUtils;

/* ------------------ Tunable parameters ------------------ */
const INDICATOR_ICON = 'applications-internet-symbolic';
const ICON_STYLE     = 'padding:0; margin:0;';
const CACHE_TTL_SEC  = 24 * 60 * 60; // 24h cache lifetime
/* -------------------------------------------------------- */

function _scriptPath() {
    return `${ExtensionUtils.getCurrentExtension().path}/scripts/scan_free_ip.sh`;
}

var IpIndicator = GObject.registerClass(
class IpIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'IP Scanner Indicator'); // 0.5 = center-align menu arrow

        // Initialize settings
        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.ip-scanner');

        this.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(INDICATOR_ICON),
            style: ICON_STYLE,
            style_class: 'system-status-icon',
        }));

        /* -------- Internal state -------- */
        this._scanning  = false;  // true while a scan subprocess is running
        this._currentProc = null; // reference to current subprocess

        // Load cached data from settings
        this._loadCacheFromSettings();

        this._buildMenu(this._cachedIps, /*loading*/ false);

        /* -------- Rebuild menu on open; never auto-scan -------- */
        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen)
                this._buildMenu(this._cachedIps, /*loading*/ this._scanning);
        });
    }

    // Override the event handling to properly separate left/right clicks
    vfunc_event(event) {
        if (event.type() === imports.gi.Clutter.EventType.BUTTON_PRESS) {
            if (event.get_button() === 3) {
                // Right-click: open preferences only
                ExtensionUtils.openPrefs();
                return imports.gi.Clutter.EVENT_STOP;
            } else if (event.get_button() === 1) {
                // Left-click: toggle menu
                this.menu.toggle();
                return imports.gi.Clutter.EVENT_STOP;
            }
        }
        return super.vfunc_event(event);
    }

    /* ---------------- Manual scan (invoked by Refresh) ---------------- */
    _scanAsync() {
        const script = _scriptPath();
        if (!GLib.file_test(script, GLib.FileTest.EXISTS | GLib.FileTest.IS_EXECUTABLE))
            return;

        this._scanning = true;
        this._cachedIps = []; // Clear previous results
        this._cacheTime = 0;  // Reset cache time
        this._saveCacheToSettings(); // Clear persistent cache
        this._buildMenu(this._cachedIps, /*loading*/ true);

        this._currentProc = Gio.Subprocess.new(
            [script],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        // Read output line by line to get incremental updates
        const stdoutStream = this._currentProc.get_stdout_pipe();
        const dataInputStream = Gio.DataInputStream.new(stdoutStream);

        this._readOutputAsync(dataInputStream, this._currentProc);
    }

    _cancelScan() {
        // Terminate the subprocess if it's running
        if (this._currentProc) {
            try {
                this._currentProc.force_exit();
            } catch (e) {
                // Process might already be finished
            }
            this._currentProc = null;
        }
        
        this._scanning = false;
        this._buildMenu(this._cachedIps, /*loading*/ false);
    }

    _readOutputAsync(dataInputStream, proc) {
        dataInputStream.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
            try {
                const [line] = stream.read_line_finish_utf8(res);

                if (line !== null) {
                    const trimmed = line.trim();

                    // Check if this line contains a valid IP address
                    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
                        this._insertIpSorted(trimmed);
                        this._cacheTime = Date.now();
                        // Save to persistent storage
                        this._saveCacheToSettings();
                        // Update menu immediately when we get a new IP
                        this._buildMenu(this._cachedIps, /*loading*/ true);
                    }

                    // Continue reading next line
                    this._readOutputAsync(dataInputStream, proc);
                } else {
                    // End of stream - wait for process to finish
                    proc.wait_async(null, (p, waitRes) => {
                        try {
                            p.wait_finish(waitRes);
                        } catch (e) {
                            logError(e, 'IP‑Scanner subprocess failed');
                        } finally {
                            this._currentProc = null;
                            this._scanning = false;
                            this._buildMenu(this._cachedIps, /*loading*/ false);
                        }
                    });
                }
            } catch (e) {
                logError(e, 'Error reading scan output');
                this._scanning = false;
                this._buildMenu(this._cachedIps, /*loading*/ false);
            }
        });
    }

    _insertIpSorted(ip) {
        // If it already exists, skip
        if (this._cachedIps.includes(ip))
            return;

        // Only take the last octet as the comparison value
        const lastOctet = s => parseInt(s.split('.').pop(), 10);
        const value = lastOctet(ip);

        let lo = 0, hi = this._cachedIps.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (lastOctet(this._cachedIps[mid]) < value)
                lo = mid + 1;
            else
                hi = mid;
        }

        // Insert at the correct sorted position
        this._cachedIps.splice(lo, 0, ip);
    }

    /* ------------- Cache persistence methods ------------- */
    _loadCacheFromSettings() {
        try {
            const cachedIpsJson = this._settings.get_string('cached-ips');
            this._cachedIps = JSON.parse(cachedIpsJson) || [];
            this._cacheTime = this._settings.get_uint64('cache-time');
        } catch (e) {
            // If parsing fails, use empty defaults
            this._cachedIps = [];
            this._cacheTime = 0;
        }
    }

    _saveCacheToSettings() {
        try {
            this._settings.set_string('cached-ips', JSON.stringify(this._cachedIps));
            this._settings.set_uint64('cache-time', this._cacheTime);
        } catch (e) {
            logError(e, 'Failed to save cache to settings');
        }
    }

    /* ------------- Build the popup menu ------------- */
    _buildMenu(ipArray, loading = false) {
        this.menu.removeAll();

        // Manual refresh trigger
        const refreshText = this._scanning ? 'Cancel Scan' : 'Refresh';
        this.menu.addAction(refreshText, () => {
            if (this._scanning) {
                this._cancelScan();
            } else {
                this._scanAsync();
            }
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (loading) {
            if (ipArray && ipArray.length > 0) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem(`Scanning… (${ipArray.length} found so far)`, { reactive: false }));
                // Show any IPs found so far during scanning
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                ipArray.forEach(ip =>
                    this.menu.addAction(ip, () => Clipboard.set_text(St.ClipboardType.CLIPBOARD, ip))
                );
            } else {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Scanning…', { reactive: false }));
            }
            return;
        }

        const now = Date.now();
        const expired = (now - this._cacheTime) > CACHE_TTL_SEC * 1000;

	    // If we have no results yet and cache isn't expired (i.e., never scanned), say so.
        if ((!ipArray || ipArray.length === 0) && !expired) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('No free IP found', { reactive: false }));
            return;
        }

        // Cache has expired: show stale data but warn user
        if (expired) {
            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem('Refresh to update (> 24 h)', { reactive: false })
            );
        }

        ipArray.forEach(ip =>
            this.menu.addAction(ip, () => Clipboard.set_text(St.ClipboardType.CLIPBOARD, ip))
        );
    }
});

/* ---------------- Enable / Disable lifecycle ---------------- */
let _indicator;

function enable () {
    _indicator = new IpIndicator();
    Main.panel.addToStatusArea('ip-scanner', _indicator);
}

function disable () {
    if (_indicator) {
        // Cancel any running scan
        if (_indicator._scanning) {
            _indicator._cancelScan();
        }
        _indicator.destroy();
        _indicator = null;
    }
}