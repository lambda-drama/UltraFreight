// Copyright (c) 2026, Mania and contributors
// For license information, please see license.txt

frappe.ui.form.on("Transport Settings", {
	refresh(frm) {
		frm.set_intro(
			__("Configure OTP, SMS, and transport billing defaults for Ultra Dispatch.")
		);

		const actions = __("Actions");

		frm.add_custom_button(
			__("Update Draft Transport Prices"),
			() => {
				frappe.confirm(
					__(
						"Set each draft transport Sales Order to its Address Zone rate (per 1 UOM) and quantity from the linked Delivery Note / goods Sales Order? Totals become rate × qty. Submitted orders are left unchanged."
					),
					() => {
						frappe.call({
							method:
								"ultrafreight.ultra_freight.api.zone_pricing.sync_all_draft_transport_order_prices",
							freeze: true,
							freeze_message: __("Updating draft transport orders…"),
						});
					}
				);
			},
			actions
		);

		frm.add_custom_button(
			__("Update Draft Tax Category"),
			() => {
				const dialog = new frappe.ui.Dialog({
					title: __("Update Draft Transport Tax Category"),
					fields: [
						{
							fieldtype: "HTML",
							options: `<p class="text-muted">${__(
								"Set the Tax Category on every draft transport Sales Order. Submitted orders are left unchanged. Matching sales tax templates for that category are re-applied when found."
							)}</p>`,
						},
						{
							label: __("Tax Category"),
							fieldname: "tax_category",
							fieldtype: "Link",
							options: "Tax Category",
							reqd: 1,
						},
					],
					primary_action_label: __("Update"),
					primary_action(values) {
						dialog.hide();
						frappe.call({
							method:
								"ultrafreight.ultra_freight.api.zone_pricing.sync_all_draft_transport_order_tax_categories",
							args: { tax_category: values.tax_category },
							freeze: true,
							freeze_message: __("Updating draft tax categories…"),
						});
					},
				});
				dialog.show();
			},
			actions
		);

		frm.add_custom_button(
			__("Update Draft Branch"),
			() => {
				const dialog = new frappe.ui.Dialog({
					title: __("Update Draft Transport Branch"),
					fields: [
						{
							fieldtype: "HTML",
							options: `<p class="text-muted">${__(
								"Set Branch (and optional Cost Center) on every draft transport Sales Order. Defaults come from Transport Settings. Submitted orders are left unchanged."
							)}</p>`,
						},
						{
							label: __("Branch"),
							fieldname: "branch",
							fieldtype: "Link",
							options: "Branch",
							reqd: 1,
							default: frm.doc.branch || undefined,
						},
						{
							label: __("Cost Center"),
							fieldname: "cost_center",
							fieldtype: "Link",
							options: "Cost Center",
							default: frm.doc.cost_center || undefined,
						},
					],
					primary_action_label: __("Update"),
					primary_action(values) {
						dialog.hide();
						frappe.call({
							method:
								"ultrafreight.ultra_freight.api.zone_pricing.sync_all_draft_transport_order_branches",
							args: {
								branch: values.branch,
								cost_center: values.cost_center || undefined,
							},
							freeze: true,
							freeze_message: __("Updating draft branches…"),
						});
					},
				});
				dialog.show();
			},
			actions
		);
	},
});
