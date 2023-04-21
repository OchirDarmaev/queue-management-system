import { ulid } from "ulid";
import { Item } from "../baseItem";
import { ServicePointStatus } from "./ServicePointStatus";
import { IServicePoint } from "./IServicePoint";


export class ServicePointItem extends Item {
  static prefixServicePoint = "SP#";
  public id: string;
  public serviceIds: string[];
  public name: string;
  public description: string;
  public servicePointStatus: ServicePointStatus;
  public currentQueueItem: string;
  public servicePointNumber: string;
  constructor(servicePoint: Partial<IServicePoint>) {
    super();
    this.id = servicePoint.id || ulid();
    this.serviceIds = servicePoint.serviceIds || [];
    this.name = servicePoint.name || "";
    this.description = servicePoint.description || "";
    this.servicePointStatus =
      servicePoint.servicePointStatus || ServicePointStatus.CLOSED;
    this.currentQueueItem = servicePoint.currentQueueItem || "";
    this.servicePointNumber = servicePoint.servicePointNumber || "";
  }

  get PK(): string {
    return ServicePointItem.prefixServicePoint;
  }

  get SK(): string {
    return ServicePointItem.prefixServicePoint + this.id;
  }

  static fromItem(item: Record<string, unknown>): ServicePointItem {
    return new ServicePointItem({
      id: (item.SK as string).replace(ServicePointItem.prefixServicePoint, ""),
      serviceIds: item.serviceIds as string[],
      name: item.name as string,
      description: item.description as string,
      servicePointStatus: item.servicePointStatus as ServicePointStatus,
      currentQueueItem: item.currentQueueItem as string,
      servicePointNumber: item.servicePointNumber as string,
    });
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceIds: this.serviceIds,
      name: this.name,
      description: this.description,
      servicePointStatus: this.servicePointStatus,
      currentQueueItem: this.currentQueueItem,
      servicePointNumber: this.servicePointNumber,
    };
  }

  static buildKey(queueId: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: ServicePointItem.prefixServicePoint,
      SK: ServicePointItem.prefixServicePoint + queueId,
    };
  }
}
