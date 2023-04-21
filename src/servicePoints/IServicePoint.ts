import { ServicePointStatus } from "./ServicePointStatus";


export type IServicePoint = {
  id: string;
  serviceIds: string[];
  name: string;
  description: string;
  servicePointStatus: ServicePointStatus;
  currentQueueItem?: string;
  servicePointNumber: string;
};
