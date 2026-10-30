// Update draft transport Sales Order prices from Address Zone amounts.
// Opened from the Sales Order form button and the Sales Order list action.

frappe.provide("frappe.ultrafreight.zone_prices");

const UF_ZP_PREVIEW_METHOD =
	"ultrafreight.ultra_freight.api.zone_pricing.get_draft_transport_order_preview";
const UF_ZP_APPLY_METHOD = "ultrafreight.ultra_freight.api.zone_pricing.update_transport_order_prices";

class ZonePriceDialog {
	constructor(opts) {
		this.opts = opts || {};
		this.rows = [];
		this.zones = [];
		this.zone_map = {};
		this.state = {};
		this.search = "";
		this.preselected = new Set(this.opts.selected || []);

		this.make();
		this.load();
	}

	make() {
		this.dialog = new frappe.ui.Dialog({
			title: __("Update Transport Order Prices from Zones"),
			size: "extra-large",
			fields: [
				{ fieldtype: "HTML", fieldname: "intro" },
				{
					fieldtype: "Data",
					fieldname: "search",
					label: __("Filter"),
					placeholder: __("Order, customer, transport customer or zone"),
				},
				{ fieldtype: "HTML", fieldname: "orders_html" },
			],
			primary_action_label: __("Update Prices"),
			primary_action: () => this.apply(),
			secondary_action_label: __("Close"),
			secondary_action: () => this.dialog.hide(),
		});

		this.dialog.fields_dict.search.$input.on("input", (e) => {
			this.search = (e.target.value || "").trim().toLowerCase();
			this.render();
		});

		this.dialog.fields_dict.orders_html.$wrapper.html(
			`<p class="text-muted">${__("Loading draft transport orders…")}</p>`
		);

		this.dialog.show();
	}

	load() {
		frappe.call({
			method: UF_ZP_PREVIEW_METHOD,
			args: { limit: 500 },
			callback: (r) => {
				const data = r.message || {};
				this.rows = data.orders || [];
				this.zones = data.zones || [];
				this.transport_item = data.transport_item;
				this.zone_field = data.zone_field;

				this.zone_map = {};
				this.zones.forEach((zone) => {
					this.zone_map[zone.name] = zone;
				});

				this.state = {};
				this.rows.forEach((row) => {
					this.state[row.name] = {
						checked: this.preselected.has(row.name) && Boolean(row.can_update),
						zone: row.zone || "",
					};
				});

				this.render_intro();
				this.render();
			},
		});
	}

	render_intro() {
		const $intro = this.dialog.fields_dict.intro.$wrapper;
		const transport_item = this.transport_item
			? `<b>${frappe.utils.escape_html(this.transport_item)}</b>`
			: __("the transport charge item");
		const escape = frappe.utils.escape_html;
		const default_currency = frappe.boot.sysdefaults.currency;

		const bulk_options = [
			`<option value="">${__("— Zone for all rows —")}</option>`,
			...this.zones.map((zone) => {
				const amount = flt(zone.transport_charges);
				const label = amount
					? `${zone.name} (${format_currency(amount, default_currency)})`
					: `${zone.name} (${__("no amount")})`;
				return `<option value="${escape(zone.name)}">${escape(label)}</option>`;
			}),
		].join("");

		$intro.html(`<div class="text-muted small" style="margin-bottom:8px">
			<p>${__(
				"Prices come from Address Zone → Transport Charges and are applied to {0} on draft transport orders. Only draft orders are changed and the chosen zone is saved on the order. Saving an Address Zone with a new amount re-prices the draft orders that follow that zone.",
				[transport_item]
			)}</p>
			<p>
				<button class="btn btn-xs btn-default uf-zp-select-all">${__("Select all")}</button>
				<button class="btn btn-xs btn-default uf-zp-clear">${__("Clear selection")}</button>
				<span class="uf-zp-summary" style="margin-left:8px"></span>
			</p>
			<p style="display:flex;gap:6px;align-items:center">
				<select class="form-control input-xs uf-zp-bulk-zone" style="max-width:240px">
					${bulk_options}
				</select>
				<button class="btn btn-xs btn-default uf-zp-bulk-apply">
					${__("Use this zone for all visible orders")}
				</button>
			</p>
		</div>`);

		$intro.find(".uf-zp-select-all").on("click", () => this.toggle_all(true));
		$intro.find(".uf-zp-clear").on("click", () => this.toggle_all(false));
		$intro.find(".uf-zp-bulk-apply").on("click", () => {
			const zone = $intro.find(".uf-zp-bulk-zone").val();
			if (!zone) {
				frappe.msgprint(__("Pick a zone first."));
				return;
			}
			this.apply_zone_to_visible(zone);
		});
	}

