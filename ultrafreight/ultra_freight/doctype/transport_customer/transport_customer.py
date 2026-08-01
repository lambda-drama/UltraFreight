# Copyright (c) 2026, Mania and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class TransportCustomer(Document):
	def validate(self):
		self._validate_single_default_zone()

	def _validate_single_default_zone(self):
		defaults = [row for row in (self.get("zones") or []) if row.get("default")]
		if len(defaults) > 1:
			frappe.throw(_("Only one zone can be marked as Default"))
