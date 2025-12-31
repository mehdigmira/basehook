import base64
import hashlib
import hmac
from typing import Literal


def verify_hmac_signature(
    secret: str,
    received_signature: str,
    body: bytes,
    timestamp: str | None = None,
    url: str | None = None,
    signature_format: str = "{body}",
    encoding: Literal["hex", "base64"] = "hex",
    prefix: str | None = None,
    algorithm: Literal["sha1", "sha256"] = "sha256",
) -> bool:
    """
    Verify HMAC signature for webhook requests.

    Args:
        secret: The shared secret key
        received_signature: The signature from the webhook header
        body: The raw request body as bytes
        timestamp: Optional timestamp from headers
        url: Optional URL to include in signature
        signature_format: Format string for building signature base string
            Examples: "{body}", "v0:{timestamp}:{body}", "{timestamp}.{body}"
        encoding: How to encode the HMAC output ("hex" or "base64")
        prefix: Optional prefix to add to signature (e.g., "v0=" or "sha256=")
        algorithm: Hash algorithm to use ("sha256" or "sha1")

    Returns:
        True if signature is valid, False otherwise
    """
    # Build signature base string
    body_str = body.decode("utf-8")
    base_string = signature_format.format(
        body=body_str,
        timestamp=timestamp or "",
        url=url or "",
    )

    # HMAC the base string
    hash_func = hashlib.sha1 if algorithm == "sha1" else hashlib.sha256
    raw_signature = hmac.new(secret.encode("utf-8"), base_string.encode("utf-8"), hash_func)

    # Encode the signature
    if encoding == "hex":
        encoded = raw_signature.hexdigest()
    else:  # base64
        encoded = base64.b64encode(raw_signature.digest()).decode("utf-8")

    # Add prefix if configured
    expected_signature = f"{prefix}{encoded}" if prefix else encoded

    # Compare using constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, received_signature)
