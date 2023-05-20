export enum EAction {
  /**
   * manage is a special keyword in CASL which represents "any" action.
   */
  Manage = "manage",
  Create = "create",
  Read = "read",
  Update = "update",
  Delete = "delete",
  UpdateServicePointStatus = "update-service-point-status"
}
