frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		toggle_transport_fields(frm);
	},
	require_direct_delivery(frm) {
		toggle_transport_fields(frm);
	},
	transport_customer(frm) {
		if (frm.doc.transport_customer) {
			frappe.db.get_doc("Transport Customer", frm.doc.transport_customer).then((tc) => {
				frm.set_value("transport_customer_name", tc.customer_name);
				frm.set_value("transport_phone", tc.phone_number);
				frm.set_value("transport_email", tc.email);
				frm.set_value("transport_address", tc.delivery_address);
			});
		}
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
		"driver",
		"expected_delivery_date",
		"transport_charge",
		"custom_is_transport_order",
		"custom_delivery_note_to_be_transported",
	];
	fields.forEach((field) => frm.toggle_display(field, show || frm.doc.custom_is_transport_order));
	frm.toggle_reqd("transport_customer_name", show);
	frm.toggle_reqd("transport_phone", show);
	// frm.toggle_reqd("driver", show);

	if (frm.doc.custom_is_transport_order) {
		frm.set_df_property("require_direct_delivery", "read_only", 1);
	}
}
