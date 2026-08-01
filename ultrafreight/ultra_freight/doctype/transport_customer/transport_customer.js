// Copyright (c) 2026, Mania and contributors
// For license information, please see license.txt

frappe.ui.form.on("Transport Customer", {
	// refresh(frm) {}
});

frappe.ui.form.on("Address Zone Detail", {
	default(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.default) {
			return;
		}
		(frm.doc.zones || []).forEach((zoneRow) => {
			if (zoneRow.name !== cdn && zoneRow.default) {
				frappe.model.set_value(zoneRow.doctype, zoneRow.name, "default", 0);
			}
		});
	},
	zone(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.zone) {
			return;
		}
		frappe.db.get_value("Address Zone", row.zone, ["zone_city", "transport_charges"]).then(({ message }) => {
			if (!message) {
				return;
			}
			if (message.zone_city) {
				frappe.model.set_value(cdt, cdn, "city", message.zone_city);
			}
			if (message.transport_charges != null) {
				frappe.model.set_value(cdt, cdn, "transport_charges", message.transport_charges);
			}
		});
	},
});
