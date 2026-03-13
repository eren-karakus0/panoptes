interface IncidentUpdateResult {
  status: "acknowledged" | "resolved";
}

interface IncidentCommentResult {
  message: string;
}

interface ValidationError {
  error: string;
}

const VALID_UPDATE_STATUSES = ["acknowledged", "resolved"] as const;

export function validateIncidentUpdate(
  body: unknown,
): IncidentUpdateResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { status } = body as Record<string, unknown>;

  if (!status || typeof status !== "string") {
    return { error: "status is required and must be a string" };
  }

  if (!VALID_UPDATE_STATUSES.includes(status as "acknowledged" | "resolved")) {
    return { error: `status must be one of: ${VALID_UPDATE_STATUSES.join(", ")}` };
  }

  return { status: status as "acknowledged" | "resolved" };
}

export function validateIncidentComment(
  body: unknown,
): IncidentCommentResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { message } = body as Record<string, unknown>;

  if (!message || typeof message !== "string") {
    return { error: "message is required and must be a string" };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { error: "message must not be empty" };
  }

  if (trimmed.length > 2000) {
    return { error: "message must not exceed 2000 characters" };
  }

  return { message: trimmed };
}
