// Copyright (c) 2026, Mania and contributors
// For license information, please see license.txt

frappe.ui.form.on("Transport Settings", {
	refresh(frm) {
		frm.set_intro(
			__("Configure OTP, SMS, and transport billing defaults for Ultra Dispatch.")
		);

		frm.add_custom_button(__("Update Draft Transport Prices"), () => {
			frappe.confirm(
				__(
					"Set the transport charge on every draft transport Sales Order to the amount on its Address Zone? Submitted orders are left unchanged."
				),
				() => {
					frappe.call({
						method: "ultrafreight.ultra_freight.api.zone_pricing.sync_all_draft_transport_order_prices",
						freeze: true,
						freeze_message: __("Updating draft transport orders…"),
					});
				}
			);
		});
	},
});
