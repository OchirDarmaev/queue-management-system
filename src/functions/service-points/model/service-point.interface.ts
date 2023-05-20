import { EServicePointStatus } from "../service-point-status.enum";

export type IServicePoint = {
  id: string;
  serviceIds: string[];
  name: string;
  description: string;
  servicePointStatus: EServicePointStatus;
  currentQueueItem?: string;
  servicePointNumber: string;
};
