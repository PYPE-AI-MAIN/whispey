/**
 * Failures of the data plane. All three mean "try again later" to the caller:
 * once a route exists there is no fallback to Pype, so the request fails (HTTP 503).
 * Messages name the destination, never its address or secret.
 */
export class DataPlaneError extends Error {
  readonly status = 503
  constructor(readonly code: string, message: string, readonly destination?: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The destination is down, slow, unverified, or its circuit breaker is open. */
export class DestinationUnavailable extends DataPlaneError {
  constructor(destination: string | undefined, message = 'Data destination is unavailable') {
    super('destination_unavailable', message, destination)
  }
}

/** The route is paused (kill switch or a route change in progress). */
export class RouteInMaintenance extends DataPlaneError {
  constructor(projectId: string, dataType: string) {
    super('route_in_maintenance', `Route ${dataType} for project ${projectId} is paused`)
  }
}

/** The destination's schema version or the project's routing combination is not supported. */
export class DestinationIncompatible extends DataPlaneError {
  constructor(destination: string | undefined, message: string) {
    super('destination_incompatible', message, destination)
  }
}
