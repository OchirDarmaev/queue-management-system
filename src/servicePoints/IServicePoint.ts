import { ServicePointStatus } from "./ServicePointStatus";


export type IServicePoint = {
  id: string;
  serviceIds: string[];
  name: string;
  description: string;
  servicePointStatus: ServicePointStatus;
  currentItem?: string;
  servicePointNumber: string;
};
