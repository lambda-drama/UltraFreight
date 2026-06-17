frappe.ui.form.on("Delivery Note", {
	refresh(frm) {
		toggle_transport_fields(frm);
		add_dispatch_buttons(frm);
	},
	require_direct_delivery(frm) {
		toggle_transport_fields(frm);
	},
});

function toggle_transport_fields(frm) {
	const show = frm.doc.require_direct_delivery;
	const fields = [
		"transport_customer",
		"transport_customer_name",
		"transport_phone",
		"transport_email",
		"transport_address",
		"delivery_status",
		"otp",
		"otp_generated_at",
		"otp_expires_at",
		"confirmation_log",
		"transport_sales_invoice",
	];
	fields.forEach((field) => frm.toggle_display(field, show));
}

function add_dispatch_buttons(frm) {
	if (!frm.doc.require_direct_delivery || frm.doc.docstatus !== 1) {
		return;
	}

	if (frm.doc.delivery_status === "Pending" || !frm.doc.delivery_status) {
		frm.add_custom_button(__("Mark as In Transit"), () => {
			frappe.call({
				method: "ultrafreight.ultra_freight.api.driver_portal.mark_in_transit",
				args: { delivery_note: frm.doc.name },
				freeze: true,
				callback() {
					frm.reload_doc();
				},
			});
		}).addClass("btn-primary");
	}

	if (frm.doc.delivery_status === "In Transit") {
		frm.add_custom_button(__("Mark as Arrived"), () => {
			frappe.call({
				method: "ultrafreight.ultra_freight.api.driver_portal.mark_arrived",
				args: { delivery_note: frm.doc.name },
				freeze: true,
				callback() {
					frm.reload_doc();
				},
			});
		}).addClass("btn-primary");
	}
}
