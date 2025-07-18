// GNOME Shell extension preferences UI
// ------------------------------------------------------------

'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const { Gio, Gtk } = imports.gi;

// Import Adwaita (GNOME 42+ required)
const Adw = imports.gi.Adw;

// List available network interfaces (excluding loopback)
function _listIfaces() {
    try {
        const dir = Gio.File.new_for_path('/sys/class/net');
        const enumerator = dir.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        const interfaces = [];
        let info;

        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (name !== 'lo') {
                interfaces.push(name);
            }
        }

        enumerator.close(null);
        return interfaces;
    } catch (e) {
        logError(e, 'ip-scanner: failed to enumerate /sys/class/net');
        return [];
    }
}

// Load and return GSettings for the extension
function _getSettings() {
    return ExtensionUtils.getSettings('org.gnome.shell.extensions.ip-scanner');
}

/* ---------------- UI Helper Functions ---------------- */

// Check if a specific Adwaita class is available
function have(className) {
    return Adw && Adw[className] !== undefined;
}

// Create a string input row for the preferences window
function makeStringRow(label, key, settings) {
    // Use EntryRow if available
    if (have('EntryRow')) {
        const row = new Adw.EntryRow({ title: label });
        row.text = settings.get_string(key) || '';
        row.connect('notify::text', widget => {
            settings.set_string(key, widget.text || '');
        });
        return row;
    } else {
        // Fallback: ActionRow with embedded Entry
        const row = new Adw.ActionRow({ title: label });
        const entry = new Gtk.Entry({
            text: settings.get_string(key) || ''
        });

        entry.set_size_request(200, -1);
        entry.valign = Gtk.Align.CENTER;
        entry.margin_top = 2;
        entry.margin_bottom = 2;

        row.add_suffix(entry);
        row.activatable_widget = entry;

        entry.connect('changed', widget => {
            settings.set_string(key, widget.text || '');
        });

        return row;
    }
}


// Constants for compact field styling
const COMPACT_FIELD_HEIGHT = 28;  // Approximate GNOME preferences small field height
const COMPACT_FIELD_VPAD = 2;     // Vertical padding within rows

// Create a numeric input row for the preferences window
function makeUintRow(label, key, settings, upper = 255) {
    // Always use ActionRow + Gtk.SpinButton for consistency
    const row = new Adw.ActionRow({ title: label });

    const adjustment = new Gtk.Adjustment({
        lower: 0,
        upper,
        step_increment: 1,
        page_increment: 10,
    });

    const spinButton = new Gtk.SpinButton({
        adjustment: adjustment,
        digits: 0,
        climb_rate: 1,
        hexpand: false,
    });

    // Compact styling adjustments
    spinButton.set_size_request(200, -1);
    spinButton.valign = Gtk.Align.CENTER;
    spinButton.margin_top = COMPACT_FIELD_VPAD;
    spinButton.margin_bottom = COMPACT_FIELD_VPAD;
    spinButton.width_chars = 4; // Limit visible character width

    // Add compact CSS class if supported (harmless if not)
    if (spinButton.add_css_class) {
        spinButton.add_css_class('compact');
    }

    // Initialize value and connect to settings
    spinButton.set_value(settings.get_uint(key));
    spinButton.connect('value-changed', widget => {
        settings.set_uint(key, widget.get_value_as_int());
    });

    row.add_suffix(spinButton);
    row.activatable_widget = spinButton;

    return row;
}

// Create a network interface selection row
function makeIfaceRow(settings) {
    // Get available network interfaces
    const rawInterfaces = _listIfaces();
    let interfaces = Array.isArray(rawInterfaces)
        ? rawInterfaces.filter(s => typeof s === 'string' && s.length)
        : [];

    if (interfaces.length === 0) {
        interfaces = ['(none)'];
    }

    if (have('ComboRow')) {
        // Modern ComboRow (better appearance)
        const stringList = new Gtk.StringList();
        for (const interfaceName of interfaces) {
            stringList.append(interfaceName);
        }

        const row = new Adw.ComboRow({
            title: 'Network Interface',
            model: stringList,
            expression: new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'),
        });

        // Set initial selection
        const currentInterface = settings.get_string('iface') || '';
        const index = interfaces.indexOf(currentInterface);
        row.selected = index >= 0 ? index : 0;

        // Connect to settings
        row.connect('notify::selected', () => {
            const selectedItem = row.get_selected_item();
            if (selectedItem) {
                settings.set_string('iface', selectedItem.get_string());
            }
        });

        return row;
    } else {
        // GNOME 42 fallback: ActionRow + Gtk.DropDown
        const row = new Adw.ActionRow({ title: 'Network Interface' });
        const stringList = new Gtk.StringList();

        for (const interfaceName of interfaces) {
            stringList.append(interfaceName);
        }

        const dropdown = new Gtk.DropDown({
            model: stringList,
            hexpand: false
        });
        dropdown.set_size_request(200, -1);

        // Set initial selection
        const currentInterface = settings.get_string('iface') || '';
        const index = interfaces.indexOf(currentInterface);
        dropdown.set_selected(index >= 0 ? index : 0);

        // Connect to settings
        dropdown.connect('notify::selected-item', widget => {
            const selectedItem = widget.get_selected_item();
            if (selectedItem) {
                settings.set_string('iface', selectedItem.get_string());
            }
        });

        row.add_suffix(dropdown);
        row.activatable_widget = dropdown;
        return row;
    }
}

/* ---------------- Main Preferences Window ---------------- */

// Fill the preferences window with configuration options
function fillPreferencesWindow(window) {
    if (!(Adw && window instanceof Adw.PreferencesWindow)) {
        return;
    }

    const settings = _getSettings();

    const page = new Adw.PreferencesPage({
        margin_top: 16,
        margin_bottom: 16,
        margin_start: 16,
        margin_end: 16,
    });

    // Basic network settings group
    const basicGroup = new Adw.PreferencesGroup({ title: 'Network Settings' });
    basicGroup.add(makeIfaceRow(settings));
    basicGroup.add(makeStringRow('Netmask', 'netmask', settings));
    basicGroup.add(makeStringRow('Gateway', 'gateway', settings));
    basicGroup.add(makeStringRow('DNS', 'dns', settings));

    // IP address scanning range group
    const addressGroup = new Adw.PreferencesGroup({ title: 'Scanning Range' });
    addressGroup.add(makeStringRow('IP Prefix (e.g., 192.168.1)', 'prefix', settings));
    addressGroup.add(makeUintRow('Start Host Number', 'candidate-start', settings));
    addressGroup.add(makeUintRow('End Host Number', 'candidate-end', settings));

    page.add(basicGroup);
    page.add(addressGroup);
    window.add(page);

    window.default_height = 640;
}

function init() {}