// GNOME Shell extension preferences UI
// ------------------------------------------------------------

'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const { Gio, Gtk } = imports.gi;
const Adw = imports.gi.Adw;

const WARNING_ICON = 'dialog-warning-symbolic';

/* ---------- helpers ---------- */

function have(klass) {
    return Adw && Adw[klass] !== undefined;
}

function _getSettings() {
    return ExtensionUtils.getSettings('org.gnome.shell.extensions.ip-scanner');
}

function _listIfaces() {
    try {
        const dir = Gio.File.new_for_path('/sys/class/net');
        const enumr = dir.enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null
        );
        const arr = [];
        let info;
        while ((info = enumr.next_file(null)) !== null) {
            const n = info.get_name();
            if (n !== 'lo')
                arr.push(n);
        }
        enumr.close(null);
        return arr;
    } catch (e) {
        logError(e, 'ip‑scanner: failed to enum interfaces');
        return [];
    }
}

/* ---------- live validation ---------- */

function markIfEmpty(row) {
    const entry = row._entry;
    if (!entry || !entry.get_text || !entry.set_icon_from_icon_name)
        return;

    const empty = entry.get_text().trim().length === 0;
    entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY,
                                  empty ? WARNING_ICON : null);
}

/* ---------- row builders ---------- */

function makeStringRow(label, key, settings) {
    let row, entry;

    if (have('EntryRow')) {
        row = new Adw.EntryRow({ title: label });
        entry = row.get_sensitive_child();
        row.text = settings.get_string(key) || '';
        row.connect('notify::text', () =>
            settings.set_string(key, row.text || '')
        );
    } else {
        row   = new Adw.ActionRow({ title: label });
        entry = new Gtk.Entry({ text: settings.get_string(key) || '' });
        entry.set_size_request(200, -1);
        entry.valign = Gtk.Align.CENTER;
        row.add_suffix(entry);
        row.activatable_widget = entry;
        entry.connect('changed', () =>
            settings.set_string(key, entry.get_text() || '')
        );
    }

    row._entry = entry;
    return row;
}

function makeUintRow(label, key, settings, upper = 255) {
    const row = new Adw.ActionRow({ title: label });
    const adj = new Gtk.Adjustment({
        lower: 0, upper, step_increment: 1, page_increment: 10,
    });
    const spin = new Gtk.SpinButton({ adjustment: adj, digits: 0 });
    spin.set_size_request(200, -1);
    spin.valign = Gtk.Align.CENTER;

    spin.set_value(settings.get_uint(key));
    spin.connect('value-changed', () =>
        settings.set_uint(key, spin.get_value_as_int())
    );

    row.add_suffix(spin);
    row.activatable_widget = spin;
    return row;
}

function makeIfaceRow(settings) {
    const ifaces = _listIfaces();
    const current = settings.get_string('iface') || '';

    /* GNOME 43+ */
    if (have('ComboRow')) {
        const list = new Gtk.StringList();
        ifaces.forEach(i => list.append(i));
        const row = new Adw.ComboRow({
            title: 'Network Interface',
            model: list,
            expression: new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'),
        });
        const idx = ifaces.indexOf(current);
        row.selected = idx >= 0 ? idx : 0;
        row.connect('notify::selected', () => {
            const item = row.get_selected_item();
            if (item) settings.set_string('iface', item.get_string());
        });
        return row;
    }

    /* GNOME 42 fallback */
    const row = new Adw.ActionRow({ title: 'Network Interface' });
    const list = new Gtk.StringList();
    ifaces.forEach(i => list.append(i));
    const dd = new Gtk.DropDown({ model: list });
    dd.set_size_request(200, -1);
    const idx = ifaces.indexOf(current);
    dd.set_selected(idx >= 0 ? idx : 0);
    dd.connect('notify::selected-item', () => {
        const item = dd.get_selected_item();
        if (item) settings.set_string('iface', item.get_string());
    });
    row.add_suffix(dd);
    row.activatable_widget = dd;
    return row;
}

/* ---------- preferences window ---------- */

function fillPreferencesWindow(window) {
    if (!(Adw && window instanceof Adw.PreferencesWindow))
        return;

    const settings = _getSettings();
    const page = new Adw.PreferencesPage({ margin_top: 16, margin_bottom: 16,
                                           margin_start: 16, margin_end: 16 });

    /* network group */
    const netGroup = new Adw.PreferencesGroup({ title: 'Network Settings' });
    const ifaceRow   = makeIfaceRow(settings);
    const netmaskRow = makeStringRow('Netmask', 'netmask', settings);
    const gwRow      = makeStringRow('Gateway', 'gateway', settings);
    const dnsRow     = makeStringRow('DNS', 'dns', settings);
    netGroup.add(ifaceRow);
    netGroup.add(netmaskRow);
    netGroup.add(gwRow);
    netGroup.add(dnsRow);

    /* range group */
    const rangeGroup = new Adw.PreferencesGroup({ title: 'Scanning Range' });
    const prefixRow = makeStringRow('IP Prefix (e.g., 192.168.1)', 'prefix', settings);
    const startRow  = makeUintRow('Start Host Number', 'candidate-start', settings);
    const endRow    = makeUintRow('End Host Number',   'candidate-end',   settings);
    rangeGroup.add(prefixRow);
    rangeGroup.add(startRow);
    rangeGroup.add(endRow);

    /* live validation */
    const required = [ifaceRow, netmaskRow, gwRow, dnsRow, prefixRow];
    required.forEach(r => {
        markIfEmpty(r);
        if (r._entry)
            r._entry.connect('changed', () => markIfEmpty(r));
    });

    page.add(netGroup);
    page.add(rangeGroup);
    window.add(page);
    window.default_height = 640;
}

function init() {}
function fillPreferences(app) { fillPreferencesWindow(app); }
