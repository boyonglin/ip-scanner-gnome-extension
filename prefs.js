const { Gio, Gtk } = imports.gi;

let settings;

function init() {
    // nothing
}

function buildPrefsWidget() {
    settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.ip-scanner' });
    Gtk.init(null);

    // 主容器
    let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8, border_width: 12 });

    // Helper：建立 Label + Entry
    function makeEntry(key, labelText) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        let label = new Gtk.Label({ label: labelText, xalign: 0 });
        let entry = new Gtk.Entry({ text: settings.get_string(key), hexpand: true });

        entry.connect('changed', widget => {
            settings.set_string(key, widget.get_text());
        });

        hbox.append(label);
        hbox.append(entry);
        return hbox;
    }

    box.append(makeEntry('iface',     '網卡介面 (iface):'));
    box.append(makeEntry('netmask',   'Netmask (/24 等):'));
    box.append(makeEntry('gateway',   'Gateway IP:'));
    box.append(makeEntry('dns-test',  'DNS 測試 IP:'));

    // candidates（陣列）用多行文字框
    let candLabel = new Gtk.Label({ label: '掃描範圍 IP（以逗號分隔）:', xalign: 0 });
    let candEntry = new Gtk.TextView({ wrap_mode: Gtk.WrapMode.WORD, hexpand: true, vexpand: true });
    candEntry.get_buffer().set_text(settings.get_strv('candidates').join(','));
    candEntry.get_buffer().connect('changed', buf => {
        let text = buf.get_text(buf.get_start_iter(), buf.get_end_iter(), false);
        let arr = text.split(',').map(s => s.trim()).filter(s => s);
        settings.set_strv('candidates', arr);
    });
    box.append(candLabel);
    box.append(candEntry);

    return box;
}
