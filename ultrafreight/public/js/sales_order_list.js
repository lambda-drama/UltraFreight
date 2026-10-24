// Sales Order list view: update draft transport order prices from Address Zones.
// Appended after ERPNext's own sales_order_list.js, so we wrap its onload.

(function () {
	const settings = (frappe.listview_settings["Sales Order"] =
		frappe.listview_settings["Sales Order"] || {});
	const original_onload = settings.onload;

	settings.onload = function (listview) {
		if (original_onload) {
			original_onload.call(this, listview);
		}

		listview.page.add_action_item(__("Update Zone Prices"), () => {
			if (!(frappe.ultrafreight && frappe.ultrafreight.zone_prices)) {
				frappe.msgprint(__("Zone price tool is not loaded. Please refresh the page."));
				return;
			}
			const selected = (listview.get_checked_items() || [])
				.map((row) => row.name)
				.filter(Boolean);
			frappe.ultrafreight.zone_prices.open({ selected });
		});
	};
})();
