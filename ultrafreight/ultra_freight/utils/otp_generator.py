import random

import frappe


def generate_otp(length: int = 6) -> str:
	return "".join(str(random.randint(0, 9)) for _ in range(length))


def get_otp_expiry_minutes() -> int:
	return frappe.db.get_single_value("Transport Settings", "otp_expiry_minutes") or 60
