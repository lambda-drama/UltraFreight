import frappe
from frappe import _

from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


def send_transport_sms(receiver_list: list[str], message: str) -> None:
	"""Send SMS using configured provider. Falls back to Frappe SMS Settings."""
	settings = get_transport_settings()
	if not settings.get("enable_sms"):
		return

	numbers = [_format_phone(number, settings.get("default_country_code")) for number in receiver_list]
	numbers = [n for n in numbers if n]
	if not numbers:
		return

	provider = settings.get("sms_provider")
	if provider and provider != "Frappe SMS Settings":
		_send_via_custom_provider(numbers, message, settings)
		return

	_send_via_frappe_sms(numbers, message)


def _format_phone(phone: str, country_code: str | None) -> str:
	phone = (phone or "").strip()
	if not phone:
		return ""
	if phone.startswith("+"):
		return phone
	if country_code and not phone.startswith(country_code.lstrip("+")):
		return f"{country_code}{phone.lstrip('0')}"
	return phone


def _send_via_frappe_sms(receiver_list: list[str], message: str) -> None:
	try:
		from frappe.core.doctype.sms_settings.sms_settings import send_sms

		send_sms(receiver_list=receiver_list, msg=message, success_msg=False)
	except Exception:
		frappe.log_error(title=_("Ultra Dispatch SMS Failed"), message=frappe.get_traceback())


def _send_via_custom_provider(receiver_list: list[str], message: str, settings: dict) -> None:
	"""Placeholder for Africa's Talking / Twilio integration."""
	frappe.logger("ultra_dispatch").info(
		"SMS via %s to %s: %s", settings.get("sms_provider"), receiver_list, message
	)
	# When provider credentials are configured, route here. Until then use Frappe SMS.
	_send_via_frappe_sms(receiver_list, message)
