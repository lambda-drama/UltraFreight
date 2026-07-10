frappe.ui.form.on("Delivery Note", {
	refresh(frm) {
		toggle_transport_fields(frm);
		add_dispatch_buttons(frm);
		render_sms_logs(frm);
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
		"sms_status",
		"transport_sales_order",
		"transport_sales_invoice",
	];
	fields.forEach((field) => frm.toggle_display(field, show));
}

function add_dispatch_buttons(frm) {
	if (!frm.doc.require_direct_delivery || frm.doc.docstatus !== 1) {
		return;
	}

	const status = frm.doc.delivery_status || "Open";
	const status_messages = {
		Open: __(
			"Status: Open — Draft transport sales order created. Submit the transport order to set status to In Transit and generate OTP."
		),
		"In Transit": __(
			"Status: In Transit — Transport order submitted. Share the OTP with the driver for delivery confirmation."
		),
		Completed: __("Status: Completed — Delivery confirmed by the driver."),
	};
	const status_colors = {
		Open: "blue",
		"In Transit": "orange",
		Completed: "green",
	};

	if (status_messages[status]) {
		frm.dashboard.add_comment(status_messages[status], status_colors[status] || "blue", true);
	}
}

function render_sms_logs(frm) {
	if (!frm.doc.require_direct_delivery || !frm.doc.name || frm.doc.__islocal || frm.doc.docstatus !== 1) {
		return;
	}

	frappe.call({
		method: "ultrafreight.ultra_freight.api.transport_portal.get_sms_logs",
		args: { delivery_note: frm.doc.name },
		callback(r) {
			if (r.exc) {
				return;
			}
			const logs = r.message || [];
			if (!logs.length) {
				return;
			}

			const rows = logs
				.map(
					(log) => `
					<tr>
						<td>${frappe.utils.escape_html(log.event || "")}</td>
						<td>${frappe.utils.escape_html(log.party || "")}</td>
						<td>${frappe.utils.escape_html(log.recipient_label || log.recipient || "")}</td>
						<td>${frappe.utils.escape_html(log.recipient || "")}</td>
						<td><span class="indicator ${sms_status_color(log.status)}">${frappe.utils.escape_html(log.status || "")}</span></td>
						<td style="max-width:280px;white-space:normal;">${frappe.utils.escape_html(log.message || "")}</td>
					</tr>`
				)
				.join("");

			const html = `
				<div class="sms-log-panel" style="margin-top:12px;">
					<h6>${__("SMS Notifications")}</h6>
					<table class="table table-bordered table-sm">
						<thead>
							<tr>
								<th>${__("Event")}</th>
								<th>${__("Party")}</th>
								<th>${__("Recipient")}</th>
								<th>${__("Phone")}</th>
								<th>${__("Status")}</th>
								<th>${__("Message")}</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
				</div>`;

			frm.dashboard.add_section(html, __("SMS Log"));
		},
	});
}

function sms_status_color(status) {
	if (status === "Sent") return "green";
	if (status === "Failed") return "red";
	if (status === "Skipped" || status === "Disabled") return "orange";
	return "blue";
}
