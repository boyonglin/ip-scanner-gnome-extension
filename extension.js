// GNOME Shell extension — IP Scanner Indicator (async, run‑on‑open)
// Drop both extension.js and scan_free_ip.sh in:
//   ~/.local/share/gnome-shell/extensions/ip-scanner@local/
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
const INDICATOR_ICON = 'applications-science-symbolic';
const ICON_STYLE     = 'padding:0;margin:0;';
const CACHE_TTL_SEC  = 24 * 60 * 60; // 24h cache lifetime
/* -------------------------------------------------------- */

function _scriptPath() {
    return `${ExtensionUtils.getCurrentExtension().path}/scan_free_ip.sh`;
}

var IpIndicator = GObject.registerClass(
class IpIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'IP Scanner Indicator'); // 0.5 = center-align menu arrow

        this.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(INDICATOR_ICON),
            style: ICON_STYLE,
            style_class: 'system-status-icon',
        }));

        /* -------- Internal state -------- */
        this._cachedIps = [];     // last scan results
        this._cacheTime = 0;      // epoch ms of last scan
        this._scanning  = false;  // true while a scan subprocess is running

        this._buildMenu(this._cachedIps, /*loading*/ false);

        /* -------- Rebuild menu on open; never auto-scan -------- */
        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen)
                this._buildMenu(this._cachedIps, /*loading*/ this._scanning);
        });
    }

    /* ---------------- Manual scan (invoked by Refresh) ---------------- */
    _scanAsync() {
        const script = _scriptPath();
        if (!GLib.file_test(script, GLib.FileTest.EXISTS | GLib.FileTest.IS_EXECUTABLE))
            return;

        this._scanning = true;
        this._buildMenu(this._cachedIps, /*loading*/ true);

        const proc = Gio.Subprocess.new(
            ['bash', '-c', `"${script}"`],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        );

        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, stdout] = p.communicate_utf8_finish(res);
                const ips = stdout.split('\n')
                    .map(l => l.trim())
                    .filter(l => /^\d{1,3}(\.\d{1,3}){3}$/.test(l));

                this._cachedIps = ips;
                this._cacheTime = Date.now();
            } catch (e) {
                logError(e, 'IP‑Scanner subprocess failed');
            } finally {
                this._scanning = false;
                this._buildMenu(this._cachedIps, /*loading*/ false);
            }
        });
    }

    /* ------------- Build the popup menu ------------- */
    _buildMenu(ipArray, loading = false) {
        this.menu.removeAll();

        // Manual refresh trigger
        this.menu.addAction('Refresh', () => {
            if (!this._scanning) this._scanAsync();
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (loading) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Scanning…', { reactive: false }));
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
                new PopupMenu.PopupMenuItem('Cache > 24 h — Refresh to update', { reactive: false })
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
        _indicator.destroy();
        _indicator = null;
    }
}

