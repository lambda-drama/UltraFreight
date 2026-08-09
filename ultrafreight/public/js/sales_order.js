frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		toggle_transport_fields(frm);
		add_regenerate_otp_button(frm);
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
		"custom_address_zone",
	];
	fields.forEach((field) => frm.toggle_display(field, show || frm.doc.custom_is_transport_order));
	frm.toggle_reqd("transport_customer_name", show);
	frm.toggle_reqd("transport_phone", show);
	// frm.toggle_reqd("driver", show);

	if (frm.doc.custom_is_transport_order) {
		frm.set_df_property("require_direct_delivery", "read_only", 1);
		frm.toggle_reqd("custom_address_zone", 0);
	}
}

function add_regenerate_otp_button(frm) {
	frm.remove_custom_button(__("Regenerate OTP"));
	if (!frm.doc.custom_is_transport_order || frm.doc.docstatus !== 1) {
		return;
	}
	const dn = frm.doc.custom_delivery_note_to_be_transported;
	if (!dn) {
		return;
	}

	frappe.db
		.get_value("Delivery Note", dn, ["delivery_status", "otp", "otp_expires_at", "driver"])
		.then(({ message }) => {
			if (!message) {
				return;
			}
			const status = message.delivery_status || "Open";
			if (["Pending Invoicing", "Completed"].includes(status)) {
				return;
			}
			if (!message.driver) {
				return;
			}

			frm.add_custom_button(__("Regenerate OTP"), () => {
				frappe.confirm(
					__("Generate a new OTP for Delivery Note {0}? Recipients will be notified again.", [
						dn,
					]),
					() => {
						frappe.call({
							method:
								"ultrafreight.ultra_freight.api.transport_portal.regenerate_transport_otp",
							args: { name: frm.doc.name },
							freeze: true,
							freeze_message: __("Regenerating OTP…"),
							callback(r) {
								const result = r.message || {};
								frappe.msgprint({
									title: __("OTP Regenerated"),
									indicator: "green",
									message: __(
										"<b>Delivery Note:</b> {0}<br><b>OTP:</b> {1}<br><b>Expires:</b> {2}",
										[
											result.delivery_note || dn,
											result.otp || "",
											result.otp_expires_at
												? frappe.datetime.str_to_user(result.otp_expires_at)
												: "",
										]
									),
								});
								frm.reload_doc();
							},
						});
					}
				);
			}).addClass("btn-primary");
		});
}
