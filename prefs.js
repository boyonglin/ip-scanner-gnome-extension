// prefs.js - GNOME 42+ (libadwaita) Preferences UI (clean, English labels)
const ExtensionUtils = imports.misc.extensionUtils;
const { Gio, Gtk } = imports.gi;
let Adw = null;
try { Adw = imports.gi.Adw; } catch (_) { }

let settings;

// List network interfaces, excluding 'lo'
function _listIfaces() {
    try {
        const dir = Gio.File.new_for_path('/sys/class/net');
        const en = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        const list = [];
        let info;
        while ((info = en.next_file(null)) !== null)
            if (info.get_name() !== 'lo') list.push(info.get_name());
        en.close(null);
        return list;
    } catch { return []; }
}

// Load GSettings schema
function _getSettings() {
    if (settings) return settings;
    try {
        return ExtensionUtils.getSettings('org.gnome.shell.extensions.ip-scanner');
    } catch (_) {
        const Me = ExtensionUtils.getCurrentExtension();
        const schemaDir = Me.dir.get_child('schemas').get_path();
        const src = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir, Gio.SettingsSchemaSource.get_default(), false);
        const obj = src.lookup('org.gnome.shell.extensions.ip-scanner', true);
        return new Gio.Settings({ settings_schema: obj });
    }
}

function fillPreferencesWindow(window) {
    if (!(Adw && window instanceof Adw.PreferencesWindow))
        return;


    settings = _getSettings();

    const page = new Adw.PreferencesPage();
    page.margin_top = page.margin_bottom = page.margin_start = page.margin_end = 16;

    const basic = new Adw.PreferencesGroup({ title: 'IP Scanner Settings' });

    function stringRow(key, label) {
        const row = new Adw.ActionRow({ title: label });
        const entry = new Gtk.Entry({ text: settings.get_string(key), hexpand: false });
        entry.set_size_request(200, -1);
        entry.connect('changed', w => settings.set_string(key, w.get_text() || ''));
        row.add_suffix(entry);
        row.activatable_widget = entry;
        return row;
    }

    function uintRow(key, label) {
        const row = new Adw.ActionRow({ title: label });
        const adj = new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 1, page_increment: 10 });
        const spin = new Gtk.SpinButton({ adjustment: adj, digits: 0, climb_rate: 1, hexpand: false });
        spin.set_size_request(200, -1);
        spin.set_value(settings.get_uint(key));
        spin.connect('value-changed', w => settings.set_uint(key, w.get_value_as_int()));
        row.add_suffix(spin);
        row.activatable_widget = spin;
        return row;
    }

    function ifaceRow() {
        const row = new Adw.ActionRow({ title: 'Network Interface' });
        const ifaces = _listIfaces();
        const list = Gtk.StringList.new(ifaces);

        const dropdown = new Gtk.DropDown({ model: list, hexpand: false });
        dropdown.set_size_request(200, -1);

        let idx = ifaces.indexOf(settings.get_string('iface'));
        dropdown.set_selected(idx < 0 ? 0 : idx);

        dropdown.connect('notify::selected-item', w => {
            const strObj = w.get_selected_item();
            settings.set_string('iface', strObj.get_string());
        });

        row.add_suffix(dropdown);
        row.activatable_widget = dropdown;
        return row;
    }

    basic.add(ifaceRow());
    basic.add(stringRow('netmask',  'Netmask'));
    basic.add(stringRow('gateway',  'Gateway'));
    basic.add(stringRow('dns-test', 'DNS'));

    const addr = new Adw.PreferencesGroup({ title: 'Address' });

    function prefixRow() {
        const row   = new Adw.ActionRow({ title: 'Prefix (1.2.3.)' });
        const entry = new Gtk.Entry({ text: settings.get_string('prefix') || '', hexpand: false });
        entry.set_size_request(200, -1);
        entry.connect('changed', w => settings.set_string('prefix', w.get_text() || ''));
        row.add_suffix(entry);
        row.activatable_widget = entry;
        return row;
    }

    addr.add(prefixRow());
    addr.add(uintRow('candidate-start', 'Start Host (4)'));
    addr.add(uintRow('candidate-end',   'End Host (4)'));

    page.add(basic);
    page.add(addr);
    window.add(page);

    window.default_height = 640;
}

function init() {}

var init = init;
var fillPreferencesWindow = fillPreferencesWindow;