	apply_zone_to_visible(zone) {
		const zone_row = this.zone_map[zone];
		const has_amount = zone_row ? flt(zone_row.transport_charges) : 0;
		if (!has_amount) {
			frappe.msgprint(__("Zone {0} has no transport amount.", [zone]));
			return;
		}

		let count = 0;
		this.visible_rows().forEach((row) => {
			if (!row.can_update) return;
			this.state[row.name].zone = zone;
			this.state[row.name].checked = true;
			count += 1;
		});

		if (count) {
			this.render();
		} else {
			frappe.msgprint(__("No updatable orders in the current view."));
		}
	}

	toggle_all(checked) {
		this.visible_rows().forEach((row) => {
			const values = this.row_values(row);
			if (!values.selectable) return;
			this.state[row.name].checked = checked;
		});
		this.render();
	}

	search_text(row) {
		return [
			row.name,
			row.customer,
			row.customer_name,
			row.transport_customer,
			this.state[row.name] ? this.state[row.name].zone : "",
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
	}

	visible_rows() {
		if (!this.search) return this.rows;
		return this.rows.filter((row) => this.search_text(row).includes(this.search));
	}

	row_values(row) {
		const state = this.state[row.name] || {};
		const zone = this.zone_map[state.zone];
		const zone_amount = zone ? flt(zone.transport_charges) : 0;
		const new_amount = zone_amount ? flt(row.qty) * zone_amount : null;

		return {
			zone: state.zone || "",
			zone_amount: zone_amount,
			new_rate: zone_amount || null,
			new_amount: new_amount,
			changed: new_amount !== null && flt(row.current_amount) !== flt(new_amount),
			selectable: Boolean(row.can_update && zone_amount),
		};
	}

	render() {
		const $wrapper = this.dialog.fields_dict.orders_html.$wrapper;

		if (!this.rows.length) {
			$wrapper.html(`<p class="text-muted">${__("No draft transport orders found.")}</p>`);
			this.update_summary();
			return;
		}

		const rows = this.visible_rows();
		if (!rows.length) {
			$wrapper.html(`<p class="text-muted">${__("No orders match the filter.")}</p>`);
			this.update_summary();
			return;
		}

		const all_selected = rows.every((row) => {
			const values = this.row_values(row);
			return !values.selectable || this.state[row.name].checked;
		});

		const html = [
			`<style>
				.uf-zp-changed td { background-color: var(--bg-yellow, #fff8e6); }
			</style>`,
			`<div class="table-responsive" style="max-height:55vh;overflow:auto">
				<table class="table table-bordered table-sm" style="margin-bottom:0">
					<thead><tr>
						<th style="width:32px">
							<input type="checkbox" class="uf-zp-all" ${all_selected ? "checked" : ""}>
						</th>
						<th>${__("Transport Order")}</th>
						<th>${__("Customer")}</th>
						<th style="min-width:220px">${__("Zone")}</th>
						<th class="text-right">${__("Qty")}</th>
						<th class="text-right">${__("Current Rate")}</th>
						<th class="text-right">${__("Current Total")}</th>
						<th class="text-right">${__("Zone Amount")}</th>
						<th class="text-right">${__("New Total")}</th>
					</tr></thead>
					<tbody>`,
		];

		rows.forEach((row) => {
			const values = this.row_values(row);
			const state = this.state[row.name];
			const escape = frappe.utils.escape_html;

			const zone_options = [
				`<option value="">${__("— Select zone —")}</option>`,
				...this.zones.map((zone) => {
					const amount = flt(zone.transport_charges);
					const label = amount
						? `${zone.name} (${format_currency(amount, row.currency)})`
						: `${zone.name} (${__("no amount")})`;
					return `<option value="${escape(zone.name)}" ${
						zone.name === values.zone ? "selected" : ""
					}>${escape(label)}</option>`;
				}),
			].join("");

			html.push(`<tr class="${values.changed ? "uf-zp-changed" : ""}">
				<td>
					<input type="checkbox" class="uf-zp-row" data-order="${escape(row.name)}"
						${
							state.checked && values.selectable ? "checked" : ""
						} ${values.selectable ? "" : "disabled"}>
				</td>
				<td>
					<a href="/app/sales-order/${encodeURIComponent(row.name)}" target="_blank">
						${escape(row.name)}
					</a>
					<div class="text-muted small">${escape(
						frappe.datetime.str_to_user(row.transaction_date || "")
					)}</div>
				</td>
				<td>
					${escape(row.customer_name || row.customer)}
					<div class="text-muted small">${escape(row.customer)}</div>
				</td>
				<td>
					<select class="form-control input-xs uf-zp-zone" data-order="${escape(row.name)}">
						${zone_options}
					</select>
					${row.zone_source ? `<div class="text-muted small">${escape(row.zone_source)}</div>` : ""}
					${row.reason ? `<div class="text-danger small">${escape(row.reason)}</div>` : ""}
				</td>
				<td class="text-right">${format_number(row.qty)}</td>
				<td class="text-right">${
					row.current_rate === null || row.current_rate === undefined
						? __("Mixed")
						: format_currency(row.current_rate, row.currency)
				}</td>
				<td class="text-right">${format_currency(row.current_amount, row.currency)}</td>
				<td class="text-right">${
					values.new_rate ? format_currency(values.new_rate, row.currency) : "—"
				}</td>
				<td class="text-right">${
					values.new_amount === null
						? "—"
						: `<b>${format_currency(values.new_amount, row.currency)}</b>`
				}</td>
			</tr>`);
		});

		html.push("</tbody></table></div>");
		$wrapper.html(html.join(""));
		this.bind_table($wrapper);
		this.update_summary();
	}

	bind_table($wrapper) {
		$wrapper.find(".uf-zp-all").on("change", (e) => this.toggle_all(e.target.checked));

		$wrapper.find(".uf-zp-row").on("change", (e) => {
			const name = e.target.dataset.order;
			if (!this.state[name]) return;
			this.state[name].checked = e.target.checked;
			this.update_summary();
		});

		$wrapper.find(".uf-zp-zone").on("change", (e) => {
			const name = e.target.dataset.order;
			const state = this.state[name];
			if (!state) return;

			state.zone = e.target.value;
			const values = this.row_values(
				this.rows.find((row) => row.name === name) || {}
			);
			// Picking a zone is an explicit intent to price that order from it.
			state.checked = Boolean(values.selectable);
			this.render();
		});
	}

	checked_rows() {
		return this.rows.filter((row) => {
			const state = this.state[row.name];
			return state && state.checked && this.row_values(row).selectable;
		});
	}

	update_summary() {
		const $summary = this.dialog.fields_dict.intro.$wrapper.find(".uf-zp-summary");
		const rows = this.checked_rows();

		if (!rows.length) {
			$summary.html(__("No orders selected"));
			this.dialog.set_primary_action(__("Update Prices"), () => this.apply());
			return;
		}

		const totals = {};
		rows.forEach((row) => {
			const values = this.row_values(row);
			const currency = row.currency || frappe.boot.sysdefaults.currency;
			totals[currency] = flt(totals[currency]) + flt(values.new_amount);
		});

		const total_text = Object.keys(totals)
			.map((currency) => format_currency(totals[currency], currency))
			.join(", ");

		$summary.html(
			__("{0} order(s) selected — new transport total {1}", [rows.length, total_text])
		);
		this.dialog.set_primary_action(__("Update {0} Order(s)", [rows.length]), () =>
			this.apply()
		);
	}

	apply() {
		const names = [];
		const zones = {};

		this.checked_rows().forEach((row) => {
			const values = this.row_values(row);
			names.push(row.name);
			zones[row.name] = values.zone;
		});

		if (!names.length) {
			frappe.msgprint(__("Select at least one transport order with a zone amount."));
			return;
		}

		frappe.call({
			method: UF_ZP_APPLY_METHOD,
			args: {
				names: JSON.stringify(names),
				zones: JSON.stringify(zones),
			},
			freeze: true,
			freeze_message: __("Updating transport order prices…"),
			callback: (r) => {
				this.dialog.hide();
				this.show_result(r.message || {});
			},
		});
	}

	show_result(data) {
		const updated = data.updated || [];
		const unchanged = data.unchanged || [];
		const skipped = data.skipped || [];
		const escape = frappe.utils.escape_html;
		const link = (name) =>
			`<a href="/app/sales-order/${encodeURIComponent(name)}" target="_blank">${escape(name)}</a>`;

		let message = `<p>${__("{0} transport order(s) updated.", [updated.length])}</p>`;

		if (updated.length) {
			message += `<ul>${updated
				.map(
					(row) =>
						`<li>${link(row.name)} — ${format_currency(
							row.old_total,
							row.currency
						)} → <b>${format_currency(row.new_total, row.currency)}</b> (${__(
							"Zone"
						)}: ${escape(row.zone)})</li>`
				)
				.join("")}</ul>`;
		}

		if (unchanged.length) {
			message += `<p class="text-muted">${__("Already up to date")}</p><ul>${unchanged
				.map((row) => `<li>${link(row.name)} — ${escape(row.reason || "")}</li>`)
				.join("")}</ul>`;
		}

		if (skipped.length) {
			message += `<p class="text-muted">${__("Skipped")}</p><ul>${skipped
				.map((row) => `<li>${link(row.name)} — ${escape(row.reason || "")}</li>`)
				.join("")}</ul>`;
		}

		frappe.msgprint({
			title: __("Zone Prices Updated"),
			indicator: updated.length ? "green" : "orange",
			message: message,
		});

		if (
			window.cur_frm &&
			cur_frm.doc &&
			updated.some((row) => row.name === cur_frm.doc.name)
		) {
			cur_frm.reload_doc();
		}
		if (window.cur_list && cur_list.doctype === "Sales Order" && updated.length) {
			cur_list.refresh();
		}
		if (this.opts.on_update) {
			this.opts.on_update(data);
		}
	}
}

frappe.ultrafreight.zone_prices = {
	open(opts) {
		return new ZonePriceDialog(opts || {});
	},
};

