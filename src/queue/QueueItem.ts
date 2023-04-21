import { Item } from "../baseItem";
import { ServiceItem } from "../services/ServiceItem";
import { QueuePriority } from "./QueuePriority";
import { QueueStatus } from "./QueueStatus";
import { IQueueItem } from "./IQueueItem";

export class QueueItem extends Item {
  static prefix = "Q#"
  static prefixQueueStatus = "Q_STATUS#";

  public id: string;
  public serviceId: string;
  public queueStatus: QueueStatus;
  public priority: QueuePriority;
  public date: string;
  public memorableId: string;
  constructor(queueItem: IQueueItem) {
    super();
    this.id = queueItem.id;
    this.serviceId = queueItem.serviceId;
    this.queueStatus = queueItem.queueStatus;
    this.priority = queueItem.priority;
    this.date = queueItem.date;
    this.memorableId = queueItem.memorableId;
  }
  get PK(): string {
    return QueueItem.prefix;
  }

  get SK(): string {
    return QueueItem.prefix + this.id;
  }

  get GSI1PK(): string {
    return QueueItem.prefix + ServiceItem.prefixService + this.serviceId;
  }

  get GSI1SK(): string {
    return `${QueueItem.prefixQueueStatus}${this.queueStatus}Q_PRIORITY#${this.priority}#Q_DATE${this.date}`;
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceId: this.serviceId,
      queueStatus: this.queueStatus,
      priority: this.priority,
      date: this.date,
      memorableId: this.memorableId,
      GSI1PK: this.GSI1PK,
      GSI1SK: this.GSI1SK,
    };
  }

  static fromItem(item: Record<string, unknown>): QueueItem {
    return new QueueItem({
      id: (item.SK as string).replace(QueueItem.prefix, ""),
      serviceId: item.serviceId as string,
      queueStatus: item.queueStatus as QueueStatus,
      priority: item.priority as QueuePriority,
      date: item.date as string,
      memorableId: item.memorableId as string,
    });
  }

  static buildKey(queueId: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: QueueItem.prefix,
      SK: QueueItem.prefix + queueId,
    };
  }
}
