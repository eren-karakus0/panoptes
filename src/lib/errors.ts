export class IndexerError extends Error {
  constructor(
    message: string,
    public readonly source: "validators" | "endpoints" | "stats" | "cleanup" | "slo" | "incident",
  ) {
    super(message);
    this.name = "IndexerError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class CronAuthError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "CronAuthError";
  }
}
