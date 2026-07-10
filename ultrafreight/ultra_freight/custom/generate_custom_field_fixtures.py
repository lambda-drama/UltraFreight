"""Build fixtures/custom_field.json from ultra_freight/custom/custom_fields.py"""

import json
from pathlib import Path

from ultrafreight.ultra_freight.custom.custom_fields import get_custom_fields

MODULE = "Ultra Freight"
FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "custom_field.json"


def _record(dt: str, field: dict) -> dict:
	fieldname = field["fieldname"]
	return {
		"allow_in_quick_entry": 0,
		"allow_on_submit": 0,
		"bold": 0,
		"collapsible": field.get("collapsible", 0),
		"collapsible_depends_on": None,
		"columns": 0,
		"default": field.get("default"),
		"depends_on": field.get("depends_on"),
		"description": field.get("description"),
		"docstatus": 0,
		"doctype": "Custom Field",
		"dt": dt,
		"fetch_from": None,
		"fetch_if_empty": 0,
		"fieldname": fieldname,
		"fieldtype": field["fieldtype"],
		"hidden": 0,
		"hide_border": 0,
		"hide_days": 0,
		"hide_seconds": 0,
		"ignore_user_permissions": 0,
		"ignore_xss_filter": 0,
		"in_global_search": 0,
		"in_list_view": field.get("in_list_view", 0),
		"in_preview": 0,
		"in_standard_filter": field.get("in_standard_filter", 0),
		"insert_after": field.get("insert_after"),
		"is_system_generated": 0,
		"is_virtual": 0,
		"label": field.get("label", ""),
		"length": 0,
		"link_filters": None,
		"mandatory_depends_on": None,
		"module": MODULE,
		"name": f"{dt}-{fieldname}",
		"no_copy": 0,
		"non_negative": 0,
		"options": field.get("options"),
		"permlevel": 0,
		"placeholder": None,
		"precision": "",
		"print_hide": 0,
		"print_hide_if_no_value": 0,
		"print_width": None,
		"read_only": field.get("read_only", 0),
		"read_only_depends_on": None,
		"report_hide": 0,
		"reqd": field.get("reqd", 0),
		"search_index": 0,
		"show_dashboard": 0,
		"sort_options": 0,
		"translatable": 0,
		"unique": field.get("unique", 0),
		"width": None,
	}


def main():
	records = []
	for dt, fields in get_custom_fields().items():
		for field in fields:
			records.append(_record(dt, field))
	FIXTURE_PATH.write_text(json.dumps(records, indent=1) + "\n")
	print(f"Wrote {len(records)} fields to {FIXTURE_PATH}")


if __name__ == "__main__":
	main()
