// Copyright (c) 2026, Mania and contributors
// For license information, please see license.txt

frappe.ui.form.on("Transport Settings", {
	refresh(frm) {
		frm.set_intro(__("Configure OTP, SMS, and transport billing defaults for Ultra Dispatch."));
	},
});
