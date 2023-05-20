import { Item } from "../../../baseItem";
import { IService } from "./service.interface";

export class ServiceItem extends Item implements IService {
  static prefixService = "S#";

  id: string;
  name: string;
  description: string;

  constructor(service: IService) {
    super();
    this.id = service.id;
    this.name = service.name;
    this.description = service.description;
  }

  get PK() {
    return ServiceItem.prefixService;
  }

  get SK() {
    return ServiceItem.prefixService + this.id;
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      name: this.name,
      description: this.description,
    };
  }

  static fromItem(item: Record<string, unknown>): ServiceItem {
    return new ServiceItem({
      id: (item.SK as string).replace(ServiceItem.prefixService, ""),
      name: item.name as string,
      description: item.description as string,
    });
  }

  static buildKey(id: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: ServiceItem.prefixService,
      SK: ServiceItem.prefixService + id,
    };
  }
}
