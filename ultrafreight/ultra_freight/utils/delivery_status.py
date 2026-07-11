DELIVERY_STATUS_OPTIONS = ("Open", "In Transit", "Pending Invoicing", "Completed")

LEGACY_DELIVERY_STATUS = {
	"Pending": "In Transit",
	"Awaiting Transport Order": "Open",
	"Partially Delivered": "Completed",
}


def normalize_delivery_status(status: str | None) -> str:
	status = (status or "").strip() or "Open"
	return LEGACY_DELIVERY_STATUS.get(status, status)


def delivery_status_field_options() -> str:
	return "\n" + "\n".join(DELIVERY_STATUS_OPTIONS)
